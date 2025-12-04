import {
  Chain,
  PublicClient,
  WalletClient,
  createPublicClient,
  createWalletClient,
  fallback,
  http,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, sepolia } from 'viem/chains';

import { MergedConfig } from '../config/types';
import { ConfigError } from '../errors';
import { createRootLogger } from '../utils/logger';
import { IWeb3PGPService, Web3PGP, Web3PGPService } from 'dexes';

const logger = createRootLogger();

/**
 * Map of chain IDs to Viem chain objects.
 * Extend this as more networks are supported.
 */
const CHAIN_MAP: Record<number, Chain> = {
  1: mainnet,
  11155111: sepolia, // Ethereum Sepolia
  763373: {
    id: 763373,
    name: 'Ink Sepolia',
    network: 'ink-sepolia',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: {
        http: ['https://rpc-gel-sepolia.inkonchain.com', 'https://rpc-qnd-sepolia.inkonchain.com'],
        webSocket: undefined,
      },
      public: {
        http: ['https://rpc-gel-sepolia.inkonchain.com', 'https://rpc-qnd-sepolia.inkonchain.com'],
        webSocket: undefined,
      },
    },
    blockExplorers: {
      default: {
        name: 'Blockscout',
        url: 'https://sepolia-blockscout.inkonchain.com',
      },
    },
    testnet: true,
  } as Chain,
};

/**
 * Validates private key format.
 * Must be 0x-prefixed hex string with exactly 64 characters (32 bytes).
 */
function validatePrivateKeyFormat(privateKey: string): void {
  if (!privateKey.startsWith('0x')) {
    throw new ConfigError('Private key must start with "0x"');
  }

  if (privateKey.length !== 66) {
    // 0x + 64 hex chars = 66 total
    throw new ConfigError(
      `Private key must be exactly 64 hex characters (32 bytes), got ${privateKey.length - 2}`,
    );
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new ConfigError('Private key must be 0x-prefixed hex string with only 0-9, a-f, A-F characters');
  }
}

/**
 * Get Viem chain object for the given chain ID.
 */
function getChainForId(chainId: number): Chain {
  const chain = CHAIN_MAP[chainId];
  if (!chain) {
    throw new ConfigError(
      `Unsupported chain ID: ${chainId}. Supported chains: ${Object.keys(CHAIN_MAP).join(', ')}`,
    );
  }
  return chain;
}

/**
 * Create Viem PublicClient with RPC endpoint fallback chain.
 * Automatically retries failed RPC calls across all configured endpoints.
 */
function createPublicClientWithFallback(config: MergedConfig): PublicClient {
  const { chainId, rpc } = config.ethereum;
  const chain = getChainForId(chainId);

  if (!rpc.endpoints || rpc.endpoints.length === 0) {
    throw new ConfigError('No RPC endpoints configured in ethereum.rpc.endpoints');
  }

  // Sort endpoints by priority (lower priority value = higher priority)
  const sortedEndpoints = [...rpc.endpoints].sort((a, b) => a.priority - b.priority);

  logger.debug(
    { endpoints: sortedEndpoints.map(e => e.url) },
    'Creating PublicClient with RPC fallback chain',
  );

  // Create fallback transport with all endpoints
  const fallbackTransport = fallback(sortedEndpoints.map(ep => http(ep.url)));

  return createPublicClient({
    chain,
    transport: fallbackTransport,
  });
}

/**
 * Create Viem WalletClient for write operations.
 * Only created if wallet.type is set and privateKey is configured.
 */
function createWalletClientIfConfigured(
  config: MergedConfig,
): WalletClient | undefined {
  const { wallet, chainId } = config.ethereum;

  // Check if wallet configuration exists
  if (!wallet.type) {
    logger.debug('No wallet type configured - read-only mode');
    return undefined;
  }

  // Check if private key is provided
  if (!wallet.privateKey) {
    logger.warn('Wallet type set but private key not configured - read-only mode');
    return undefined;
  }

  // Validate private key format
  validatePrivateKeyFormat(wallet.privateKey);

  // Derive account from private key
  const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);

  logger.debug({ address: account.address }, 'Creating WalletClient with derived account');

  // Create wallet client with chain and primary RPC endpoint
  const chain = getChainForId(chainId);
  const { rpc } = config.ethereum;
  
  if (!rpc.endpoints || rpc.endpoints.length === 0) {
    throw new ConfigError('No RPC endpoints configured in ethereum.rpc.endpoints');
  }

  // Use the primary endpoint for the wallet client
  const primaryEndpoint = [...rpc.endpoints].sort((a, b) => a.priority - b.priority)[0];
  const primaryTransport = http(primaryEndpoint.url);

  const walletClient = createWalletClient({
    account,
    chain,
    transport: primaryTransport,
  });

  return walletClient;
}

/**
 * Create the Web3PGP service from configuration.
 * Orchestrates Viem client setup, contract initialization, and service creation.
 *
 * @param config - Merged configuration with Ethereum and Web3PGP settings
 * @returns Promise resolving to IWeb3PGPService instance
 * @throws ConfigError if configuration is invalid
 */
export async function createWeb3PGPService(config: MergedConfig): Promise<IWeb3PGPService> {
  logger.debug({ chainId: config.ethereum.chainId }, 'Initializing Web3PGP service');

  try {
    // Step 1: Create PublicClient with RPC fallback
    const publicClient = createPublicClientWithFallback(config);

    // Step 2: Create WalletClient if private key configured
    const walletClient = createWalletClientIfConfigured(config);

    // Step 3: Initialize low-level Web3PGP contract wrapper
    const contractAddress = config.web3pgp.contract as `0x${string}`;

    // Validate contract address format
    if (!contractAddress.startsWith('0x') || contractAddress.length !== 42) {
      throw new ConfigError(
        `Invalid contract address format: ${contractAddress}. Must be 0x-prefixed 40 hex characters`,
      );
    }

    logger.debug({ contractAddress }, 'Creating Web3PGP contract wrapper');

    // Create contract instance - pass publicClient, walletClient, and contract address
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const web3pgpContract = new Web3PGP(contractAddress, publicClient as any, walletClient as any);

    // Step 4: Create high-level Web3PGP service
    const service = new Web3PGPService(web3pgpContract);

    logger.info(
      {
        chainId: config.ethereum.chainId,
        contractAddress,
        hasWallet: !!walletClient,
      },
      'Web3PGP service initialized successfully',
    );

    return service;
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error; // Re-throw ConfigError as-is
    }

    // Wrap unexpected errors
    logger.error({ error }, 'Failed to initialize Web3PGP service');
    throw new ConfigError(`Failed to initialize Web3PGP service: ${error instanceof Error ? error.message : String(error)}`);
  }
}
