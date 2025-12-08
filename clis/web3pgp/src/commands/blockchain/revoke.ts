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
 * Usage: web3pgp revoke <fingerprint> [--key <path> | --stdin]
 *
 * Both fingerprint and revocation certificate/key data are mandatory.
 * The fingerprint specifies which key (primary or subkey) to revoke.
 * The certificate/key data is the revocation certificate or key to revoke.
 */
export function createRevokeCommand(deps: RevokeDeps): Command {
  const { logger, service } = deps;
  const cmdLogger = logger.child({ command: 'blockchain.revoke' });

  return new Command('revoke')
    .arguments('<fingerprint>')
    .description('Revoke a public key on the blockchain')
    .option('--key <path>', 'Path to revocation certificate or key')
    .option('--stdin', 'Read revocation certificate or key from stdin')
    .action(async (fingerprintArg: string, options: { key?: string; stdin?: boolean }) => {
      try {
        // Fingerprint is mandatory
        cmdLogger.debug({ fingerprint: fingerprintArg }, 'Processing fingerprint');

        // Certificate/key data is mandatory (must provide --key or --stdin)
        if (!options.key && !options.stdin) {
          throw new Error('Must provide revocation certificate/key via --key <path> or --stdin');
        }

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
