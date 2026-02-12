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
    .option('--insecure', 'Disable public key verification when retrieving keys')
    .action(async (fingerprintArg: string, options: { insecure?: boolean }) => {
      try {
        const fp = fingerprintArg.replaceAll(/\s/g, '');
        const insecure = options.insecure || false;
        
        cmdLogger.info({ fingerprint: fp, insecure }, 'Retrieving public key');
        
        if (insecure) {
          cmdLogger.warn('Insecure mode enabled - public key verification disabled');
        }
        
        const publicKey = await service.getPublicKey(to0x(fp), insecure);

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
