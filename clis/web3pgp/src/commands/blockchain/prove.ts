import { createReadStream } from 'fs';
import { stdin } from 'process';
import { Command } from 'commander';
import { Logger } from 'pino';
import { IWeb3PGPService, to0x, toBytes32 } from '@jibidieuw/dexes';
import { toHex } from 'viem';
import * as openpgp from 'openpgp';
import { outputJson, exitWithError } from '../factory';

export interface ProveDeps {
  logger: Logger;
  service: IWeb3PGPService;
}

/**
 * Prove ownership of a key on the blockchain
 * Usage: web3pgp prove <fingerprint> <hash> --signature <path> | read from stdin
 */
export function createProveCommand(deps: ProveDeps): Command {
  const { logger, service } = deps;
  const cmdLogger = logger.child({ command: 'prove' });

  return new Command('prove')
    .description('Prove ownership of a key by posting a valid signature of the bytes of the keccak256 hash of the challenge on the blockchain')
    .argument('<fingerprint>', 'Hex string fingerprint of the key')
    .argument('<hash>', 'Keccak256 hash of the challenge as hex string')
    .option('-s, --signature <path>', 'Path to file containing detached signature (reads from stdin if not provided)')
    .action(async (fingerprint: string, hash: string, options: { signature?: string }) => {
      try {
        // Process fingerprint - remove whitespaces and convert to bytes32
        const fp = toBytes32(to0x(fingerprint.replaceAll(/\s/g, '')));
        cmdLogger.debug({ fingerprint: fp }, 'Fingerprint processed');

        // Process hash - convert hex string to proper format
        const challengeHash = toHex(hash);
        cmdLogger.debug({ hash: challengeHash }, 'Challenge hash processed');

        // Read signature from file or stdin
        const signatureStream = options.signature
          ? createReadStream(options.signature)
          : stdin;

        if (options.signature) {
          cmdLogger.debug({ path: options.signature }, 'Reading signature from file');
        } else {
          cmdLogger.debug('Reading signature from stdin');
        }

        const signatureData = await new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          signatureStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          signatureStream.on('end', () => resolve(Buffer.concat(chunks)));
          signatureStream.on('error', reject);
        });

        cmdLogger.debug({ size: signatureData.length }, 'Signature read successfully');

        // Try to read the signature as armored text first
        let signature: openpgp.Signature;
        try {
          const armoredText = signatureData.toString('ascii');
          signature = await openpgp.readSignature({ armoredSignature: armoredText });
        } catch (e) {
          // Fallback to binary signature
          signature = await openpgp.readSignature({ binarySignature: signatureData });
        }

        cmdLogger.debug('Signature parsed successfully');

        cmdLogger.info(
          {
            fingerprint: fp,
            hash: challengeHash,
          },
          'Verifying ownership proof and submitting to blockchain'
        );

        // Prove ownership on the blockchain
        const result = await service.proveOwnership(fp, challengeHash, signature);

        cmdLogger.info(
          {
            fingerprint: fp,
            transactionHash: result.transactionHash,
            blockNumber: result.blockNumber.toString(),
          },
          'Key ownership proof submitted successfully'
        );

        // Output result as JSON
        outputJson({
          success: true,
          message: 'Key ownership proof submitted successfully',
          fingerprint: fp,
          hash: challengeHash,
          transaction: {
            hash: result.transactionHash,
            blockNumber: result.blockNumber.toString(),
          },
        });

        process.exit(0);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        cmdLogger.error({ error: msg }, 'Failed to submit ownership proof');
        exitWithError(msg);
      }
    });
}
