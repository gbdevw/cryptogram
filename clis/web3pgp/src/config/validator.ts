import { parse as parseYaml } from 'yaml';
import { ConfigError } from '../errors';
import { WalletType } from './types';

/**
 * Validate that YAML content is well-formed and can be parsed
 */
export function validateYamlFormat(content: string): boolean {
  try {
    parseYaml(content);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new ConfigError(`Invalid YAML format: ${message}`);
  }
}

/**
 * Validate that parsed YAML structure matches expected shape
 * This is format validation only - no semantic validation
 */
export function validateYamlStructure(data: unknown): void {
  if (!data || typeof data !== 'object') {
    throw new ConfigError('Configuration must be an object');
  }

  const config = data as Record<string, unknown>;

  // Check top-level required keys
  if (!config.ethereum) {
    throw new ConfigError('Missing required field: ethereum');
  }
  if (!config.web3pgp) {
    throw new ConfigError('Missing required field: web3pgp');
  }
  if (!config.monitoring) {
    throw new ConfigError('Missing required field: monitoring');
  }

  // Validate ethereum section
  const ethereum = config.ethereum;
  if (typeof ethereum !== 'object' || ethereum === null) {
    throw new ConfigError('ethereum must be an object');
  }
  if (!('chain' in ethereum)) {
    throw new ConfigError('Missing required field: ethereum.chain');
  }
  if (!('wallet' in ethereum)) {
    throw new ConfigError('Missing required field: ethereum.wallet');
  }

  // Validate rpc section (optional)
  const rpc = (ethereum as Record<string, unknown>).rpc;
  if (rpc !== undefined) {
    if (typeof rpc !== 'object' || rpc === null) {
      throw new ConfigError('ethereum.rpc must be an object');
    }
    if (!('endpoints' in rpc)) {
    throw new ConfigError('Missing required field: ethereum.rpc.endpoints');
  }
  if (!Array.isArray((rpc as Record<string, unknown>).endpoints)) {
    throw new ConfigError('ethereum.rpc.endpoints must be an array');
  }

  // Validate endpoints array structure
  const endpoints = (rpc as Record<string, unknown>).endpoints as unknown[];
  for (let i = 0; i < endpoints.length; i++) {
    const ep = endpoints[i];
    if (!ep || typeof ep !== 'object') {
      throw new ConfigError(`ethereum.rpc.endpoints[${i}] must be an object`);
    }
    if (!('url' in (ep as Record<string, unknown>))) {
      throw new ConfigError(`Missing required field: ethereum.rpc.endpoints[${i}].url`);
    }
    if (!('priority' in (ep as Record<string, unknown>))) {
      throw new ConfigError(`Missing required field: ethereum.rpc.endpoints[${i}].priority`);
    }
  }
  }

  // Validate wallet section
  const wallet = (ethereum as Record<string, unknown>).wallet;
  if (typeof wallet !== 'object' || wallet === null) {
    throw new ConfigError('ethereum.wallet must be an object');
  }
  if (!('type' in wallet)) {
    throw new ConfigError('Missing required field: ethereum.wallet.type');
  }
  const walletType = (wallet as Record<string, unknown>).type;
  if (walletType !== WalletType.PrivateKey) {
    throw new ConfigError(
      `ethereum.wallet.type must be '${WalletType.PrivateKey}', got '${walletType}'`
    );
  }

  // Validate web3pgp section
  const web3pgp = config.web3pgp;
  if (typeof web3pgp !== 'object' || web3pgp === null) {
    throw new ConfigError('web3pgp must be an object');
  }
  if (!('contract' in web3pgp)) {
    throw new ConfigError('Missing required field: web3pgp.contract');
  }

  // Validate monitoring section
  const monitoring = config.monitoring;
  if (typeof monitoring !== 'object' || monitoring === null) {
    throw new ConfigError('monitoring must be an object');
  }
  if (!('logging' in monitoring)) {
    throw new ConfigError('Missing required field: monitoring.logging');
  }

  // Validate logging section
  const logging = (monitoring as Record<string, unknown>).logging;
  if (typeof logging !== 'object' || logging === null) {
    throw new ConfigError('monitoring.logging must be an object');
  }
  if (!('level' in logging)) {
    throw new ConfigError('Missing required field: monitoring.logging.level');
  }
}

/**
 * Full YAML format validation (parse + structure check)
 */
export function validateConfigFormat(content: string): void {
  validateYamlFormat(content);
  const parsed = parseYaml(content);
  validateYamlStructure(parsed);
}
