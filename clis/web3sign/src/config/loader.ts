import fs from 'fs';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import { ConfigError } from '../errors';
import { DEFAULT_CONFIG } from './defaults';
import { validateYamlStructure } from './validator';
import { MergedConfig, WalletType } from './types';

export interface LoadConfigOptions {
  configPath?: string; // Custom config file path or uses ~/.web3pgp/config.yaml
  envVars?: Record<string, string>; // Environment variables (defaults to process.env)
  cliFlags?: Partial<MergedConfig>; // CLI flags override
}

/**
 * Expand environment variables in string values
 * Supports ${VAR_NAME} syntax
 */
function expandEnvVars(value: string, env: Record<string, string | undefined>): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
    return env[varName] || `\${${varName}}`;
  });
}

/**
 * Recursively expand environment variables in an object
 */
function expandEnvVarsInObject(
  obj: unknown,
  env: Record<string, string | undefined>
): unknown {
  if (typeof obj === 'string') {
    return expandEnvVars(obj, env);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => expandEnvVarsInObject(item, env));
  }
  if (obj !== null && typeof obj === 'object') {
    const expanded: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      expanded[key] = expandEnvVarsInObject(value, env);
    }
    return expanded;
  }
  return obj;
}

/**
 * Load configuration file from path
 */
function loadConfigFile(filePath: string): Record<string, unknown> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseYaml(content);
    return parsed || {};
  } catch (error) {
    // Check if it's a file not found error
    if (
      error instanceof Error &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).code === 'ENOENT'
    ) {
      return {}; // File doesn't exist, return empty config
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigError(`Failed to load config file ${filePath}: ${message}`);
  }
}

/**
 * Load configuration from environment variables
 * Supports DEXES_* prefix
 */
function loadEnvVarsConfig(env: Record<string, string | undefined>): Partial<MergedConfig> {
  const config: Record<string, unknown> = {};

  // DEXES_CHAIN (well-known chain name or numeric chain ID)
  if (env.DEXES_CHAIN) {
    if (!config.ethereum) config.ethereum = {};
    // Try to parse as number, otherwise treat as string
    const chainValue = isNaN(Number(env.DEXES_CHAIN))
      ? env.DEXES_CHAIN
      : Number(env.DEXES_CHAIN);
    (config.ethereum as Record<string, unknown>).chain = chainValue;
  }

  // Legacy: DEXES_CHAIN_ID (numeric only, converts to number)
  if (env.DEXES_CHAIN_ID) {
    if (!config.ethereum) config.ethereum = {};
    (config.ethereum as Record<string, unknown>).chain = parseInt(
      env.DEXES_CHAIN_ID,
      10
    );
  }

  // DEXES_RPC_URL (single endpoint override)
  if (env.DEXES_RPC_URL) {
    if (!config.ethereum) config.ethereum = {};
    if (!(config.ethereum as Record<string, unknown>).rpc) {
      (config.ethereum as Record<string, unknown>).rpc = {};
    }
    ((config.ethereum as Record<string, unknown>).rpc as Record<string, unknown>).endpoints =
      [{ url: env.DEXES_RPC_URL, priority: 1 }];
  }

  // DEXES_RPC_ENDPOINTS (JSON array)
  if (env.DEXES_RPC_ENDPOINTS) {
    try {
      if (!config.ethereum) config.ethereum = {};
      if (!(config.ethereum as Record<string, unknown>).rpc) {
        (config.ethereum as Record<string, unknown>).rpc = {};
      }
      ((config.ethereum as Record<string, unknown>).rpc as Record<string, unknown>).endpoints =
        JSON.parse(env.DEXES_RPC_ENDPOINTS);
    } catch (error) {
      throw new ConfigError(`Failed to parse DEXES_RPC_ENDPOINTS: ${error}`);
    }
  }

  // DEXES_WALLET_PRIVATE_KEY
  if (env.DEXES_WALLET_PRIVATE_KEY) {
    if (!config.ethereum) config.ethereum = {};
    if (!(config.ethereum as Record<string, unknown>).wallet) {
      (config.ethereum as Record<string, unknown>).wallet = {};
    }
    ((config.ethereum as Record<string, unknown>).wallet as Record<string, unknown>).privateKey =
      env.DEXES_WALLET_PRIVATE_KEY;
  }

  // DEXES_WEB3PGP_CONTRACT
  if (env.DEXES_WEB3PGP_CONTRACT) {
    if (!config.web3pgp) config.web3pgp = {};
    (config.web3pgp as Record<string, unknown>).contract =
      env.DEXES_WEB3PGP_CONTRACT;
  }

  // DEXES_WEB3DOC_CONTRACT
  if (env.DEXES_WEB3DOC_CONTRACT) {
    if (!config.web3sign) config.web3sign = {};
    (config.web3sign as Record<string, unknown>).contract =
      env.DEXES_WEB3DOC_CONTRACT;
  }

  // DEXES_LOG_LEVEL
  if (env.DEXES_LOG_LEVEL) {
    if (!config.monitoring) config.monitoring = {};
    if (!(config.monitoring as Record<string, unknown>).logging) {
      (config.monitoring as Record<string, unknown>).logging = {};
    }
    ((config.monitoring as Record<string, unknown>).logging as Record<string, unknown>).level =
      env.DEXES_LOG_LEVEL;
  }

  return config as Partial<MergedConfig>;
}

/**
 * Deep merge configuration objects
 * Later values override earlier ones
 */
function mergeConfigs(...configs: Partial<MergedConfig>[]): MergedConfig {
  const result = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as MergedConfig;

  for (const config of configs) {
    if (!config) continue;

    // Merge ethereum config
    if (config.ethereum) {
      if (config.ethereum.chain !== undefined) {
        result.ethereum.chain = config.ethereum.chain;
      }
      if (config.ethereum.rpc?.endpoints) {
        result.ethereum.rpc = { endpoints: config.ethereum.rpc.endpoints };
      }
      if (config.ethereum.wallet) {
        // Wallet can be completely replaced if provided
        result.ethereum.wallet = {
          type: config.ethereum.wallet.type || result.ethereum.wallet?.type || WalletType.PrivateKey,
          privateKey: config.ethereum.wallet.privateKey,
        };
      }
    }

    // Merge web3pgp config
    if (config.web3pgp?.contract) {
      result.web3pgp.contract = config.web3pgp.contract;
    }

    // Merge web3sign config
    if (config.web3sign?.contract) {
      result.web3sign.contract = config.web3sign.contract;
    }

    // Merge monitoring config
    if (config.monitoring?.logging?.level) {
      result.monitoring.logging.level = config.monitoring.logging.level;
    }
  }

  return result;
}

/**
 * Load configuration from all sources with 3-tier precedence:
 * Defaults < Config File < Environment Variables < CLI Flags
 */
export function loadConfig(options: LoadConfigOptions = {}): MergedConfig {
  const env = options.envVars || process.env;

  // Step 1: Start with defaults
  const defaults = DEFAULT_CONFIG;

  // Step 2: Load config file
  const configPath =
    options.configPath || path.join(process.env.HOME || '~', '.web3sign', 'config.yaml');
  const fileConfig = fs.existsSync(configPath) ? loadConfigFile(configPath) : {};

  // Expand environment variables in file config
  const expandedFileConfig = expandEnvVarsInObject(fileConfig, env) as Partial<MergedConfig>;

  // Validate file config structure if it exists
  if (Object.keys(fileConfig).length > 0) {
    validateYamlStructure(expandedFileConfig);
  }

  // Step 3: Load environment variables
  const envConfig = loadEnvVarsConfig(env);

  // Step 4: Merge with CLI flags (if provided)
  const merged = mergeConfigs(
    defaults,
    expandedFileConfig as Partial<MergedConfig>,
    envConfig,
    options.cliFlags || {}
  );

  return merged;
}
