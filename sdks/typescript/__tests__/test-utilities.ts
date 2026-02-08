/**
 * Test Utilities
 * 
 * Provides test client initialization and contract address management for integration tests.
 * These utilities are specific to the test environment and not part of the SDK.
 */

import { createPublicClient, createWalletClient, fallback, http, Address, PublicClient, WalletClient, Transport, Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

/**
 * Get public client configured for Sepolia testnet
 * 
 * Reads configuration from environment variables:
 * - RPC_URLS: Comma-separated Sepolia RPC endpoints (with fallback)
 * 
 * @example
 * const publicClient = getPublicClient();
 * const balance = await publicClient.getBalance({ address: '0x...' });
 */
export function getPublicClient(): PublicClient<Transport, Chain | undefined> {
  // Get RPC endpoints from environment
  const rpcUrlsEnv = process.env.RPC_URLS || '';
  const rpcUrls = rpcUrlsEnv
    .split(',')
    .map(url => url.trim())
    .filter(url => url.length > 0);

  if (rpcUrls.length === 0) {
    throw new Error('RPC_URLS environment variable not set or empty');
  }

  // Build fallback transport from configured RPC endpoints
  const transports = rpcUrls.map((url) =>
    http(url, {
      batch: {
        batchSize: 20,
        wait: 150,
      },
    })
  );

  return createPublicClient({
    chain: sepolia,
    transport: fallback(transports),
  });
}

/**
 * Get wallet client configured for Sepolia testnet
 * 
 * Reads configuration from environment variables:
 * - WALLET_PRIVATE_KEY: Test account private key
 * - RPC_URLS: Comma-separated Sepolia RPC endpoints (with fallback)
 * 
 * @example
 * const walletClient = getTestWalletClient();
 * const hash = await walletClient.sendTransaction({ to: '0x...', value: 1n });
 */
export function getTestWalletClient(): WalletClient {
  const walletPrivateKey = process.env.WALLET_PRIVATE_KEY as `0x${string}`;
  if (!walletPrivateKey) {
    throw new Error('WALLET_PRIVATE_KEY environment variable not set');
  }

  // Get RPC endpoints from environment
  const rpcUrlsEnv = process.env.RPC_URLS || '';
  const rpcUrls = rpcUrlsEnv
    .split(',')
    .map(url => url.trim())
    .filter(url => url.length > 0);

  if (rpcUrls.length === 0) {
    throw new Error('RPC_URLS environment variable not set or empty');
  }

  // Create account from private key
  const account = privateKeyToAccount(walletPrivateKey);

  // Build fallback transport from configured RPC endpoints
  const transports = rpcUrls.map((endpoint) =>
    http(endpoint, {
      batch: {
        batchSize: 20,
        wait: 150,
      },
    })
  );

  return createWalletClient({
    account,
    chain: sepolia,
    transport: fallback(transports),
  });
}

/**
 * Get contract address from environment variables
 * 
 * Reads contract addresses from environment variables like:
 * - DEXES_WEB3PGP
 * - DEXES_WEB3SIGN
 * - etc.
 * 
 * @param contractName The contract name (e.g., 'DEXES_WEB3PGP')
 * @returns The contract address
 * 
 * @example
 * const web3pgpAddress = getContractAddress('DEXES_WEB3PGP');
 */
export function getContractAddress(contractName: string): Address {
  const address = process.env[contractName];
  
  if (!address) {
    throw new Error(`Contract address for ${contractName} not found in environment variables`);
  }

  if (!address.startsWith('0x')) {
    throw new Error(`Invalid contract address for ${contractName}: ${address}`);
  }

  return address as Address;
}
