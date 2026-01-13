import { Command } from 'commander';
import { Logger } from 'pino';
import { IWeb3PGPService, to0x } from '@cryptogram/dexes';
import { outputJson, exitWithError } from '../factory';
import { readInputFromFile, readInputFromStdin } from '../../utils/input';
import * as openpgp from 'openpgp';

export interface RevokeDeps {
  logger: Logger;
  service: IWeb3PGPService;
}

/**
 * Revoke a key on the blockchain
 * Usage: web3pgp revoke <fingerprint> [--key <path>]
 *        cat revocation.cert | web3pgp revoke <fingerprint>
 *
 * Both fingerprint and revocation certificate/key data are mandatory.
 * The fingerprint specifies which key (primary or subkey) to revoke.
 * The certificate/key data is the revocation certificate or key to revoke.
 * Key data can be provided via --key flag or stdin (stdin is default).
 */
export function createRevokeCommand(deps: RevokeDeps): Command {
  const { logger, service } = deps;
  const cmdLogger = logger.child({ command: 'revoke' });

  return new Command('revoke')
    .arguments('<fingerprint>')
    .description('Revoke a public key on the blockchain')
    .option('--key <path>', 'Path to armored revocation certificate file')
    .action(async (fingerprintArg: string, options: { key?: string }) => {
      try {
        // Fingerprint is mandatory
        const fingerprint = fingerprintArg.replaceAll(/\s/g, '');
        cmdLogger.debug({ fingerprint: fingerprint }, 'Processing fingerprint');

        let keyBuffer: Buffer;

        if (options.key) {
          cmdLogger.info({ path: options.key }, 'Reading armored revocation certificate from file');
          keyBuffer = readInputFromFile(options.key);
        } else {
          cmdLogger.info('Reading armored revocation certificate from stdin');
          keyBuffer = await readInputFromStdin();
        }

        let keyOrCert: openpgp.Key | string;
        try {
          // Try to read as key using binary format first
          keyOrCert = await openpgp.readKey({ binaryKey: keyBuffer });
          cmdLogger.debug('Parsed key revocation certificate (binary format) successfully');
        } catch {
          // Try to read as key using armored format
          try {
            // Using ascii for the toString as we expect armored text here
            keyOrCert = await openpgp.readKey({ armoredKey: keyBuffer.toString('ascii') });
            cmdLogger.debug('Parsed revocation certificate (armored format) successfully');
          } catch {
            // Cast to string (ascii encoding) because we probably have an armored standalone certificate (sdk service will check)
            keyOrCert = keyBuffer.toString('ascii');
            cmdLogger.debug('Parsing input as armored standalone revocation certificate');
          }
        }

        // Call revoke with certificate data and the fingerprint
        const result = await service.revoke(
          keyOrCert,
          to0x(fingerprint)
        );

        cmdLogger.info(
          {
            fingerprint: fingerprint,
            transactionHash: result.transactionHash,
            blockNumber: result.blockNumber,
          },
          'Key revocation successful'
        );

        // Output result as JSON
        outputJson({
          success: true,
          message: 'Key revoked successfully',
          fingerprint: fingerprintArg,
          transaction: {
            hash: result.transactionHash,
            blockNumber: result.blockNumber.toString(),
          },
        });

        process.exit(0);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        cmdLogger.error({ error: msg }, 'Failed to revoke key');
        exitWithError(msg);
      }
    });
}
