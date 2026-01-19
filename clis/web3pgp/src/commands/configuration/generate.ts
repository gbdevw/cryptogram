import fs from 'fs';
import { Command } from 'commander';
import { Logger } from 'pino';

/**
 * Generate a template configuration file for test environment
 */
export function generateConfigTemplate(environment: 'test' | 'prod' = 'test'): string {
  if (environment === 'test') {
    return `# Web3PGP CLI Configuration - TEST Environment
# Location: ~/.web3pgp/config.yaml
# 
# This file configures the Web3PGP CLI for the TEST environment.
# You can override any value using:
# - Environment variables (DEXES_* prefix)
# - Command-line flags
#
# Environment variables take precedence over this file.
# CLI flags take precedence over environment variables.

ethereum:
  # Blockchain network configuration
  # Using Ink Sepolia testnet
  chain: ink-sepolia  # or use numeric ID: 763373

  # RPC endpoint configuration
  # Multiple endpoints with fallback support and per-endpoint batching configuration
  rpc:
    # Array of RPC endpoints with priority-based failover
    # Lower priority number = higher priority (1 is highest)
    endpoints:
      # Primary RPC endpoint - Gelato
      - url: https://rpc-gel-sepolia.inkonchain.com
        priority: 1
        batching:
          size: 20         # Maximum requests per batch
          waitMs: 100      # Maximum wait time before sending batch in milliseconds
      
      # Backup 1 - Tenderly
      - url: https://rpc-ten-sepolia.inkonchain.com
        priority: 2
        batching:
          size: 20
          waitMs: 100
      
      # Backup 2 - QuickNode
      - url: https://rpc-qnd-sepolia.inkonchain.com
        priority: 3
        batching:
          size: 20
          waitMs: 100
      
      # Backup 3 - dRPC
      - url: https://ink-sepolia.drpc.org
        priority: 4
        batching:
          size: 20
          waitMs: 100

    # Shared retry configuration (applied to all endpoints)
    retry:
      count: 3             # Number of retry attempts
      delayMs: 200         # Delay between retries in milliseconds

    # Maximum block range for eth_getLogs queries
    # Use this value when querying logs to avoid exceeding provider limits
    maxBlockRange: 10000

  # wallet: (OPTIONAL - required only for signing transactions)
  #   # Wallet configuration (currently only 'private-key' is supported)
  #   type: private-key
  #   
  #   # Private key for signing transactions
  #   # WARNING: Store this securely! Better to use the DEXES_WALLET_PRIVATE_KEY env var.
  #   # Support for \${VAR_NAME} syntax: privateKey: "\${DEXES_WALLET_PRIVATE_KEY}"
  #   # privateKey: "<YOUR_PRIVATE_KEY>"

web3pgp:
  # Web3PGP smart contract address (test deployment on Ink Sepolia)
  contract: "0x72d02B94317ac899B34459a4e6685eFe12Ac17a8"

monitoring:
  logging:
    # Log level: debug, info, warn, error
    level: info

# ============================================================================
# ENVIRONMENT VARIABLES
# ============================================================================
# You can override any configuration value using environment variables:
#
# DEXES_CHAIN=ink-sepolia
# DEXES_RPC_ENDPOINTS='[{"url":"...","priority":1,"batching":{"size":100,"waitMs":50}}]'
# DEXES_WALLET_PRIVATE_KEY=<YOUR_PRIVATE_KEY>
# DEXES_WEB3PGP_CONTRACT=<CONTRACT_ADDRESS>
# DEXES_LOG_LEVEL=debug
`;
  } else {
    return `# Web3PGP CLI Configuration - PRODUCTION Environment
# Location: ~/.web3pgp/config.yaml
# 
# This file configures the Web3PGP CLI for the PRODUCTION environment.
# You can override any value using:
# - Environment variables (DEXES_* prefix)
# - Command-line flags
#
# Environment variables take precedence over this file.
# CLI flags take precedence over environment variables.

ethereum:
  # Blockchain network configuration
  # Using Ink mainnet
  chain: ink  # TODO: Update with production chain name/ID

  # RPC endpoint configuration
  rpc:
    endpoints:
      # TODO: Update with production RPC endpoints
      - url: https://rpc.ink.inkonchain.com
        priority: 1
        batching:
          size: 100
          waitMs: 50

    retry:
      count: 3
      delayMs: 500

    maxBlockRange: 10000

  # wallet: (OPTIONAL - required only for signing transactions)
  #   # Wallet configuration (currently only 'private-key' is supported)
  #   type: private-key
  #   
  #   # Private key for signing transactions
  #   # WARNING: Store this securely! Better to use the DEXES_WALLET_PRIVATE_KEY env var.
  #   # Support for \${VAR_NAME} syntax: privateKey: "\${DEXES_WALLET_PRIVATE_KEY}"
  #   # privateKey: "<YOUR_PRIVATE_KEY>"

web3pgp:
  # Web3PGP smart contract address (production deployment)
  # TODO: Update with actual contract address once deployed
  contract: "UNDEFINED"

monitoring:
  logging:
    # Log level: debug, info, warn, error
    level: info

# ============================================================================
# ENVIRONMENT VARIABLES
# ============================================================================
# You can override any configuration value using environment variables:
#
# DEXES_CHAIN=ink
# DEXES_RPC_ENDPOINTS='[{"url":"...","priority":1,"batching":{"size":100,"waitMs":50}}]'
# DEXES_WALLET_PRIVATE_KEY=<YOUR_PRIVATE_KEY>
# DEXES_WEB3PGP_CONTRACT=<CONTRACT_ADDRESS>
# DEXES_LOG_LEVEL=info
`;
  }
}

export interface ConfigGenerateCommandDeps {
  logger: Logger;
}

/**
 * Create the 'configuration generate' command
 */
export function createConfigGenerateCommand(deps: ConfigGenerateCommandDeps): Command {
  const { logger } = deps;
  const cmdLogger = logger.child({ command: 'generate' });

  return new Command('generate')
    .description('Generate a template configuration file')
    .argument('[environment]', 'Environment: test or prod (default: test)', 'test')
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .action(async (environment: string, options: { output?: string }) => {
      try {
        // Validate environment argument
        if (!['test', 'prod'].includes(environment)) {
          throw new Error(`Invalid environment: ${environment}. Must be 'test' or 'prod'.`);
        }

        cmdLogger.info({ environment }, 'Generating config template');
        const template = generateConfigTemplate(environment as 'test' | 'prod');

        if (options.output) {
          fs.writeFileSync(options.output, template);
          cmdLogger.info({ path: options.output, environment }, 'Config template written');
          console.log(`Configuration template written to ${options.output} (${environment} environment)`);
        } else {
          console.log(template);
        }
        process.exit(0);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        cmdLogger.error({ error: msg }, 'Failed to generate config');
        process.exit(2);
      }
    });
}
