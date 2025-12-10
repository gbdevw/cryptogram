import { Command } from 'commander';
import { Logger } from 'pino';
import { IWeb3PGPService, to0x } from 'dexes';
import * as openpgp from 'openpgp';
import { outputJson, exitWithError } from '../factory';
import { readInputFromFile, readInputFromStdin, readKeyData } from '../../utils/input';

export interface AddSubkeyDeps {
  logger: Logger;
  service: IWeb3PGPService;
}

export function createAddSubkeyCommand(deps: AddSubkeyDeps): Command {
  const { logger, service } = deps;
  const cmdLogger = logger.child({ command: 'add-subkey' });

  return new Command('add-subkey')
    .arguments('<subkeyFingerprint>')
    .description('Add a subkey to an existing key on the blockchain')
    .option('--key <path>', 'Path to PGP key file containing the subkey (armored or binary)')
    .action(async (subkeyFingerprintArg: string, options: { key?: string }) => {
      try {
        // Subkey fingerprint is mandatory
        cmdLogger.debug({ subkeyFingerprint: subkeyFingerprintArg }, 'Processing subkey fingerprint');

        let keyData: Buffer | string;
        if (options.key) {
          cmdLogger.info({ path: options.key }, 'Reading key from file');
          keyData = readInputFromFile(options.key);
        } else {
          cmdLogger.info('Reading key from stdin');
          keyData = await readInputFromStdin();
        }

        cmdLogger.debug({ dataLength: keyData.length }, 'Key data received');

        // Parse the key - tries armored format first, then binary
        const key = (await readKeyData(keyData)) as openpgp.PublicKey;

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
