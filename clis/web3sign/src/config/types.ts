/**
 * Configuration type definitions
 */

import { Address, LogLevel } from '../types';

export enum WalletType {
  PrivateKey = 'private-key', // pragma: allowlist secret
}

/**
 * RPC endpoint configuration
 * @property url - The RPC endpoint URL
 * @property priority - Priority for selecting this endpoint (lower is higher priority)
 * @property batching - Optional batching configuration
 */
export interface RpcEndpoint {
  url: string;
  priority: number;
  batching? : BatchingConfig;
}

/**
 * Batching configuration for RPC requests
 * @property size - Maximum number of requests to batch together
 * @property waitMs - Maximum time to wait before sending a batch in milliseconds
 */
export interface BatchingConfig {
  size?: number;
  waitMs?: number;
}

/**
 * Retry configuration for RPC requests
 * @property count - Number of retry attempts
 * @property delayMs - Delay between retries in milliseconds with an exponential backoff
 */
export interface RetryConfig {
  count?: number;
  delayMs?: number;
}

/**
 * Either a well-known Viem chain name or a custom chain ID number.
 * Viem chains: mainnet, sepolia, anvil, ink-sepolia, etc.
 * Custom: numeric chain ID
 */
export type ChainConfig = 'mainnet' | 'sepolia' | 'anvil' | 'ink-sepolia' | number;

export interface EthereumConfig {
  chain: ChainConfig; // Well-known Viem chain name OR custom numeric chainId
  rpc?: {
    endpoints: RpcEndpoint[];
    maxBlockRange?: number;
    retry?: RetryConfig;
  };
  wallet?: {
    type: WalletType;
    privateKey?: `0x${string}`; // pragma: allowlist secret
  };
}

export interface Web3PGPConfig {
  contract: Address;
}

export interface Web3SignConfig {
  contract: Address;
}

export interface MonitoringConfig {
  logging: {
    level: LogLevel;
  };
}

export interface MergedConfig {
  ethereum: EthereumConfig;
  web3pgp: Web3PGPConfig;
  web3sign: Web3SignConfig;
  monitoring: MonitoringConfig;
}
