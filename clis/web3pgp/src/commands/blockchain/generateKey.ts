import { Command } from 'commander';
import { Logger } from 'pino';
import { privateKeyToAccount } from 'viem/accounts';
import { generatePrivateKey } from 'viem/accounts';
import { exitWithError } from '../factory';

export interface GenerateKeyDeps {
  logger: Logger;
}

export function createGenerateKeyCommand(deps: GenerateKeyDeps): Command {
  const { logger } = deps;
  const cmdLogger = logger.child({ command: 'generate-key' });

  return new Command('generate-key')
    .description('Generate a new Ethereum private key and display the private key and address')
    .action(async () => {
      try {
        cmdLogger.info('Generating new Ethereum key');

        // Generate a random private key
        const privateKey = generatePrivateKey();

        // Derive the account/address from the private key
        const account = privateKeyToAccount(privateKey);

        // Output the key and address in hex format
        const output = {
          privateKey: privateKey,
          address: account.address,
        };

        cmdLogger.info({ address: account.address }, 'Key generated');
        console.log(JSON.stringify(output, null, 2));

        process.exit(0);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        cmdLogger.error({ error: msg }, 'Failed to generate key');
        exitWithError(msg);
      }
    });
}
