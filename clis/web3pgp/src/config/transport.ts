/**
 * Utilities for building Viem transport configurations from RPC endpoint configuration
 */

import { fallback, http } from 'viem';
import { RpcEndpoint, RetryConfig } from './types';

/**
 * Builds a Viem fallback transport from RPC endpoint configuration
 *
 * Creates an HTTP transport for each endpoint with its own batching configuration,
 * then wraps them in a fallback transport with shared retry logic.
 *
 * @param endpoints - Array of RPC endpoints to use
 * @param retryConfig - Optional shared retry configuration for the fallback transport
 * @returns A configured fallback transport for use with Viem clients
 * @throws Error if endpoints array is empty or undefined
 */
export function buildFallbackTransport(
  endpoints: RpcEndpoint[] | undefined,
  retryConfig?: RetryConfig
) {
  if (!endpoints || endpoints.length === 0) {
    throw new Error('At least one RPC endpoint must be configured');
  }

  // Sort endpoints by priority (lower number = higher priority)
  const sorted = [...endpoints].sort((a, b) => a.priority - b.priority);

  // Build HTTP transports with per-endpoint batching configuration
  const httpTransports = sorted.map((endpoint) => {
    // Use endpoint-specific batching config, or fall back to defaults
    const batch = endpoint.batching
      ? {
          batchSize: endpoint.batching.size ?? 100,
          wait: endpoint.batching.waitMs ?? 50,
        }
      : {
          batchSize: 100,
          wait: 50,
        };

    return http(endpoint.url, { batch });
  });

  // Configure the fallback strategy with shared retry logic
  const fallbackConfig = {
    retryCount: retryConfig?.count ?? 3,
    retryDelay: retryConfig?.delayMs ?? 500,
  };

  return fallback(httpTransports, fallbackConfig);
}
