import { createReadStream } from 'fs';
import { stdin } from 'process';
import { Command } from 'commander';
import { Logger } from 'pino';
import { to0x, Web3DocService } from '@jibidieuw/dexes';
import * as openpgp from 'openpgp';
import { hexToBytes, stringify } from 'viem';

export interface TimestampCommandDeps {
  logger: Logger;
  web3docService: Web3DocService;
}

/**
 * Create the 'timestamp' command
 * Creates a timestamp proof of a document on the blockchain
 */
export function createTimestampCommand(deps: TimestampCommandDeps): Command {
  const { logger, web3docService } = deps;
  const cmdLogger = logger.child({ command: 'timestamp' });

  return new Command('timestamp')
    .description('Create a timestamp proof for a document')
    .requiredOption('-e, --emitter <fingerprint>', 'Emitter fingerprint as hexencoded bytestring')
    .requiredOption('-H, --hash <hash>', 'Keccak256 hash of the document as hexencoded bytestring')
    .option('-s, --signature <path>', 'Path to file containing detached signature (reads from stdin if not provided)')
    .action(async (options: { emitter: string; hash: string; signature?: string }) => {
      try {
        // Unpack inputs
        const { emitter, hash, signature: signaturePath } = options;

        cmdLogger.debug({ hasSignaturePath: !!signaturePath }, 'Starting timestamp operation');

        const signatureStream = signaturePath
          ? createReadStream(signaturePath)
          : stdin;

        if (signaturePath) {
          cmdLogger.debug({ path: signaturePath }, 'Reading signature from file');
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

        // try to read the signature as armored text first
        let sig: openpgp.Signature;
        try {
            const armoredText = signatureData.toString('ascii');
            sig = await openpgp.readSignature({ armoredSignature: armoredText });
        } catch (e) {
            // fallback to binary signature
            sig = await openpgp.readSignature({ binarySignature: signatureData });
        }

        // The service verifies the key, the signature and create the timestamp on the blockchain
        cmdLogger.info('Verifying signature and creating timestamp on blockchain');
        const [timestampId, receipt] = await web3docService.timestamp(
            hexToBytes(to0x(hash)),
            sig,
            to0x(emitter), // Prefer using the primary key fingerprint as emitter 
        );
        cmdLogger.info({timestampId}, 'Timestamp created successfully');

        // Print the result on stdout as JSON using Viem's stringify for proper BigInt serialization
        const result = {
          timestampId: timestampId.toString(),
          receipt: receipt,
        };
        console.log(stringify(result, null, 2));
        process.exit(0);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        cmdLogger.error({ error: msg }, 'Failed to create timestamp');
        process.exit(1);
      }
    });
}