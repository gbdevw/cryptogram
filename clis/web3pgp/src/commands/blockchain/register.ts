import { Command } from 'commander';
import { Logger } from 'pino';
import { IWeb3PGPService } from 'dexes';
import * as openpgp from 'openpgp';
import { outputJson, exitWithError } from '../factory';
import { readInputFromFile, readInputFromStdin, readKeyData } from '../../utils/input';

export interface RegisterDeps {
  logger: Logger;
  service: IWeb3PGPService;
}

/**
 * Register a public key on the blockchain
 * Usage: web3pgp register --key <path> | read from stdin
 */
export function createRegisterCommand(deps: RegisterDeps): Command {
  const { logger, service } = deps;
  const cmdLogger = logger.child({ command: 'register' });

  return new Command('register')
    .description('Register a public key on the blockchain')
    .option('--key <path>', 'Path to PGP public key file (armored or binary)')
    .action(async (options: { key?: string }) => {
      try {
        let keyData: Buffer | string;

        // Determine source and read input
        if (options.key) {
          cmdLogger.info({ path: options.key }, 'Reading PGP key from file');
          keyData = readInputFromFile(options.key);
        } else {
          cmdLogger.info('Reading PGP key from stdin');
          keyData = await readInputFromStdin();
        }

        cmdLogger.debug({ dataLength: keyData.length }, 'Key data received');

        // Parse key - tries armor format first, then binary
        cmdLogger.info('Parsing and validating PGP key');
        const publicKey = (await readKeyData(keyData)) as openpgp.PublicKey;

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
