import fs from 'fs';
import { Logger } from 'pino';

/**
 * Generate a template configuration file with comments
 */
export function generateConfigTemplate(): string {
  return `# Web3PGP CLI Configuration
# Location: ~/.web3pgp/config.yaml
# 
# This file configures the Web3PGP CLI. You can override any value using:
# - Environment variables (DEXES_* prefix)
# - Command-line flags
#
# Environment variables take precedence over this file.
# CLI flags take precedence over environment variables.

ethereum:
  # Blockchain network configuration
  # Use a well-known chain name (mainnet, sepolia, anvil, ink-sepolia)
  # or a custom numeric chain ID
  chain: ink-sepolia  # or use numeric ID: 763373
  
  rpc:
    # RPC endpoints to use (in priority order)
    # The CLI will use the first endpoint; if it fails, it falls back to the next
    # For well-known chains, this is optional if default endpoints are available
    endpoints:
      - url: https://rpc-gel-sepolia.inkonchain.com
        priority: 1
      - url: https://rpc-qnd-sepolia.inkonchain.com
        priority: 2
  
  wallet:
    # Wallet configuration (currently only 'private-key' is supported)
    type: private-key
    
    # Private key for signing transactions
    # WARNING: Store this securely! Better to use the DEXES_WALLET_PRIVATE_KEY env var.
    # Support for \${VAR_NAME} syntax: privateKey: "\${DEXES_WALLET_PRIVATE_KEY}"
    # privateKey: "<YOUR_PRIVATE_KEY>"

web3pgp:
  # Web3PGP smart contract address
  contract: "<CONTRACT_ADDRESS>"

monitoring:
  logging:
    # Log level: debug, info, warn, error
    level: info

# ============================================================================
# ENVIRONMENT VARIABLES
# ============================================================================
# You can override any configuration value using environment variables:
#
# DEXES_CHAIN_ID=763373
# DEXES_RPC_URL=https://rpc-gel-sepolia.inkonchain.com
# DEXES_RPC_ENDPOINTS='[{"url":"https://rpc-gel-sepolia.inkonchain.com","priority":1}]'
# DEXES_WALLET_PRIVATE_KEY=<YOUR_PRIVATE_KEY>
# DEXES_WEB3PGP_CONTRACT=<CONTRACT_ADDRESS>
# DEXES_LOG_LEVEL=debug
`;
}

export interface ConfigGenerateCommandDeps {
  logger: Logger;
}

/**
 * Create the 'configuration generate' command
 */
export function createConfigGenerateCommand(deps: ConfigGenerateCommandDeps) {
  const { logger } = deps;
  const cmdLogger = logger.child({ command: 'configuration.generate' });

  return {
    description: 'Generate a template configuration file',
    options: [['--output, -o <path>', 'Output file path (default: stdout)']],
    async action(options: Record<string, string | boolean | undefined>) {
      try {
        cmdLogger.info('Generating config template');
        const template = generateConfigTemplate();

        if (options.output) {
          fs.writeFileSync(options.output as string, template);
          cmdLogger.info({ path: options.output }, 'Config template written');
          console.log(`Configuration template written to ${options.output}`);
        } else {
          console.log(template);
        }
      } catch (error) {
        cmdLogger.error({ error }, 'Failed to generate config');
        process.exit(2);
      }
    },
  };
}
