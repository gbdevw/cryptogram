# Web3PGP CLI Configuration Reference

Complete configuration reference for the Web3PGP CLI with all available settings, their default values, and corresponding environment variables.

## Configuration Overview

Configuration can be provided through:
1. **YAML Config File**: `~/.web3pgp/config.yaml` (default location)
2. **Environment Variables**: `DEXES_*` prefixed variables
3. **CLI Flags**: Command-line arguments override file and environment settings

Configuration follows a 3-tier precedence (lowest to highest):
- Defaults < Config File < Environment Variables < CLI Flags

> **Note**: For detailed information about RPC configuration, transport layers, and batching/retry strategies, see [TRANSPORT.md](TRANSPORT.md).

You can generate a template configuration file using:
```bash
web3pgp configuration generate test  # For testnet (Sepolia)
web3pgp configuration generate prod  # For production (Ink mainnet)
```

---

## Configuration Table

| Configuration Key | Description | Default Value | Environment Variable |
|---|---|---|---|
| `ethereum.chain` | Blockchain network to connect to. Supports well-known Viem chains (`mainnet`, `sepolia`, `anvil`, `ink`) or custom numeric chain IDs. | `sepolia` | `DEXES_CHAIN` |
| `ethereum.rpc.endpoints[]` | Array of RPC endpoints for blockchain communication with fallback support. Each endpoint has URL, priority, and optional batching config. | 4 Sepolia endpoints (priorities 1-4) | `DEXES_RPC_ENDPOINTS` (JSON array) or `DEXES_RPC_URL` (single endpoint) |
| `ethereum.rpc.endpoints[].url` | RPC endpoint URL. | `https://ethereum-sepolia-rpc.publicnode.com` ; `https://sepolia.gateway.tenderly.co` ; `https://sepolia.drpc.org` ;  `https://1rpc.io/sepolia` | Set via `DEXES_RPC_ENDPOINTS` JSON or `DEXES_RPC_URL` |
| `ethereum.rpc.endpoints[].priority` | Priority order for RPC endpoints. Lower number = higher priority. Used for fallback when endpoints fail. | `1, 2, 3, 4` | Set via `DEXES_RPC_ENDPOINTS` JSON |
| `ethereum.rpc.endpoints[].batching` | Optional batching configuration for RPC requests (size and wait time). | `{ size: 20, waitMs: 100 }` | Set via `DEXES_RPC_ENDPOINTS` JSON |
| `ethereum.rpc.maxBlockRange` | Maximum block range for `eth_getLogs` queries to avoid provider limits. | `10000` | N/A |
| `ethereum.rpc.retry` | Retry configuration for failed RPC requests (count and delay with exponential backoff). | `{ count: 3, delayMs: 200 }` | N/A |
| `ethereum.wallet.type` | Wallet type for signing transactions. Currently supports `private-key` for private key-based signing. | `private-key` | N/A (automatic) |
| `ethereum.wallet.privateKey` | Private key for wallet signing (0x-prefixed 32-byte hex). **SECRET** - Do not commit to version control. | Not set | `DEXES_WALLET_PRIVATE_KEY` |
| `web3pgp.contract` | Smart contract address for Web3PGP operations. Ethereum address format (0x-prefixed 40 hex characters). | `0x82733B49e65A2FE6B611e5CE454AC21237071638` | `DEXES_WEB3PGP_CONTRACT` |
| `monitoring.logging.level` | Logging level for CLI output. Valid values: `debug`, `info`, `warn`, `error`. | `info` | `DEXES_LOG_LEVEL` |

---

## Usage Examples

### Environment Variable Configuration

Set individual configuration via environment variables:

```bash
# Set blockchain network
export DEXES_CHAIN=sepolia

# Set single RPC endpoint (creates endpoint with priority 1)
export DEXES_RPC_URL=https://sepolia.infura.io/v3/YOUR_API_KEY

# Set wallet private key
export DEXES_WALLET_PRIVATE_KEY=0x...

# Set logging level for debugging
export DEXES_LOG_LEVEL=debug

# Run CLI command
web3pgp get 0x1234...
```

### Multiple RPC Endpoints with Batching

Configure multiple RPC endpoints with fallback and batching using the `DEXES_RPC_ENDPOINTS` environment variable (JSON array of endpoint objects):

```bash
export DEXES_RPC_ENDPOINTS='[
  {"url":"https://endpoint1.example.com","priority":1,"batching":{"size":20,"waitMs":100}},
  {"url":"https://endpoint2.example.com","priority":2,"batching":{"size":20,"waitMs":100}},
  {"url":"https://endpoint3.example.com","priority":3,"batching":{"size":20,"waitMs":100}}
]'
```

For more details on batching and retry strategies, see [TRANSPORT.md](TRANSPORT.md).

### YAML Config File

Create `~/.web3pgp/config.yaml`:

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
    privateKey: "0x..." # pragma: allowlist secret

web3pgp:
  contract: "0x82733B49e65A2FE6B611e5CE454AC21237071638"

monitoring:
  logging:
    level: info
```

### Using Custom Config File

```bash
web3pgp --config /path/to/custom/config.yaml get 0x1234...
```

### Generating Configuration Templates

Use the built-in configuration generator to create template files:

```bash
# Generate testnet configuration template
web3pgp configuration generate test

# Generate production configuration template
web3pgp configuration generate prod

# Save to file
web3pgp configuration generate test -o ~/.web3pgp/config.yaml
```

---RPC Configuration

For advanced RPC configuration including batching, retry strategies, and transport layer details, refer to [TRANSPORT.md](TRANSPORT.md).

Key concepts:
- **Batching**: Group multiple RPC requests together to improve performance
- **Retries**: Automatic retry with exponential backoff for failed requests
- **Fallback**: Automatic failover to next priority endpoint when one fails
- **Max Block Range**: Limit block range for `eth_getLogs` to respect provider constraints

---

## 

## Logging Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| `debug` | Detailed diagnostic information including RPC endpoints, gas limits, wallet initialization, etc. | Development and troubleshooting |
| `info` | General informational messages about CLI operations | Default - normal operation |
| `warn` | Warning messages about potentially problematic situations | Alerts for non-critical issues |
| `error` | Error messages for failures | Error reporting and debugging |

### Enable Debug Logging

```bash
DEXES_LOG_LEVEL=debug web3pgp get --help
```

---

## Supported Chains

### Well-Known Chains

- `mainnet` - Ethereum Mainnet
- `sepolia` - Sepolia Testnet (default)
- `anvil` - Local Anvil/Hardhat Node
- `ink` - Ink Mainnet

### Custom Chain IDs

Specify numeric chain IDs directly:

```bash
export DEXES_CHAIN=1  # Mainnet (chain ID 1)
export DEXES_CHAIN=11155111  # Sepolia (chain ID 11155111)
```

---

## Security Notes

- **Private Keys**: Store private keys in environment variables or secure config files. Never commit to version control.
- **Config Files**: Restrict file permissions: `chmod 600 ~/.web3pgp/config.yaml`
- **Environment Variables**: Be cautious with shell history containing sensitive values. Consider using `.env` files with restricted permissions.

---

## Configuration Validation

The CLI validates configuration on startup:
- Private key format (0x-prefixed 64 hex characters)
- Contract address format (0x-prefixed 40 hex characters)
- RPC endpoint URLs (valid HTTP/HTTPS)
- Logging level (one of: debug, info, warn, error)

Invalid configurations will produce clear error messages indicating the issue.
