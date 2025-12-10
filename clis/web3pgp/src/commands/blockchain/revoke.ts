import { Command } from 'commander';
import { Logger } from 'pino';
import { IWeb3PGPService, to0x } from 'dexes';
import { outputJson, exitWithError } from '../factory';
import { readInputFromFile, readInputFromStdin } from '../../utils/input';

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
    .option('--key <path>', 'Path to revocation certificate or key file')
    .action(async (fingerprintArg: string, options: { key?: string }) => {
      try {
        // Fingerprint is mandatory
        cmdLogger.debug({ fingerprint: fingerprintArg }, 'Processing fingerprint');

        let certificateOrKeyData: string;

        if (options.key) {
          cmdLogger.info({ path: options.key }, 'Reading certificate/key from file');
          certificateOrKeyData = readInputFromFile(options.key);
        } else {
          cmdLogger.info('Reading certificate/key from stdin');
          certificateOrKeyData = await readInputFromStdin();
        }

        cmdLogger.info(
          { fingerprint: fingerprintArg },
          'Submitting revocation to blockchain'
        );

        // Call revoke with certificate/key data and the fingerprint
        // SDK handles: validate armored format, extract fingerprint if needed, submit
        const result = await service.revoke(
          certificateOrKeyData,
          to0x(fingerprintArg)
        );

        cmdLogger.info(
          {
            fingerprint: fingerprintArg,
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
