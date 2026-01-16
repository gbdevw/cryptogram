import { createReadStream } from 'fs';
import { stdin } from 'process';
import { Writable } from 'stream';
import { pipeline } from 'stream/promises';
import { Command } from 'commander';
import { Logger } from 'pino';
import { keccak_256 } from '@noble/hashes/sha3';
import { to0x, Web3DocService } from '@jibidieuw/dexes';
import { toBytes, toHex } from 'viem';
import { Config } from 'openpgp';

export interface VerifyCommandDeps {
  logger: Logger;
  web3docService: Web3DocService; 
}

/**
 * Create the 'verify' command
 * Verifies timestamp proofs for documents or hashes
 */
export function createVerifyCommand(deps: VerifyCommandDeps): Command {
  const { logger, web3docService } = deps;
  const cmdLogger = logger.child({ command: 'verify' });

  return new Command('verify')
    .description('Verify a timestamp applies to a document or its hash to prove its authenticity')
    .option('--id <ID>', 'ID of the timestamp to verify (mutually exclusive with --all)')
    .option('--all', 'Verify all timestamps that match the document or hash (mutually exclusive with --id)')
    .option('--doc', 'Input is the document to verify (mutually exclusive with --hash)')
    .option('--hash', 'Input is a keccak256 hash of the document to verify (mutually exclusive with --doc)')
    .argument('[input]', 'Hash as hexencoded bytestring or path to document file (reads from stdin if not provided)')
    .action(async (input: string | undefined, options: { id?: string; all?: boolean; doc?: boolean; hash?: boolean }) => {
      try {
        cmdLogger.debug({ input, options }, 'Starting verify operation');

        // Validate flag combinations
        if (options.id && options.all) {
          throw new Error('--id and --all flags are mutually exclusive');
        }

        if (!options.id && !options.all) {
          throw new Error('Either --id or --all flag is required');
        }

        if (options.doc && options.hash) {
          throw new Error('--doc and --hash flags are mutually exclusive');
        }

        if (!options.doc && !options.hash) {
          throw new Error('Either --doc or --hash flag is required');
        }

        let documentHash: `0x${string}`;

        if (options.hash) {
          // Input is a hash value
          if (!input) {
            throw new Error('Hash value is required when using --hash flag');
          }

          // Validate that input looks like a hex string
          if (!/^0x[a-fA-F0-9]+$/.test(input) && !/^[a-fA-F0-9]+$/.test(input)) {
            throw new Error('Hash must be a valid hexencoded bytestring (with or without 0x prefix)');
          }

          documentHash = to0x(input);
          cmdLogger.debug({ hash: documentHash }, 'Using provided hash');
        } else {
          // Input is a document - need to hash it
          let documentStream: NodeJS.ReadableStream;

          if (input) {
            // Use provided argument as file path
            documentStream = createReadStream(input);
            cmdLogger.debug({ path: input }, 'Reading document from file');
          } else {
            // Read from stdin
            documentStream = stdin;
            cmdLogger.debug('Reading document from stdin');
          }

          // Create a keccak256 hasher for streaming
          const hasher = keccak_256.create();

          // Create a writable stream that feeds data to the hasher
          const hashStream = new Writable({
            write(chunk: Buffer, _encoding: string, callback: (error?: Error | null) => void) {
              hasher.update(chunk);
              callback();
            }
          });

          // Stream the document through the hasher without buffering
          await pipeline(documentStream, hashStream);
          cmdLogger.debug('Document hashed successfully');

          // Get the final hash as hex
          documentHash = to0x(Buffer.from(hasher.digest()).toString('hex'));
          cmdLogger.debug({ hash: documentHash }, 'Document hash computed');
        }

        // Case ID
        if (options.id) {
            // Extract the public key and the timestamp and the recorded hash from the blockchain using the timestamp ID
            // and verify the timestamp is cryptographically valid for the provided document hash
            cmdLogger.info({ id: options.id }, 'Verifying timestamp by ID');
            const timestamp = await web3docService.verifyTimestamp(BigInt(options.id));
            cmdLogger.info({ tx: timestamp.tx, timestampDate: timestamp.date, emitter: to0x(timestamp.publicKey.getFingerprint()) }, 'Timestamp data retrieved and verified');

            // Verify the document hash matches the timestamped hash
            const timestampedHash = to0x(toHex(Buffer.from(timestamp.documentHash)));
            cmdLogger.info({ timestampedHash, documentHash }, 'Verifying document hash matches the timestamped hash');
            if (timestampedHash !== documentHash) {
                throw new Error('The provided document or hash does not match the timestamped hash on the blockchain');
            }

            // Write the armored signature to stdout
            cmdLogger.info('Verification completed successfully');
            console.log(timestamp.signature.armor({
              showComment: true,
              commentString: 'TimestampID=' + options.id + ' ; Hash=' + documentHash + '; Emitter=' + to0x(timestamp.publicKey.getFingerprint()),
            } as Partial<Config> as  Config));
        } 
        else {
          // Verify all timestamps matching the document hash
          const ids = await web3docService.findTimestampsByHash(toBytes(documentHash));
          if (ids.length === 0) {
            throw new Error('No timestamps found for the provided document or hash');
          }
          cmdLogger.info({ count: ids.length }, 'Verifying all matching timestamps by document hash');
          for (const id of ids) {
            try {
              const timestamp = await web3docService.verifyTimestamp(id);
              cmdLogger.info({ id, tx: timestamp.tx, timestampDate: timestamp.date, emitter: to0x(timestamp.publicKey.getFingerprint()) }, 'Timestamp data retrieved and verified');

              // Verify the document hash matches the timestamped hash
              const timestampedHash = to0x(toHex(Buffer.from(timestamp.documentHash)));
              cmdLogger.info({ id, timestampedHash, documentHash }, 'Verifying document hash matches the timestamped hash');
              if (timestampedHash !== documentHash) {
                  cmdLogger.warn({ id }, 'The provided document or hash does not match the timestamped hash on the blockchain - skipping');
                  continue;
              }

              // Write the armored signature to stdout
              cmdLogger.info({ id }, 'Verification completed successfully for this timestamp');
              console.log(timestamp.signature.armor({
                showComment: true,
                commentString: 'TimestampID=' + id + ' ; Hash=' + documentHash + '; Emitter=' + to0x(timestamp.publicKey.getFingerprint()),
              } as Partial<Config> as  Config));
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              cmdLogger.error({ id, error: msg }, 'Failed to verify timestamp by ID - skipping');
            }
          }
        }
        process.exit(0);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        cmdLogger.error({ error: msg }, 'Failed to verify timestamp applies to the provided document or hash');
        process.exit(1);
      }
    });
}
