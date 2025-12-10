import { Command } from 'commander';
import { Logger } from 'pino';
import { IWeb3PGPService, to0x } from 'dexes';

import { exitWithError } from '../factory';

export interface ListenDeps {
  logger: Logger;
  service: IWeb3PGPService;
}

export function createListenCommand(deps: ListenDeps): Command {
  const { logger } = deps;
  const cmdLogger = logger.child({ command: 'listen' });

  return new Command('listen')
    .description('Listen for blockchain events (placeholder - event support TBD)')
    .option('--fingerprint <fp>', 'Optional fingerprint filter')
    .action((options: { fingerprint?: string }) => {
      try {
        if (options.fingerprint) {
          cmdLogger.info({ fingerprint: options.fingerprint }, 'Would listen for filtered events');
        } else {
          cmdLogger.info('Would listen for all events');
        }

        console.log('Event listening not yet implemented - requires Web3 event subscriptions');
        process.exit(0);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        cmdLogger.error({ error: msg }, 'Failed to listen for events');
        exitWithError(msg);
      }
    });
}
