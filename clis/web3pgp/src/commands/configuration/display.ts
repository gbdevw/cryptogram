import { Command } from 'commander';
import { stringify as stringifyYaml } from 'yaml';
import { Logger } from 'pino';
import { loadConfig } from '../../config/loader';
import { MergedConfig } from '../../config/types';

/**
 * Mask sensitive values in configuration
 */
function maskSensitiveData(config: MergedConfig): MergedConfig {
  const masked = JSON.parse(JSON.stringify(config)) as MergedConfig;

  // Mask private key: show only first 4 and last 4 chars
  if (masked.ethereum.wallet?.privateKey) {
    const key = masked.ethereum.wallet.privateKey;
    if (key.length > 8) {
      const start = key.substring(0, 4);
      const end = key.substring(key.length - 4);
      masked.ethereum.wallet.privateKey = `${start}...${end}` as `0x${string}`;
    }
  }

  return masked;
}

export interface ConfigDisplayCommandDeps {
  logger: Logger;
}

/**
 * Create the 'configuration display' command
 */
export function createConfigDisplayCommand(deps: ConfigDisplayCommandDeps): Command {
  const { logger } = deps;
  const cmdLogger = logger.child({ command: 'configuration.display' });

  return new Command('display')
    .description('Display the current configuration (merged from all sources)')
    .option('--show-secrets', 'Show full private key (not masked)')
    .option('--config <path>', 'Custom config file path')
    .action(async (options: { 'show-secrets'?: boolean; config?: string }) => {
      try {
        cmdLogger.info('Loading configuration');

        const config = loadConfig({
          configPath: options.config,
        });

        cmdLogger.info({ chain: config.ethereum.chain }, 'Configuration loaded');

        // Mask sensitive data unless explicitly requested
        const displayConfig = options['show-secrets'] ? config : maskSensitiveData(config);

        // Convert to YAML for display
        const yaml = stringifyYaml(displayConfig, {
          indent: 2,
          lineWidth: 0,
        });

        console.log('# Current Configuration (merged from defaults/file/env/flags)\n');
        console.log(yaml);

        process.exit(0);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        cmdLogger.error({ error: msg }, 'Failed to display config');
        process.exit(2);
      }
    });
}
