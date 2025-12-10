import { Command } from 'commander';
import { createRootLogger } from './utils/logger';
import { loadConfig } from './config/loader';
import { createWeb3PGPService } from './services/web3pgpServiceFactory';
import { createBlockchainCommands } from './commands/blockchain';
import { createConfigurationCommands } from './commands/configuration';
import { ConfigError } from './errors';

async function main(): Promise<void> {
  // Load config first to get logging level
  // Extract --config option if provided
  let configPath: string | undefined;
  const configIndex = process.argv.indexOf('--config');
  if (configIndex > -1 && configIndex + 1 < process.argv.length) {
    configPath = process.argv[configIndex + 1];
  }

  const config = loadConfig({ configPath });
  const logger = createRootLogger(config.monitoring.logging.level);
  const rootLogger = logger.child({ component: 'cli' });

  try {
    // Check if user is asking for help or version before loading config
    const isHelp = process.argv.includes('--help') || process.argv.includes('-h');
    const isVersion = process.argv.includes('--version') || process.argv.includes('-v');

    rootLogger.debug('Web3PGP CLI starting');

    rootLogger.debug('Configuration loaded');

    const service = await createWeb3PGPService(config, logger);
    rootLogger.debug('Web3PGP service initialized');

    const program = new Command()
      .name('web3pgp')
      .version('0.1.0', '-v, --version')
      .description('Web3PGP CLI - Decentralized OpenPGP key infrastructure on Ethereum')
      .helpOption('-h, --help', 'Show help');

    const blockchainCommands = createBlockchainCommands({ logger, service });
    const configurationCommands = createConfigurationCommands();

    // Add blockchain commands as direct subcommands
    blockchainCommands.forEach(cmd => program.addCommand(cmd));
    
    // Add configuration command as a group
    program.addCommand(configurationCommands);

    program.parse(process.argv);

    if (!process.argv.slice(2).length) {
      program.outputHelp();
    }
  } catch (error) {
    if (error instanceof ConfigError) {
      rootLogger.error({ error: error.message }, 'Configuration error');
      console.error(JSON.stringify({ error: error.message }, null, 2));
      process.exit(2);
    } else {
      const msg = error instanceof Error ? error.message : String(error);
      rootLogger.error({ error: msg }, 'Fatal error');
      console.error(JSON.stringify({ error: msg }, null, 2));
      process.exit(1);
    }
  }
}

main();
