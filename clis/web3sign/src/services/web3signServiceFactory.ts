import {
  Chain,
  PublicClient,
  WalletClient,
  createPublicClient,
  createWalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, sepolia, foundry, ink, inkSepolia } from 'viem/chains';
import { Logger } from 'pino';

import { ChainConfig, MergedConfig, RpcEndpoint } from '../config/types';
import { ConfigError } from '../errors';
import { IWeb3SignService, Web3Sign, Web3SignService } from '@jibidieuw/dexes';
import { IWeb3PGPService } from '@jibidieuw/dexes';
import { buildFallbackTransport } from '../config/transport';

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
 */
function getChainForConfig(chainConfig: ChainConfig): Chain {
  if (typeof chainConfig === 'string') {
    const chain = CHAIN_MAP[chainConfig];
    if (chain) {
      return chain;
    }
    throw new ConfigError(`Unsupported chain name: ${chainConfig}`);
  }

  const chain = CHAIN_ID_MAP[chainConfig];
  if (chain) {
    return chain;
  }

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
 */
function resolveRpcEndpoints(config: MergedConfig, logger: Logger): RpcEndpoint[] {
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
      const predefinedEndpoints: RpcEndpoint[] = chainObj.rpcUrls.default.http.map((url, index) => ({
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
      const predefinedEndpoints: RpcEndpoint[] = chainObj.rpcUrls.default.http.map((url, index) => ({
        url,
        priority: index,
      }));
      logger.debug(
        { count: predefinedEndpoints.length, endpoints: predefinedEndpoints.map(e => e.url) },
        'Using predefined RPC endpoints for chain ID',
      );
      return predefinedEndpoints;
    }
  }

  throw new ConfigError(
    `No RPC endpoints available for chain ${chain}. ` +
      `Please provide RPC endpoints in config or use a well-known chain.`
  );
}

/**
 * Create PublicClient with intelligent RPC fallback
 */
function createPublicClientWithFallback(config: MergedConfig, logger: Logger): PublicClient {
  const chain = getChainForConfig(config.ethereum.chain);
  const endpoints = resolveRpcEndpoints(config, logger);

  logger.debug(
    { 
      endpoints: endpoints.map(e => e.url),
      retryConfig: config.ethereum.rpc?.retry,
      batchingConfigs: endpoints.map(e => ({ url: e.url, batching: e.batching })),
    },
    'Creating PublicClient with RPC fallback chain',
  );

  // Create fallback transport with batching and retry configuration
  const fallbackTransport = buildFallbackTransport(endpoints, config.ethereum.rpc?.retry);

  return createPublicClient({
    chain,
    transport: fallbackTransport,
  }) as any;
}

/**
 * Create WalletClient if private key is configured
 */
function createWalletClientIfConfigured(
  config: MergedConfig,
  logger: Logger
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

  logger.debug(
    { 
      endpoints: rpcEndpoints.map(e => e.url),
      retryConfig: config.ethereum.rpc?.retry
    },
    'Creating WalletClient with fallback transport',
  );

  // Use fallback transport with batching and retry for wallet client too
  const fallbackTransport = buildFallbackTransport(rpcEndpoints, config.ethereum.rpc?.retry);

  // Create wallet client
  const walletClient = createWalletClient({
    account,
    chain: chainObj,
    transport: fallbackTransport,
  }) as any;

  return walletClient;
}

/**
 * Initialize Web3Sign service with Web3PGP service dependency
 */
export async function createWeb3SignService(
  config: MergedConfig,
  web3pgpService: IWeb3PGPService,
  logger: Logger,
): Promise<IWeb3SignService> {
  const serviceLogger = logger.child({ component: 'web3signService' });

  try {
    const publicClient = createPublicClientWithFallback(config, logger);
    const walletClient = createWalletClientIfConfigured(config, logger);

    const contractAddress = config.web3sign.contract as `0x${string}`;

    // Validate contract address format
    if (!contractAddress.startsWith('0x') || contractAddress.length !== 42) {
      throw new ConfigError(
        `Invalid contract address format: ${contractAddress}. Must be 0x-prefixed 40 hex characters`,
      );
    }

    serviceLogger.debug({ contractAddress }, 'Creating Web3Sign contract wrapper');

    // Create contract instance with correct parameter order: address, web3pgp, publicClient, walletClient
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const web3signContract = new Web3Sign(
      contractAddress,
      (web3pgpService as any).contract,
      publicClient as any,
      walletClient as any
    );

    // Create high-level Web3Sign service with Web3PGP service dependency
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new Web3SignService(web3signContract as any, web3pgpService as any);

    serviceLogger.debug(
      {
        chain: config.ethereum.chain,
        contractAddress,
        hasWallet: !!walletClient,
      },
      'Web3Sign service initialized successfully',
    );

    return service;
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }

    serviceLogger.error({ error }, 'Failed to initialize Web3Sign service');
    throw new ConfigError(
      `Failed to initialize Web3Sign service: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
