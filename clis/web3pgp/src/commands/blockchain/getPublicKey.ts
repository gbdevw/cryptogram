import { Command } from 'commander';
import { Logger } from 'pino';
import { IWeb3PGPService, to0x } from 'dexes';
import { exitWithError } from '../factory';

export interface GetPublicKeyDeps {
  logger: Logger;
  service: IWeb3PGPService;
}

export function createGetPublicKeyCommand(deps: GetPublicKeyDeps): Command {
  const { logger, service } = deps;
  const cmdLogger = logger.child({ command: 'blockchain.get-public-key' });

  return new Command('get')
    .description('Retrieve a public key from the blockchain by fingerprint')
    .argument('<fingerprint>', 'Key fingerprint')
    .action(async (fingerprintArg: string) => {
      try {
        cmdLogger.info({ fingerprint: fingerprintArg }, 'Retrieving public key');
        const publicKey = await service.getPublicKey(to0x(fingerprintArg));

        if (!publicKey) {
          throw new Error(`No key found for fingerprint: ${fingerprintArg}`);
        }

        cmdLogger.info({ fingerprint: fingerprintArg }, 'Key retrieved');
        console.log(publicKey.armor());

        process.exit(0);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        cmdLogger.error({ error: msg }, 'Failed to retrieve public key');
        exitWithError(msg);
      }
    });
}
