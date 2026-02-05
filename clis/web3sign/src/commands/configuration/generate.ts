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
  # Using Ink Sepolia testnet
  chain: ink-sepolia  # or use numeric ID: 763373

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
  contract: "0x72d02B94317ac899B34459a4e6685eFe12Ac17a8"

web3sign:
  # Web3Sign smart contract address (test deployment)
  contract: "0x5C09E831276ADCec4D5C94645F34500D3deA8E8A"

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
# DEXES_WALLET_PRIVATE_KEY=<YOUR_PRIVATE_KEY>
# DEXES_WEB3PGP_CONTRACT=<CONTRACT_ADDRESS>
# DEXES_WEB3DOC_CONTRACT=<CONTRACT_ADDRESS>
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
# DEXES_CHAIN_ID=<CHAIN_ID>
# DEXES_WALLET_PRIVATE_KEY=<YOUR_PRIVATE_KEY>
# DEXES_WEB3PGP_CONTRACT=<CONTRACT_ADDRESS>
# DEXES_WEB3DOC_CONTRACT=<CONTRACT_ADDRESS>
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
