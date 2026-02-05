import { MergedConfig, WalletType } from './types';

/**
 * Default configuration for Web3Sign CLI
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
  web3pgp: { contract: '0x72d02B94317ac899B34459a4e6685eFe12Ac17a8' as const },
  web3sign: { contract: '0x5C09E831276ADCec4D5C94645F34500D3deA8E8A' as const },
  monitoring: { logging: { level: 'info' } },
};
