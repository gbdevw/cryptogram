# Web3PGP CLI Configuration Reference

Complete configuration reference for the Web3PGP CLI with all available settings, their default values, and corresponding environment variables.

## Configuration Overview

Configuration can be provided through:
1. **YAML Config File**: `~/.web3pgp/config.yaml` (default location)
2. **Environment Variables**: `DEXES_*` prefixed variables
3. **CLI Flags**: Command-line arguments override file and environment settings

Configuration follows a 3-tier precedence (lowest to highest):
- Defaults < Config File < Environment Variables < CLI Flags

---

## Configuration Table

| Configuration Key | Description | Default Value | Environment Variable |
|---|---|---|---|
| `ethereum.chain` | Blockchain network to connect to. Supports well-known Viem chains (`mainnet`, `sepolia`, `anvil`, `ink-sepolia`) or custom numeric chain IDs. | `ink-sepolia` | `DEXES_CHAIN` |
| `ethereum.rpc.endpoints[].url` | RPC endpoint URL for blockchain communication. Can specify multiple endpoints with fallback support. | `https://rpc-gel-sepolia.inkonchain.com` (priority 1)<br/>`https://rpc-qnd-sepolia.inkonchain.com` (priority 2) | `DEXES_RPC_URL` (single endpoint)<br/>`DEXES_RPC_ENDPOINTS` (JSON array) |
| `ethereum.rpc.endpoints[].priority` | Priority order for RPC endpoints. Lower number = higher priority. Used for fallback when endpoints fail. | `1, 2` | N/A (set via `DEXES_RPC_ENDPOINTS` JSON) |
| `ethereum.wallet.type` | Wallet type for signing transactions. Currently supports `private-key` for private key-based signing. | `private-key` | N/A (automatic) |
| `ethereum.wallet.privateKey` | Private key for wallet signing (0x-prefixed 32-byte hex). **SECRET** - Do not commit to version control. | Not set | `DEXES_WALLET_PRIVATE_KEY` |
| `ethereum.gasLimit` | Optional explicit gas limit override for transactions. If undefined, Viem estimates automatically. Useful for testing. | Not set | N/A |
| `web3pgp.contract` | Smart contract address for Web3PGP operations. Ethereum address format (0x-prefixed 40 hex characters). | `0x72d02B94317ac899B34459a4e6685eFe12Ac17a8` | `DEXES_WEB3PGP_CONTRACT` |
| `monitoring.logging.level` | Logging level for CLI output. Valid values: `debug`, `info`, `warn`, `error`. | `info` | `DEXES_LOG_LEVEL` |

---

## Usage Examples

### Environment Variable Configuration

Set individual configuration via environment variables:

```bash
# Set blockchain network and RPC endpoint
export DEXES_CHAIN=sepolia
export DEXES_RPC_URL=https://sepolia.infura.io/v3/YOUR_API_KEY

# Set wallet private key
export DEXES_WALLET_PRIVATE_KEY=0x...

# Set logging level for debugging
export DEXES_LOG_LEVEL=debug

# Run CLI command
web3pgp get 0x1234...
```

### Multiple RPC Endpoints

Configure multiple RPC endpoints with fallback using JSON:

```bash
export DEXES_RPC_ENDPOINTS='[
  {"url":"https://endpoint1.example.com","priority":1},
  {"url":"https://endpoint2.example.com","priority":2},
  {"url":"https://endpoint3.example.com","priority":3}
]'
```

### YAML Config File

Create `~/.web3pgp/config.yaml`:

```yaml
ethereum:
  chain: ink-sepolia
  rpc:
    endpoints:
      - url: https://rpc-gel-sepolia.inkonchain.com
        priority: 1
      - url: https://rpc-qnd-sepolia.inkonchain.com
        priority: 2
  wallet:
    type: private-key
    privateKey: "0x..." # pragma: allowlist secret
  gasLimit: null

web3pgp:
  contract: "0x72d02B94317ac899B34459a4e6685eFe12Ac17a8"

monitoring:
  logging:
    level: info
```

### Using Custom Config File

```bash
web3pgp --config /path/to/custom/config.yaml get 0x1234...
```

---

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
- `sepolia` - Sepolia Testnet
- `anvil` - Local Anvil/Hardhat Node
- `ink-sepolia` - Ink Sepolia Testnet (default)

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
