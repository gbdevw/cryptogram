import { Command } from 'commander';
import { Logger } from 'pino';
import { IWeb3PGPService } from 'dexes';
import * as openpgp from 'openpgp';
import { outputJson, exitWithError } from '../factory';
import { readInputFromFile, readInputFromStdin } from '../../utils/input';

export interface RegisterDeps {
  logger: Logger;
  service: IWeb3PGPService;
}

/**
 * Register a public key on the blockchain
 * Usage: web3pgp blockchain register --key <path> | --stdin
 */
export function createRegisterCommand(deps: RegisterDeps): Command {
  const { logger, service } = deps;
  const cmdLogger = logger.child({ command: 'blockchain.register' });

  return new Command('register')
    .description('Register a public key on the blockchain')
    .option('--key <path>', 'Path to armored PGP public key file')
    .option('--stdin', 'Read armored PGP public key from stdin')
    .action(async (options: { key?: string; stdin?: boolean }) => {
      try {
        let armoredKey: string;

        // Read input from file or stdin
        if (options.key) {
          cmdLogger.info({ path: options.key }, 'Reading PGP key from file');
          armoredKey = readInputFromFile(options.key);
        } else if (options.stdin) {
          cmdLogger.info('Reading PGP key from stdin');
          armoredKey = await readInputFromStdin();
        } else {
          throw new Error('Must provide either --key <path> or --stdin');
        }

        cmdLogger.debug({ keyLength: armoredKey.length }, 'Key data received');

        // Parse armored key
        cmdLogger.info('Parsing and validating PGP key');
        const publicKey = await openpgp.readKey({ armoredKey });

        cmdLogger.debug({ fingerprint: publicKey.getFingerprint() }, 'Key parsed successfully');

        const result = await service.register(publicKey);

        cmdLogger.info(
          {
            fingerprint: publicKey.getFingerprint(),
            transactionHash: result.transactionHash,
            blockNumber: result.blockNumber,
          },
          'Key registration successful'
        );

        // Output result as JSON
        outputJson({
          success: true,
          message: 'Public key and subkeys registered successfully',
          fingerprint: publicKey.getFingerprint(),
          subkeys: publicKey.getSubkeys().map((sk) => sk.getFingerprint()),
          transaction: {
            hash: result.transactionHash,
            blockNumber: result.blockNumber.toString(),
          },
        });

        process.exit(0);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        cmdLogger.error({ error: msg }, 'Failed to register key');
        exitWithError(msg);
      }
    });
}
