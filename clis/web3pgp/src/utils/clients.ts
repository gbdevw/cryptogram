/**
 * Utilities for creating and configuring Viem clients from configuration
 */

import {
  createPublicClient,
  createWalletClient,
  Chain,
  Account,
} from 'viem';
import {
  mainnet,
  sepolia,
  anvil,
} from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { EthereumConfig, ChainConfig } from '../config/types';
import { buildFallbackTransport } from '../config/transport';

/**
 * Resolves a ChainConfig to a Viem Chain object
 *
 * @param chainConfig - Well-known chain name or numeric chain ID
 * @returns Resolved Viem Chain object
 * @throws Error if chain is not recognized
 */
function resolveChain(chainConfig: ChainConfig): Chain {
  // Handle well-known chain names
  if (typeof chainConfig === 'string') {
    switch (chainConfig) {
      case 'mainnet':
        return mainnet;
      case 'sepolia':
        return sepolia;
      case 'anvil':
        return anvil;
      case 'ink-sepolia': {
        // Ink Sepolia testnet configuration
        return {
          id: 763373,
          name: 'Ink Sepolia',
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: {
            default: { http: ['https://rpc-gel-sepolia.inkonchain.com'] },
          },
          blockExplorers: {
            default: { name: 'Explorer', url: 'https://sepolia-explorer.inkonchain.com' },
          },
          testnet: true,
        };
      }
      default:
        throw new Error(
          `Unknown chain name: ${chainConfig}. Supported: mainnet, sepolia, anvil, ink-sepolia`
        );
    }
  }

  // Handle custom numeric chain IDs
  if (typeof chainConfig === 'number') {
    return {
      id: chainConfig,
      name: `Custom Chain ${chainConfig}`,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: [''] },
      },
    };
  }

  throw new Error(`Invalid chain config: ${chainConfig}`);
}

/**
 * Resolves a wallet account from Ethereum configuration
 *
 * @param ethereumConfig - Ethereum configuration containing wallet settings
 * @returns Resolved Account object or undefined if no wallet is configured
 * @throws Error if private key is invalid or not configured
 */
function resolveAccount(ethereumConfig: EthereumConfig): Account | undefined {
  if (!ethereumConfig.wallet) {
    return undefined;
  }

  const { privateKey } = ethereumConfig.wallet;

  if (!privateKey) {
    throw new Error(
      'Wallet is configured but no private key provided. Set privateKey in config or DEXES_WALLET_PRIVATE_KEY env var.'
    );
  }

  // Ensure the private key is in 0x format
  const formattedKey = privateKey.startsWith('0x') ? privateKey : (`0x${privateKey}` as `0x${string}`);

  return privateKeyToAccount(formattedKey);
}

/**
 * Creates a Viem PublicClient configured from Ethereum settings
 *
 * @param ethereumConfig - Ethereum configuration with chain and RPC settings
 * @returns Configured PublicClient instance
 */
export function createPublicClientFromConfig(ethereumConfig: EthereumConfig) {
  const chain = resolveChain(ethereumConfig.chain);
  const transport = buildFallbackTransport(
    ethereumConfig.rpc?.endpoints,
    ethereumConfig.rpc?.retry
  );

  return createPublicClient({
    chain,
    transport,
  });
}

/**
 * Creates a Viem WalletClient configured from Ethereum settings
 *
 * Requires wallet configuration with a valid private key.
 *
 * @param ethereumConfig - Ethereum configuration with chain, RPC, and wallet settings
 * @returns Configured WalletClient instance
 * @throws Error if wallet is not configured or private key is missing
 */
export function createWalletClientFromConfig(ethereumConfig: EthereumConfig) {
  const chain = resolveChain(ethereumConfig.chain);
  const account = resolveAccount(ethereumConfig);

  if (!account) {
    throw new Error(
      'Wallet configuration is required to create a WalletClient. Configure wallet with a private key.'
    );
  }

  const transport = buildFallbackTransport(
    ethereumConfig.rpc?.endpoints,
    ethereumConfig.rpc?.retry
  );

  return createWalletClient({
    account,
    chain,
    transport,
  });
}

/**
 * Creates both PublicClient and WalletClient from Ethereum configuration
 *
 * @param ethereumConfig - Ethereum configuration
 * @returns Object containing both publicClient and walletClient
 * @throws Error if wallet is not configured
 */
export function createClientsFromConfig(ethereumConfig: EthereumConfig): {
  publicClient: ReturnType<typeof createPublicClientFromConfig>;
  walletClient: ReturnType<typeof createWalletClientFromConfig>;
} {
  const publicClient = createPublicClientFromConfig(ethereumConfig);
  const walletClient = createWalletClientFromConfig(ethereumConfig);

  return { publicClient, walletClient };
}
