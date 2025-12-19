import { MergedConfig, WalletType } from './types';

/**
 * Default configuration for Web3Doc CLI
 * Uses Ink Sepolia testnet as the default network
 */
export const DEFAULT_CONFIG: MergedConfig = {
  ethereum: {
    chain: 'ink-sepolia',
    rpc: {
      endpoints: [
        { url: 'https://rpc-gel-sepolia.inkonchain.com', priority: 1 },
        { url: 'https://rpc-qnd-sepolia.inkonchain.com', priority: 2 },
      ],
    },
    wallet: { type: WalletType.PrivateKey },
  },
  web3doc: { contract: '0x9fE46736679d2D348b2D5c56172e27A29dFc5b59' as const },
  monitoring: { logging: { level: 'info' } },
};
