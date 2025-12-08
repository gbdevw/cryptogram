import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { Logger } from 'pino';
import { validateConfigFormat } from '../../config/validator';

export interface ConfigValidateCommandDeps {
  logger: Logger;
}

/**
 * Create the 'configuration validate' command
 */
export function createConfigValidateCommand(deps: ConfigValidateCommandDeps): Command {
  const { logger } = deps;
  const cmdLogger = logger.child({ command: 'configuration.validate' });

  return new Command('validate')
    .description('Validate configuration file format')
    .option('--config <path>', 'Config file path (default: ~/.web3pgp/config.yaml)')
    .action((options: { config?: string }) => {
      try {
        const configPath =
          options.config || path.join(process.env.HOME || '~', '.web3pgp', 'config.yaml');

        cmdLogger.info({ path: configPath }, 'Validating config file');

        // Check if file exists
        if (!fs.existsSync(configPath)) {
          cmdLogger.error({ path: configPath }, 'Config file not found');
          console.error(`Error: Config file not found at ${configPath}`);
          process.exit(2);
        }

        // Read and validate
        const content = fs.readFileSync(configPath, 'utf-8');
        validateConfigFormat(content);

        cmdLogger.info({ path: configPath }, 'Config file is valid');
        console.log(`✓ Configuration file is valid: ${configPath}`);
        process.exit(0);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        cmdLogger.error({ error: message }, 'Config validation failed');
        console.error(`Error: ${message}`);
        process.exit(2);
      }
    });
}
