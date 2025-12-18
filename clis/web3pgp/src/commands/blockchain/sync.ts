import { Command } from 'commander';
import { Logger } from 'pino';
import { KeyRegisteredLog, KeyRevokedLog, SubkeyAddedLog, IWeb3PGPService, Web3PGPServiceValidationError } from '@cryptogram/dexes';

import { exitWithError } from '../factory';

export interface SyncDeps {
  logger: Logger;
  service: IWeb3PGPService;
}

/**
 * Creates a command for listening to Web3PGP blockchain events and relay valid OpenPGP messages.
 * 
 * This command synchronizes key-related events (registrations, subkey additions, revocations)
 * from the blockchain and outputs valid OpenPGP messages in armored format to stdout.
 * 
 * The listener supports graceful shutdown via SIGINT (Ctrl+C) and SIGTERM signals.
 * 
 * @param deps Command dependencies (logger, service)
 * @returns Configured Commander command
 */
export function createSyncCommand(deps: SyncDeps): Command {
  const { logger, service } = deps;
  const cmdLogger = logger.child({ command: 'sync' });

  return new Command('sync')
    .description('Listen for Web3PGP events related to public keys (registrations, added subkeys, revocations) and output valid OpenPGP messages in armored format to stdout')
    .option('--from <block>', 'Optional starting block - starts from latest block if not specified')
    .option('--to <block>', 'Optional ending block - listens indefinitely if not specified')
    .option('--interval <seconds>', 'Polling interval in seconds when listening for new events (default: 15)', '15')
    .option('--max-range <blocks>', 'Maximum number of blocks to process in one batch when syncing historical events (default: 10000)', '10000')
    .action(async (options: {
      from?: string;
      to?: string;
      interval?: string;
      'max-range'?: string;
    }) => {
      // Track whether a graceful shutdown has been requested
      let shouldExit = false;

      /**
       * Signal handler for graceful shutdown.
       * Allows the current event processing batch to complete before exiting.
       */
      const handleShutdown = (signal: string) => {
        if (shouldExit) {
          // Force exit if already shutting down
          cmdLogger.warn(`Received ${signal} again - forcing exit`);
          process.exit(1);
        }

        cmdLogger.info(`Received ${signal} - initiating graceful shutdown`);
        shouldExit = true;
      };

      // Register signal handlers
      process.on('SIGINT', () => handleShutdown('SIGINT'));
      process.on('SIGTERM', () => handleShutdown('SIGTERM'));

      try {
        // Validate inputs - From
        let fromBlock: bigint;
        let toBlock: bigint | undefined;

        if (options.from) {
          fromBlock = BigInt(options.from);
          cmdLogger.debug({ fromBlock }, `Starting synchronization from block ${fromBlock}`);
        } else {
          fromBlock = await service.getBlockNumber();
          cmdLogger.debug({ fromBlock }, `Starting synchronization from latest block ${fromBlock}`);
        }

        // Validate inputs - To
        if (options.to) {
          toBlock = BigInt(options.to);
          if (toBlock < fromBlock) {
            throw new Error(`Ending block (${toBlock}) cannot be less than starting block (${fromBlock})`);
          }
          cmdLogger.debug({ toBlock }, `Ending synchronization at block ${toBlock}`);
        } else {
          cmdLogger.debug('Listening indefinitely for new events');
        }

        // Validate inputs - Interval
        const intervalSeconds = options.interval ? parseInt(options.interval, 10) : 15;
        if (isNaN(intervalSeconds) || intervalSeconds <= 0) {
          throw new Error('Polling interval (--interval) must be a positive integer representing seconds');
        }
        cmdLogger.debug({ intervalSeconds }, `Using polling interval of ${intervalSeconds} seconds`);

        // Validate inputs - Max Range
        const maxRange = options['max-range'] ? BigInt(options['max-range']) : 10000n;
        if (maxRange <= 0n) {
          throw new Error('Maximum range (--max-range) must be a positive integer representing number of blocks');
        }
        cmdLogger.debug({ maxRange }, `Using maximum block range of ${maxRange} for event syncing`);

        // Event listening loop
        while (!shouldExit && (toBlock === undefined || fromBlock <= toBlock)) {
          // Get latest block number and determine the next target given the range to process
          let target = await service.getBlockNumber();
          if (toBlock !== undefined) {
            // Ensure we do not exceed the specified toBlock
            target = target > toBlock ? toBlock : target;
          }
          target = fromBlock + maxRange - 1n < target ? fromBlock + maxRange - 1n : target;

          // Fetch the events
          cmdLogger.info({ fromBlock, toBlock: target }, `Fetching events from blockchain from block ${fromBlock} to ${target}`);
          const logs = await service.searchKeyEvents(fromBlock, target);

          // Process and output events
          await processKeyEvents(logs, service, cmdLogger);

          // Update fromBlock for next iteration
          fromBlock = target + 1n;

          // Check for shutdown signal before waiting
          if (shouldExit || (toBlock !== undefined && fromBlock > toBlock)) {
            break;
          }

          // Wait for the specified interval before next iteration
          cmdLogger.debug({ waitSeconds: intervalSeconds }, 'Waiting before next polling iteration');
          await sleep(intervalSeconds * 1000);
        }

        // Exit gracefully
        cmdLogger.info('Event synchronization completed - exiting gracefully');
        process.exit(0);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        cmdLogger.error({ error: msg }, 'Failed to synchronize with blockchain events');
        exitWithError(msg);
      } finally {
        // Clean up signal handlers
        process.removeAllListeners('SIGINT');
        process.removeAllListeners('SIGTERM');
      }
    });
}

/**
 * Process key events and output armored OpenPGP messages to stdout.
 * 
 * @param logs Array of key-related event logs
 * @param service Web3PGP service for extracting key data
 * @param logger Logger instance
 * @throws Will not throw; validation errors are logged and skipped
 */
async function processKeyEvents(
  logs: (KeyRegisteredLog | SubkeyAddedLog | KeyRevokedLog)[],
  service: IWeb3PGPService,
  logger: Logger
): Promise<void> {
  for (const log of logs) {
    try {
      if (isKeyRegisteredLog(log)) {
        logger.info({
          block: log.blockNumber,
          tx: log.transactionHash,
          primaryKeyFingerprint: log.primaryKeyFingerprint,
        }, 'Processing KeyRegistered event');

        const pk = await service.extractFromKeyRegisteredLog(log);
        console.log(await pk.armor());
      } else if (isSubkeyAddedLog(log)) {
        logger.info({
          block: log.blockNumber,
          tx: log.transactionHash,
          primaryKeyFingerprint: log.primaryKeyFingerprint,
          subkeyFingerprint: log.subkeyFingerprint,
        }, 'Processing SubkeyAdded event');

        const pk = await service.extractFromSubkeyAddedLog(log);
        console.log(await pk.armor());
      } else if (isKeyRevokedLog(log)) {
        logger.info({
          block: log.blockNumber,
          tx: log.transactionHash,
          fingerprint: log.fingerprint,
        }, 'Processing KeyRevoked event');

        const [revoked, cert] = await service.extractFromKeyRevokedLog(log);
        if (revoked) {
          console.log(await revoked.armor());
        } else if (cert) {
          console.log(cert);
        } else {
          logger.warn({ log }, 'No revocation information found in KeyRevoked event - skipping');
        }
      }
    } catch (error) {
      if (error instanceof Web3PGPServiceValidationError) {
        // Warn if validation error - skip the log
        logger.warn(
          { log, error: (error as Error).message },
          'The key event is not valid - skipping'
        );
      } else {
        // Critical error - rethrow to stop processing
        throw error;
      }
    }
  }
}

/**
 * Type guard to check if a log is a KeyRegisteredLog.
 * 
 * @param log Event log to check
 * @returns True if log is a KeyRegisteredLog
 */
function isKeyRegisteredLog(log: unknown): log is KeyRegisteredLog {
  return !!(log && typeof log === 'object' && 'primaryKeyFingerprint' in log && !('subkeyFingerprint' in log));
}

/**
 * Type guard to check if a log is a SubkeyAddedLog.
 * 
 * @param log Event log to check
 * @returns True if log is a SubkeyAddedLog
 */
function isSubkeyAddedLog(log: unknown): log is SubkeyAddedLog {
  return !!(log && typeof log === 'object' && 'subkeyFingerprint' in log);
}

/**
 * Type guard to check if a log is a KeyRevokedLog.
 * 
 * Ensures the log has both fingerprint and revocationCertificate properties,
 * which together uniquely identify a KeyRevokedLog from other event types.
 * 
 * @param log Event log to check
 * @returns True if log is a KeyRevokedLog
 */
function isKeyRevokedLog(log: unknown): log is KeyRevokedLog {
  return !!(
    log &&
    typeof log === 'object' &&
    'fingerprint' in log &&
    'revocationCertificate' in log &&
    !('primaryKeyFingerprint' in log)
  );
}

/**
 * Sleep utility function.
 * 
 * @param ms Milliseconds to sleep
 * @returns Promise that resolves after the specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}