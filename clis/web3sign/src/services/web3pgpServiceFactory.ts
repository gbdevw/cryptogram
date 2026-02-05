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
import { mainnet, sepolia, foundry, ink, inkSepolia } from 'viem/chains';

import { ChainConfig, MergedConfig } from '../config/types';
import { ConfigError } from '../errors';
import { Logger } from '../utils/logger';
import { IWeb3PGPService, Web3PGP, Web3PGPService } from '@jibidieuw/dexes';

/**
 * Map of well-known Viem chain names to chain objects.
 */
const CHAIN_MAP: Record<string, Chain> = {
  'mainnet': mainnet,
  'sepolia': sepolia,
  'anvil': foundry,
  'ink-sepolia': inkSepolia,
};

/**
 * Map of custom chain IDs to Viem chain objects.
 * Extend this as more networks are supported.
 */
const CHAIN_ID_MAP: Record<number, Chain> = {
  57073: ink,
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
 * Get Viem chain object for the given chain config.
 * If a well-known chain name is provided, use Viem's default.
 * If a numeric chainId is provided, look it up in CHAIN_ID_MAP or create a generic chain.
 */
function getChainForConfig(chainConfig: ChainConfig): Chain {
  if (typeof chainConfig === 'string') {
    const chain = CHAIN_MAP[chainConfig];
    if (chain) {
      return chain;
    }
    throw new ConfigError(`Unsupported chain name: ${chainConfig}`);
  }

  // chainConfig is a number
  const chain = CHAIN_ID_MAP[chainConfig];
  if (chain) {
    return chain;
  }

  // For unsupported chain IDs, create a generic chain object
  // The RPC endpoints from config will be used for actual connections
  return {
    id: chainConfig,
    name: `Chain ${chainConfig}`,
    network: `chain-${chainConfig}`,
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: [], webSocket: undefined },
      public: { http: [], webSocket: undefined },
    },
  } as Chain;
}

/**
 * Resolve RPC endpoints with intelligent fallback.
 * Priority order:
 * 1. User-provided config.ethereum.rpc.endpoints (explicit)
 * 2. Predefined endpoints from the well-known chain
 * 3. Error if chain is unknown and no RPC endpoints provided
 *
 * @param config - Merged configuration
 * @param logger - Logger instance to use for logging
 * @returns Sorted RPC endpoints by priority
 * @throws ConfigError if no endpoints can be resolved
 */
function resolveRpcEndpoints(config: MergedConfig, logger: Logger): Array<{ url: string; priority: number }> {
  const { chain, rpc } = config.ethereum;

  // Priority 1: User-provided endpoints
  if (rpc?.endpoints && rpc.endpoints.length > 0) {
    logger.debug(
      { count: rpc.endpoints.length, endpoints: rpc.endpoints.map(e => e.url) },
      'Using user-provided RPC endpoints',
    );
    return rpc.endpoints;
  }

  // Priority 2: Try to get predefined endpoints from the chain
  if (typeof chain === 'string') {
    const chainObj = CHAIN_MAP[chain];
    if (chainObj?.rpcUrls?.default?.http && chainObj.rpcUrls.default.http.length > 0) {
      const predefinedEndpoints = chainObj.rpcUrls.default.http.map((url, index) => ({
        url,
        priority: index,
      }));
      logger.debug(
        { count: predefinedEndpoints.length, endpoints: predefinedEndpoints.map(e => e.url) },
        'Using predefined RPC endpoints for well-known chain',
      );
      return predefinedEndpoints;
    }
  } else if (typeof chain === 'number') {
    // For numeric chain IDs, check if we have a predefined chain
    const chainObj = CHAIN_ID_MAP[chain];
    if (chainObj?.rpcUrls?.default?.http && chainObj.rpcUrls.default.http.length > 0) {
      const predefinedEndpoints = chainObj.rpcUrls.default.http.map((url, index) => ({
        url,
        priority: index,
      }));
      logger.debug(
        { count: predefinedEndpoints.length, endpoints: predefinedEndpoints.map(e => e.url) },
        'Using predefined RPC endpoints for known chain ID',
      );
      return predefinedEndpoints;
    }
  }

  // No RPC endpoints available
  const chainName = typeof chain === 'string' ? chain : `chain ${chain}`;
  throw new ConfigError(
    `No RPC endpoints available for ${chainName}. ` +
    `Provide endpoints in ethereum.rpc.endpoints or use a well-known chain with predefined RPC endpoints.`,
  );
}

/**
 * Create Viem PublicClient with RPC endpoint fallback chain.
 * Automatically retries failed RPC calls across all configured endpoints.
 * If gasLimit is configured, injects it into simulateContract to skip gas estimation.
 */
function createPublicClientWithFallback(config: MergedConfig, logger: Logger): PublicClient {
  const { chain: chainConfig } = config.ethereum;
  const chainObj = getChainForConfig(chainConfig);

  // Resolve RPC endpoints (user config > predefined defaults > error)
  const rpcEndpoints = resolveRpcEndpoints(config, logger);

  // Sort endpoints by priority (lower priority value = higher priority)
  const sortedEndpoints = [...rpcEndpoints].sort((a, b) => a.priority - b.priority);

  logger.debug(
    { endpoints: sortedEndpoints.map(e => e.url) },
    'Creating PublicClient with RPC fallback chain',
  );

  // Create fallback transport with all endpoints
  const fallbackTransport = fallback(sortedEndpoints.map(ep => http(ep.url)));

  const publicClient = createPublicClient({
    chain: chainObj,
    transport: fallbackTransport,
  });

  return publicClient as PublicClient;
}

/**
 * Create Viem WalletClient for write operations.
 * Only created if wallet.type is set and privateKey is configured.
 */
function createWalletClientIfConfigured(
  config: MergedConfig,
  logger: Logger,
): WalletClient | undefined {
  const { wallet, chain: chainConfig } = config.ethereum;

  // Check if wallet configuration exists
  if (!wallet || !wallet.type) {
    logger.debug('No wallet type configured - read-only mode');
    return undefined;
  }

  // Check if private key is provided
  if (!wallet.privateKey) {
    logger.debug('Wallet type set but private key not configured - read-only mode');
    return undefined;
  }

  // Validate private key format
  validatePrivateKeyFormat(wallet.privateKey);

  // Derive account from private key
  const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);

  logger.debug({ address: account.address }, 'Creating WalletClient with derived account');

  // Create wallet client with chain and primary RPC endpoint
  const chainObj = getChainForConfig(chainConfig);

  // Resolve RPC endpoints (user config > predefined defaults > error)
  const rpcEndpoints = resolveRpcEndpoints(config, logger);

  // Use the primary endpoint for the wallet client
  const sortedEndpoints = [...rpcEndpoints].sort((a, b) => a.priority - b.priority);
  const primaryEndpoint = sortedEndpoints[0];
  const primaryTransport = http(primaryEndpoint.url);

  // Create wallet client
  const walletClient = createWalletClient({
    account,
    chain: chainObj,
    transport: primaryTransport,
  });

  return walletClient;
}

/**
 * Create the Web3PGP service from configuration.
 * Orchestrates Viem client setup, contract initialization, and service creation.
 *
 * @param config - Merged configuration with Ethereum and Web3PGP settings
 * @param logger - Logger instance to use for logging
 * @returns Promise resolving to IWeb3PGPService instance
 * @throws ConfigError if configuration is invalid
 */
export async function createWeb3PGPService(config: MergedConfig, logger: Logger): Promise<IWeb3PGPService> {
  logger.debug({ chain: config.ethereum.chain }, 'Initializing Web3PGP service');

  try {
    // Step 1: Create PublicClient with RPC fallback
    const publicClient = createPublicClientWithFallback(config, logger);

    // Step 2: Create WalletClient if private key configured
    const walletClient = createWalletClientIfConfigured(config, logger);

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

    logger.debug(
      {
        chain: config.ethereum.chain,
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
