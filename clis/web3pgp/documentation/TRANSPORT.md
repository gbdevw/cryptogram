# RPC Configuration and Transport Setup

This directory contains utilities for configuring RPC endpoints and building Viem transport layers for the Web3PGP CLI.

## Architecture

The configuration system is designed with a tiered precedence model:

1. **Defaults** - Built-in default configuration (see `defaults.ts`)
2. **Config File** - YAML configuration file at `~/.web3pgp/config.yaml`
3. **Environment Variables** - `DEXES_*` prefixed environment variables
4. **CLI Flags** - Command-line overrides

Each tier overrides the previous one.

## Configuration Structure

### Ethereum RPC Configuration

```typescript
ethereum: {
  chain: 'ink-sepolia' | 'mainnet' | 'sepolia' | 'anvil' | <numeric_chain_id>,
  rpc?: {
    endpoints: RpcEndpoint[],      // Array of RPC endpoints
    maxBlockRange?: number,        // Max block range for eth_getLogs queries - Default to 10000
    retry?: RetryConfig,           // Shared retry configuration
  },
  wallet?: {
    type: 'private-key',
    privateKey: '0x...', // pragma: allowlist secret
  }
}
```

### RPC Endpoint Configuration

Each endpoint has its own batching configuration:

```typescript
interface RpcEndpoint {
  url: string,                    // RPC endpoint URL
  priority: number,               // Lower = higher priority (1 is highest)
  batching?: {
    size?: number,                // Max requests per batch (default: 20)
    waitMs?: number,              // Max wait time before sending batch in ms (default: 100)
  }
}
```

### Retry Configuration

Applied at the fallback transport level (shared across all endpoints):

```typescript
interface RetryConfig {
  count?: number,                 // Number of retry attempts (default: 3)
  delayMs?: number,              // Delay between retries in ms (default: 500)
}
```

## Usage Examples

### Configuration File (YAML)

```yaml
ethereum:
  chain: sepolia
  rpc:
    endpoints:
      - url: https://ethereum-sepolia-rpc.publicnode.com
        priority: 1
        batching:
          size: 20
          waitMs: 100
      - url: https://sepolia.gateway.tenderly.co
        priority: 2
        batching:
          size: 20
          waitMs: 100
      - url: https://sepolia.drpc.org
        priority: 3
        batching:
          size: 20
          waitMs: 100
      - url: https://1rpc.io/sepolia
        priority: 4
        batching:
          size: 20
          waitMs: 100
    maxBlockRange: 10000
    retry:
      count: 3
      delayMs: 200
  wallet:
    type: private-key
web3pgp:
  contract: "0xce66927a2E6171056a9c2464CFe83b813215A905"
monitoring:
  logging:
    level: info
```

### Environment Variables

```bash
export DEXES_CHAIN="sepolia"
export DEXES_RPC_ENDPOINTS='[
  {"url":"https://ethereum-sepolia-rpc.publicnode.com","priority":1,"batching":{"size":20,"waitMs":100}},
  {"url":"https://sepolia.drpc.org","priority":2,"batching":{"size":20,"waitMs":100}}
]'
export DEXES_WALLET_PRIVATE_KEY="0x..." # pragma: allowlist secret
export DEXES_WEB3PGP_CONTRACT="0xce66927a2E6171056a9c2464CFe83b813215A905"
export DEXES_LOG_LEVEL="info"
```

### Programmatic Usage

```typescript
import { loadConfig } from './config/loader';
import { createPublicClientFromConfig, createWalletClientFromConfig } from './utils/clients';

const config = loadConfig();

const publicClient = createPublicClientFromConfig(config.ethereum);
const walletClient = createWalletClientFromConfig(config.ethereum);
```

## Transport Building

### Using the Transport Builder

The `buildFallbackTransport` utility creates a Viem fallback transport:

```typescript
import { buildFallbackTransport } from './config/transport';

const transport = buildFallbackTransport(
  config.ethereum.rpc?.endpoints,
  config.ethereum.rpc?.retry
);
```

### Manual Transport Construction

For custom use cases:

```typescript
import { fallback, http } from 'viem';

const endpoints = [
  { url: 'https://rpc1.example.com', priority: 1, batching: { size: 20, waitMs: 100 } },
  { url: 'https://rpc2.example.com', priority: 2, batching: { size: 20, waitMs: 100 } },
];

// Sort by priority
const sorted = [...endpoints].sort((a, b) => a.priority - b.priority);

// Build HTTP transports with per-endpoint batching
const httpTransports = sorted.map(endpoint => 
  http(endpoint.url, {
    batch: {
      batchSize: endpoint.batching?.size ?? 100,
      wait: endpoint.batching?.waitMs ?? 50,
    }
  })
);

// Create fallback with shared retry configuration
const transport = fallback(httpTransports, {
  retryCount: 3,
  retryDelay: 500,
});

// Use with clients
const publicClient = createPublicClient({
  chain: sepolia,
  transport,
});
```

## Key Design Decisions

1. **Per-Endpoint Batching**: Each RPC endpoint can have different batch size/wait configurations to accommodate different provider capabilities.

2. **Shared Retry Configuration**: Retry logic is shared across all endpoints in the fallback transport. This prevents cascading retries and provides consistent behavior.

3. **Priority-Based Ordering**: Endpoints are automatically sorted by priority when building the transport. Lower numbers = higher priority.

4. **MaxBlockRange as Metadata**: The `maxBlockRange` setting is stored in configuration but not automatically applied to queries. Consumers should check this value when making `eth_getLogs` or similar range-limited queries.

5. **Chain Resolution**: The `createClientsFromConfig` utilities automatically resolve both well-known chain names and custom numeric chain IDs to Viem Chain objects.

## See Also

- [types.ts](./types.ts) - Type definitions for all configuration interfaces
- [loader.ts](./loader.ts) - Configuration loading and merging logic
- [transport.ts](./transport.ts) - Transport builder utility
- [../utils/clients.ts](../utils/clients.ts) - Viem client creation utilities
