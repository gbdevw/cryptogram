import { MergedConfig, WalletType } from './types';

/**
 * Configuration for Web3PGP CLI targeting the Ink Sepolia testnet
 */
export const TESTNET_CONFIG: MergedConfig = {
  ethereum: {
    chain: 'ink-sepolia',
    rpc: {
      endpoints: [
        { url: 'https://rpc-gel-sepolia.inkonchain.com', priority: 1, batching: { size: 20, waitMs: 100 } },
        { url: 'https://rpc-ten-sepolia.inkonchain.com', priority: 2, batching: { size: 20, waitMs: 100 } },
        { url: 'https://rpc-qnd-sepolia.inkonchain.com', priority: 3, batching: { size: 20, waitMs: 100 } },
        { url: 'https://ink-sepolia.drpc.org', priority: 4,  batching: { size: 20, waitMs: 100 } },
      ],
      maxBlockRange: 10000,
      retry: { count: 3, delayMs: 200 },
    },
    wallet: { type: WalletType.PrivateKey },
  },
  web3pgp: { contract: '0x72d02B94317ac899B34459a4e6685eFe12Ac17a8' as const },
  monitoring: { logging: { level: 'info' } },
};