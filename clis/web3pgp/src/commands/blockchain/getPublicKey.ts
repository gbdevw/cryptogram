import { Command } from 'commander';
import { Logger } from 'pino';
import { IWeb3PGPService, to0x } from '@jibidieuw/dexes';
import { exitWithError } from '../factory';

export interface GetPublicKeyDeps {
  logger: Logger;
  service: IWeb3PGPService;
}

export function createGetPublicKeyCommand(deps: GetPublicKeyDeps): Command {
  const { logger, service } = deps;
  const cmdLogger = logger.child({ command: 'get' });

  return new Command('get')
    .description('Retrieve a public key from the blockchain by fingerprint')
    .argument('<fingerprint>', 'Key fingerprint')
    .action(async (fingerprintArg: string) => {
      try {
        const fp = fingerprintArg.replaceAll(/\s/g, '');
        cmdLogger.info({ fingerprint: fp }, 'Retrieving public key');
        const publicKey = await service.getPublicKey(to0x(fp));

        if (!publicKey) {
          throw new Error(`No key found for fingerprint: ${fp}`);
        }

        cmdLogger.info({ fingerprint: fp }, 'Key retrieved');
        console.log(publicKey.armor());

        process.exit(0);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        cmdLogger.error({ error: msg }, 'Failed to retrieve public key');
        exitWithError(msg);
      }
    });
}
