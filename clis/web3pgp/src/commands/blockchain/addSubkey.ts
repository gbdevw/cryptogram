import { Command } from 'commander';
import { Logger } from 'pino';
import { IWeb3PGPService, to0x } from 'dexes';
import * as openpgp from 'openpgp';
import { outputJson, exitWithError } from '../factory';
import { readInputFromFile, readInputFromStdin } from '../../utils/input';

export interface AddSubkeyDeps {
  logger: Logger;
  service: IWeb3PGPService;
}

export function createAddSubkeyCommand(deps: AddSubkeyDeps): Command {
  const { logger, service } = deps;
  const cmdLogger = logger.child({ command: 'blockchain.add-subkey' });

  return new Command('add-subkey')
    .arguments('<subkeyFingerprint>')
    .description('Add a subkey to an existing key on the blockchain')
    .option('--key <path>', 'Path to armored PGP key file containing the subkey')
    .option('--stdin', 'Read armored PGP key from stdin')
    .action(async (subkeyFingerprintArg: string, options: { key?: string; stdin?: boolean }) => {
      try {
        // Subkey fingerprint is mandatory
        cmdLogger.debug({ subkeyFingerprint: subkeyFingerprintArg }, 'Processing subkey fingerprint');

        // Key data is mandatory (must provide --key or --stdin)
        if (!options.key && !options.stdin) {
          throw new Error('Must provide armored key via --key <path> or --stdin');
        }

        let armoredKey: string;
        if (options.key) {
          cmdLogger.info({ path: options.key }, 'Reading key from file');
          armoredKey = readInputFromFile(options.key);
        } else {
          cmdLogger.info('Reading key from stdin');
          armoredKey = await readInputFromStdin();
        }

        cmdLogger.debug({ dataLength: armoredKey.length }, 'Key data received');

        // Parse the key (contains the subkey we want to add)
        const key = await openpgp.readKey({ armoredKey });

        cmdLogger.info({ subkeyFingerprint: subkeyFingerprintArg }, 'Adding subkey to blockchain');
        const result = await service.addSubkey(key, to0x(subkeyFingerprintArg));

        outputJson({
          success: true,
          message: 'Subkey added successfully',
          subkeyFingerprint: subkeyFingerprintArg,
          transaction: { hash: result.transactionHash, blockNumber: result.blockNumber.toString() },
        });

        process.exit(0);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        cmdLogger.error({ error: msg }, 'Failed to add subkey');
        exitWithError(msg);
      }
    });
}
