/**
 * Configuration type definitions
 */
import { Address } from 'viem';
import { LogLevel } from '../types';

/**
 * Enumeration of supported wallet types.
 */
export enum WalletType {
  // Use a private key for signing transactions
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

/**
 * Ethereum network configuration
 * @property chain - The chain configuration (well-known name or custom chain ID)
 * @property rpc - Optional RPC endpoints configuration
 * @property wallet - Optional wallet configuration
 */
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

/**
 * Web3PGP contract configuration
 * @property contract - The address of the Web3PGP smart contract
 */
export interface Web3PGPConfig {
  contract: Address;
}

/**
 * Monitoring configuration
 * @property logging - Logging configuration
 */
export interface MonitoringConfig {
  logging: {
    level: LogLevel;
  };
}

/**
 * Merged configuration for the Web3PGP CLI
 * @property ethereum - Ethereum network configuration
 * @property web3pgp - Web3PGP contract configuration
 * @property monitoring - Monitoring configuration
 */
export interface MergedConfig {
  ethereum: EthereumConfig;
  web3pgp: Web3PGPConfig;
  monitoring: MonitoringConfig;
}
