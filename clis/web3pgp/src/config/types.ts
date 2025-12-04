/**
 * Configuration type definitions
 */

import { ChainId, EthereumAddress, LogLevel } from '../types';

export enum WalletType {
  PrivateKey = 'private-key', // pragma: allowlist secret
}

export interface RpcEndpoint {
  url: string;
  priority: number;
}

export interface EthereumConfig {
  chainId: ChainId;
  rpc: {
    endpoints: RpcEndpoint[];
  };
  wallet: {
    type: WalletType;
    privateKey?: `0x${string}`; // pragma: allowlist secret
  };
}

export interface Web3PGPConfig {
  contract: EthereumAddress;
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
