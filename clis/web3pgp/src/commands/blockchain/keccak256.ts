import { createReadStream } from 'fs';
import { stdin } from 'process';
import { Command } from 'commander';
import { Logger } from 'pino';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex } from '@noble/hashes/utils';

export interface Keccak256CommandDeps {
  logger: Logger;
}

export function createKeccak256Command(deps: Keccak256CommandDeps): Command {
  const { logger } = deps;
  const cmdLogger = logger.child({ command: 'keccak256' });

  return new Command('keccak256')
    .description('Hash data using keccak256')
    .option('-p, --path <path>', 'Path to file to hash (reads from stdin if not provided)')
    .action(async (options: { path?: string }) => {
      try {
        cmdLogger.debug({ hasPath: !!options.path }, 'Starting keccak256 operation');

        const inputStream = options.path
          ? createReadStream(options.path)
          : stdin;


        const hasher = keccak_256.create();

        for await (const chunk of inputStream) {
          hasher.update(chunk);
        }
        
        cmdLogger.debug('Data hashed successfully');

        const hashHex = '0x' + bytesToHex(hasher.digest());

        cmdLogger.debug({ hash: hashHex }, 'Hash computed');
        console.log(hashHex);
        process.exit(0);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        cmdLogger.error({ error: msg }, 'Failed to compute keccak256 hash');
        process.exit(1);
      }
    });
}
