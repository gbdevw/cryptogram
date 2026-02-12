import { MergedConfig, WalletType } from './types';

/**
 * Default configuration for Web3Sign CLI
 * Uses Ink Sepolia testnet as the default network
 */
export const TESTNET_CONFIG: MergedConfig = {
  ethereum: {
    chain: 'sepolia',
    rpc: {
      endpoints: [
        { url: 'https://ethereum-sepolia-rpc.publicnode.com', priority: 1, batching: { size: 20, waitMs: 100 } },
        { url: 'https://sepolia.gateway.tenderly.co', priority: 2, batching: { size: 20, waitMs: 100 } },
        { url: 'https://sepolia.drpc.org', priority: 3, batching: { size: 20, waitMs: 100 } },
        { url: 'https://1rpc.io/sepolia', priority: 4,  batching: { size: 20, waitMs: 100 } },
      ],
      maxBlockRange: 10000,
      retry: { count: 3, delayMs: 200 },
    },
    wallet: { type: WalletType.PrivateKey },
  },
  web3pgp: { contract: '0x82733B49e65A2FE6B611e5CE454AC21237071638' as const },
  web3sign: { contract: '0x6f81441691340Bcf41b7eC323b6E74645820389E' as const },
  monitoring: { logging: { level: 'info' } },
};