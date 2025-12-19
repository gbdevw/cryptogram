/**
 * Configuration type definitions
 */
import { Address } from 'viem';
import { LogLevel } from '../types';

export enum WalletType {
  PrivateKey = 'private-key', // pragma: allowlist secret
}

export interface RpcEndpoint {
  url: string;
  priority: number;
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
  };
  wallet?: {
    type: WalletType;
    privateKey?: `0x${string}`; // pragma: allowlist secret
  };
  gasLimit?: bigint; // Optional: explicitly set gas limit (for testing). If undefined, Viem estimates automatically.
}

export interface Web3PGPConfig {
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
  monitoring: MonitoringConfig;
}
