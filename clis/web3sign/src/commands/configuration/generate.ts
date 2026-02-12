import fs from 'fs';
import { Command } from 'commander';
import { Logger } from 'pino';

/**
 * Generate a template configuration file for test environment
 */
export function generateConfigTemplate(environment: 'test' | 'prod' = 'test'): string {
  if (environment === 'test') {
    return `# Web3Sign CLI Configuration - TEST Environment
# Location: ~/.web3sign/config.yaml
# 
# This file configures the Web3Sign CLI for the TEST environment.
# You can override any value using:
# - Environment variables (DEXES_* prefix)
# - Command-line flags
#
# Environment variables take precedence over this file.
# CLI flags take precedence over environment variables.

ethereum:
  # Blockchain network configuration
  # Using Sepolia testnet
  chain: sepolia  # or use numeric ID: 11155111

  # RPC endpoint configuration with batching and failover
  rpc:
    endpoints:
      # Primary RPC endpoint with batching configuration
      - url: "https://ethereum-sepolia-rpc.publicnode.com"
        priority: 1
        batching:
          size: 20    # Maximum requests per batch
          waitMs: 100 # Wait time before sending batch
      # Secondary RPC endpoints for failover
      - url: "https://sepolia.gateway.tenderly.co"
        priority: 2
        batching:
          size: 20
          waitMs: 100
      - url: "https://sepolia.drpc.org"
        priority: 3
        batching:
          size: 20
          waitMs: 100
      - url: "https://1rpc.io/sepolia"
        priority: 4
        batching:
          size: 20
          waitMs: 100
    # Maximum block range for queries
    maxBlockRange: 10000
    # Retry configuration for failed requests
    retry:
      count: 3      # Number of retry attempts
      delayMs: 200  # Delay between retries

  # wallet: (OPTIONAL - required only for signing transactions)
  #   # Wallet configuration (currently only 'private-key' is supported)
  #   type: private-key
  #   
  #   # Private key for signing transactions
  #   # WARNING: Store this securely! Better to use the DEXES_WALLET_PRIVATE_KEY env var.
  #   # Support for \${VAR_NAME} syntax: privateKey: "\${DEXES_WALLET_PRIVATE_KEY}"
  #   # privateKey: "<YOUR_PRIVATE_KEY>"

web3pgp:
  # Web3PGP smart contract address (test deployment)
  contract: "0x82733B49e65A2FE6B611e5CE454AC21237071638"

web3sign:
  # Web3Sign smart contract address (test deployment)
  contract: "0x6f81441691340Bcf41b7eC323b6E74645820389E"

monitoring:
  logging:
    # Log level: debug, info, warn, error
    level: info

# ============================================================================
# ENVIRONMENT VARIABLES
# ============================================================================
# You can override any configuration value using environment variables:
#
# DEXES_CHAIN=sepolia  # or numeric ID: DEXES_CHAIN_ID=11155111
# DEXES_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com  # Single RPC endpoint override
# DEXES_RPC_ENDPOINTS='[{"url":"https://rpc.example.com","priority":1}]'  # JSON array of endpoints
# DEXES_WALLET_PRIVATE_KEY=<YOUR_PRIVATE_KEY>
# DEXES_WEB3PGP_CONTRACT=<CONTRACT_ADDRESS>
# DEXES_WEB3SIGN_CONTRACT=<CONTRACT_ADDRESS>
# DEXES_LOG_LEVEL=debug
`;
  } else {
    return `# Web3Sign CLI Configuration - PRODUCTION Environment
# Location: ~/.web3sign/config.yaml
# 
# This file configures the Web3Sign CLI for the PRODUCTION environment.
# You can override any value using:
# - Environment variables (DEXES_* prefix)
# - Command-line flags
#
# Environment variables take precedence over this file.
# CLI flags take precedence over environment variables.

ethereum:
  # Blockchain network configuration
  # Using Ink mainnet
  chain: ink

  # RPC endpoint configuration with batching and failover
  rpc:
    endpoints:
      # Primary RPC endpoint with batching configuration
      - url: "https://rpc-gel.inkonchain.com"
        priority: 1
        batching:
          size: 20    # Maximum requests per batch
          waitMs: 100 # Wait time before sending batch
      # Secondary RPC endpoints for failover
      - url: "https://rpc-ten.inkonchain.com"
        priority: 2
        batching:
          size: 20
          waitMs: 100
      - url: "https://rpc-qnd.inkonchain.com"
        priority: 3
        batching:
          size: 20
          waitMs: 100
      - url: "https://ink.drpc.org"
        priority: 4
        batching:
          size: 20
          waitMs: 100
    # Maximum block range for queries
    maxBlockRange: 10000
    # Retry configuration for failed requests
    retry:
      count: 3      # Number of retry attempts
      delayMs: 200  # Delay between retries

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

web3sign:
  # Web3Sign smart contract address (production deployment)
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
# DEXES_CHAIN=ink  # or numeric ID: DEXES_CHAIN_ID=<CHAIN_ID>
# DEXES_RPC_URL=https://rpc-gel.inkonchain.com  # Single RPC endpoint override
# DEXES_RPC_ENDPOINTS='[{"url":"https://rpc.example.com","priority":1}]'  # JSON array of endpoints
# DEXES_WALLET_PRIVATE_KEY=<YOUR_PRIVATE_KEY>
# DEXES_WEB3PGP_CONTRACT=<CONTRACT_ADDRESS>
# DEXES_WEB3SIGN_CONTRACT=<CONTRACT_ADDRESS>
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
