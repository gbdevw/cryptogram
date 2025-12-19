import { createReadStream } from 'fs';
import { stdin } from 'process';
import { Command } from 'commander';
import { Logger } from 'pino';
import { keccak256 } from 'viem';

export interface Keccak256CommandDeps {
  logger: Logger;
}

/**
 * Create the 'keccak256' command
 * Hashes input data using keccak256
 * Reads from stdin by default or from a file via --path flag
 */
export function createKeccak256Command(deps: Keccak256CommandDeps): Command {
  const { logger } = deps;
  const cmdLogger = logger.child({ command: 'keccak256' });

  return new Command('keccak256')
    .description('Hash data using keccak256')
    .option('-p, --path <path>', 'Path to file to hash (reads from stdin if not provided)')
    .action(async (options: { path?: string }) => {
      try {
        cmdLogger.debug({ hasPath: !!options.path }, 'Starting keccak256 operation');

        // Determine the input stream
        const inputStream = options.path
          ? createReadStream(options.path)
          : stdin;

        if (options.path) {
          cmdLogger.debug({ path: options.path }, 'Reading from file');
        } else {
          cmdLogger.debug('Reading from stdin');
        }

        // Collect chunks from the stream
        const chunks: Buffer[] = [];

        // Handle data events
        inputStream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        // Handle stream end
        await new Promise<void>((resolve, reject) => {
          inputStream.on('end', () => {
            resolve();
          });

          inputStream.on('error', (error) => {
            reject(error);
          });
        });

        // Concatenate all chunks
        const data = Buffer.concat(chunks);
        cmdLogger.debug({ size: data.length }, 'Data read successfully');

        // Hash using viem's keccak256
        const hash = keccak256(data);

        cmdLogger.debug({ hash }, 'Hash computed');

        // Output the hash
        console.log(hash);
        process.exit(0);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        cmdLogger.error({ error: msg }, 'Failed to compute keccak256 hash');
        console.error(JSON.stringify({ error: msg }, null, 2));
        process.exit(1);
      }
    });
}
