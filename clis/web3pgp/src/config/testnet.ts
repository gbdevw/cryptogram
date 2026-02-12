import { MergedConfig, WalletType } from './types';

/**
 * Configuration for Web3PGP CLI targeting the Sepolia testnet
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
  monitoring: { logging: { level: 'info' } },
};