# Web3PGP CLI - Configuration Specification

## Configuration Overview

The Web3PGP CLI uses a hierarchical configuration system allowing users to configure the tool via command flags, environment variables, or a YAML configuration file.

### Configuration Priority (Highest to Lowest)

1. **Command-Line Flags** - Explicit CLI arguments
2. **Environment Variables** - Prefixed with `DEXES_`
3. **Configuration File** - YAML file at `$HOME/.web3pgp/config.yaml` or custom location
4. **Built-in Defaults** - Hardcoded sensible defaults (Sepolia testnet)

---

## Configuration Structure

```yaml
ethereum:
  chainId: 11155111
  rpc:
    endpoints:
      - url: "https://..."
        apiKey: "..."
        priority: 1
        timeout: 10000
  wallet:
    type: "private-key"
    privateKey: "0x..." # pragma: allowlist secret

web3pgp:
  contract: "0x..." # pragma: allowlist secret

monitoring:
  logging:
    level: "info"
```

---

## Configuration Keys

### Ethereum Configuration

#### `ethereum.chainId` (Blockchain Network)

The chain ID of the Ethereum network to interact with.

**YAML:**
```yaml
ethereum:
  chainId: 11155111
```

**Environment Variables:**
```bash
DEXES_ETHEREUM_CHAIN_ID=11155111
```

**Command Flags:**
```bash
--chain-id 11155111
```

**Defaults:**
- `11155111` (Sepolia testnet)

**Supported Chain IDs:**
- `1` - Ethereum mainnet
- `11155111` - Sepolia testnet
- `31337` - Hardhat local
- Custom values supported

---

#### `ethereum.rpc.endpoints` (Array of RPC Endpoints)

Array of RPC endpoints with fallback support. Endpoints are tried in priority order.

Each endpoint supports:
- `url` - RPC endpoint URL (HTTP/HTTPS)
- `apiKey` - API key for premium services (Infura, Alchemy) - optional
- `priority` - Priority order (lower number = higher priority)
- `timeout` - Timeout in milliseconds

**YAML Structure:**
```yaml
ethereum:
  rpc:
    endpoints:
      - url: "https://eth-sepolia.g.alchemy.com/v2/"
        apiKey: "${ALCHEMY_KEY}"
        priority: 1
        timeout: 10000
      - url: "https://sepolia.infura.io/v3/"
        apiKey: "${INFURA_KEY}"
        priority: 2
        timeout: 10000
      - url: "http://localhost:8545"
        priority: 3
        timeout: 5000
```

**Environment Variables:**
```bash
# Primary endpoint
DEXES_ETHEREUM_RPC_ENDPOINTS_0_URL="<RPC_ENDPOINT_URL>"
DEXES_ETHEREUM_RPC_ENDPOINTS_0_API_KEY="<API_KEY>"
DEXES_ETHEREUM_RPC_ENDPOINTS_0_PRIORITY="1"
DEXES_ETHEREUM_RPC_ENDPOINTS_0_TIMEOUT="10000"

# Fallback endpoint
DEXES_ETHEREUM_RPC_ENDPOINTS_1_URL="http://localhost:8545"
DEXES_ETHEREUM_RPC_ENDPOINTS_1_PRIORITY="2"
```

**Command Flags:**
```bash
--rpc-url "https://eth-sepolia.g.alchemy.com/v2/xxx"
```

**Defaults:**
- Primary: Sepolia public RPC (varies by availability)
- Fallback: Local hardhat node at `http://localhost:8545`
- Timeout: 10000ms

---

#### `ethereum.wallet` (Wallet Configuration)

Wallet configuration for signing transactions.

##### `ethereum.wallet.type`

Type of wallet implementation.

**YAML:**
```yaml
ethereum:
  wallet:
    type: "private-key"
```

**Environment Variables:**
```bash
DEXES_ETHEREUM_WALLET_TYPE="private-key"
```

**Command Flags:**
```bash
--private-key "0x..."
```

**Defaults:**
- `private-key` (currently only supported type)

**Supported Types:**
- `private-key` - Uses a private key for signing (current)
- Other types (e.g., `ledger`, `trezor`) - Planned for future

---

##### `ethereum.wallet.privateKey`

The private key used to sign transactions. Must be a 32-byte hex string with optional 0x prefix.

**YAML:**
```yaml
ethereum:
  wallet:
    type: "private-key"
    privateKey: "${PRIVATE_KEY}"
```

**Environment Variables:**
```bash
DEXES_ETHEREUM_WALLET_PRIVATE_KEY="0x..."  # pragma: allowlist secret
```

**Command Flags:**
```bash
--private-key "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"  # pragma: allowlist secret
```

**Defaults:**
- None; must be provided explicitly

**Security Notes:**
- Private keys should NEVER be hardcoded in config files
- Use environment variables or secure vaults
- CLI will warn if private key is in plaintext config file
- Private keys are masked in logs and display commands

---

### Web3PGP Configuration

#### `web3pgp.contract` (Contract Address)

Address of the deployed Web3PGP smart contract on the blockchain.

**YAML:**
```yaml
web3pgp:
  contract: "0x1234567890abcdef1234567890abcdef12345678"
```

**Environment Variables:**
```bash
DEXES_WEB3PGP_CONTRACT="0x1234567890abcdef1234567890abcdef12345678"
```

**Command Flags:**
```bash
--web3pgp-address "0x1234567890abcdef1234567890abcdef12345678"
```

**Defaults:**
- None; must be provided explicitly or will error if required

**Note:** Contract address is chain-specific. Different addresses for mainnet, testnet, etc.

---

### Monitoring Configuration

#### `monitoring.logging.level`

Logging level for console output and logs.

**Valid Values:** `debug`, `info`, `warn`, `error`

**YAML:**
```yaml
monitoring:
  logging:
    level: "info"
```

**Environment Variables:**
```bash
DEXES_MONITORING_LOGGING_LEVEL="info"
```

**Command Flags:**
```bash
--log-level info
-L info  # Short form
```

**Defaults:**
- `info`

**Log Levels:**
- `debug` - Detailed information for debugging
- `info` - General informational messages
- `warn` - Warning messages (e.g., RPC fallback)
- `error` - Error messages with stack traces

---

## Configuration File Locations

### Default Location
```
$HOME/.web3pgp/config.yaml
```

### Custom Location
```bash
web3pgp --config /path/to/config.yaml <command> ...
web3pgp -c /path/to/config.yaml <command> ...
```

### Environment Variable Override
```bash
export DEXES_CONFIG="/etc/web3pgp/config.yaml"
web3pgp <command> ...
```

---

## Configuration File Example

```yaml
# ~/.web3pgp/config.yaml

ethereum:
  chainId: 11155111
  rpc:
    endpoints:
      - url: "https://eth-sepolia.g.alchemy.com/v2/"
        apiKey: "${ALCHEMY_KEY}"
        priority: 1
        timeout: 10000
      - url: "https://sepolia.infura.io/v3/"
        apiKey: "${INFURA_KEY}"
        priority: 2
        timeout: 10000
      - url: "http://localhost:8545"
        priority: 3
        timeout: 5000
  wallet:
    type: "private-key"
    privateKey: "${PRIVATE_KEY}"

web3pgp:
  contract: "0x1234567890abcdef1234567890abcdef12345678"

monitoring:
  logging:
    level: "info"
```

---

## Environment Variable Expansion

The configuration loader supports environment variable expansion using `${VAR_NAME}` syntax:

```yaml
ethereum:
  wallet:
    privateKey: "${PRIVATE_KEY}"
```

This will expand to the value of the `PRIVATE_KEY` environment variable at runtime.

---

## Configuration Validation

The configuration must pass validation before execution. Invalid configurations should fail fast with clear error messages.

### Validation Rules

1. **Chain ID**: Must be a positive integer
2. **RPC Endpoints**: At least one valid endpoint must be configured
3. **RPC URL**: Must be a valid HTTP/HTTPS URL
4. **Wallet Type**: Must be a supported type
5. **Private Key**: Must be a valid 32-byte hex string (with or without 0x prefix) if wallet type is `private-key`
6. **Contract Address**: Must be a valid Ethereum address (42 characters with 0x prefix)
7. **Log Level**: Must be one of: debug, info, warn, error

### Example Error Message

```json
{
  "timestamp": "2025-12-03T10:30:45.123Z",
  "level": "error",
  "component": "config",
  "message": "Configuration validation failed",
  "details": {
    "errors": [
      {
        "field": "ethereum.wallet.privateKey",
        "message": "Private key is required for private-key wallet type"
      },
      {
        "field": "ethereum.rpc.endpoints",
        "message": "At least one RPC endpoint must be configured"
      },
      {
        "field": "web3pgp.contract",
        "message": "Contract address must be a valid Ethereum address"
      }
    ]
  }
}
```

---

## Usage Examples

### Example 1: Using Command Flags Only
```bash
web3pgp \
  --chain-id 11155111 \
  --rpc-url "https://eth-sepolia.g.alchemy.com/v2/xxx" \
  --private-key "0x..." \
  --web3pgp-address "0x..." \
  register --key my-key.asc
```

### Example 2: Using Environment Variables
```bash
export DEXES_ETHEREUM_CHAIN_ID=11155111
export DEXES_ETHEREUM_RPC_ENDPOINTS_0_URL="https://eth-sepolia.g.alchemy.com/v2/xxx"
export DEXES_ETHEREUM_WALLET_PRIVATE_KEY="0x..."  # pragma: allowlist secret
export DEXES_WEB3PGP_CONTRACT="0x..."  # pragma: allowlist secret

web3pgp register --key my-key.asc
```

### Example 3: Using Configuration File + Environment Variables
```bash
# ~/.web3pgp/config.yaml
ethereum:
  chainId: 11155111
  rpc:
    endpoints:
      - url: "https://eth-sepolia.g.alchemy.com/v2/"
        apiKey: "${ALCHEMY_KEY}"
  wallet:
    type: "private-key"
    privateKey: "${PRIVATE_KEY}"

web3pgp:
  contract: "0x1234567890abcdef1234567890abcdef12345678"

monitoring:
  logging:
    level: "info"

# Command
export ALCHEMY_KEY="your-alchemy-key"  # pragma: allowlist secret
export PRIVATE_KEY="0x..."  # pragma: allowlist secret

web3pgp register --key my-key.asc
```

### Example 4: Using Custom Config Location
```bash
web3pgp --config /etc/web3pgp/sepolia.yaml register --key my-key.asc
```

### Example 5: Override Config File with Command Flags
```bash
# Config file has: ethereum.chainId = 11155111
# Override with mainnet:
web3pgp --chain-id 1 register --key my-key.asc
```

### Example 6: Override RPC Endpoint
```bash
# Config has multiple endpoints, override with specific one:
web3pgp --rpc-url "http://localhost:8545" register --key my-key.asc
```

---

## Defaults

When no configuration is provided, the following defaults are used:

- **Chain ID**: `11155111` (Sepolia testnet)
- **RPC Endpoints**: Public Sepolia endpoint + local hardhat fallback
- **Wallet Type**: `private-key` (required to be provided via flag or environment)
- **Log Level**: `info`

---

## Future Enhancements

1. **Configuration Profiles**: Support multiple named profiles (e.g., dev, staging, prod)
2. **Config Validation Schema**: JSONSchema for configuration validation
3. **Keyring Integration**: Read private keys from system keyrings
4. **Hardware Wallet Support**: Ledger, Trezor integration (`wallet.type: "ledger"`)
5. **Config Encryption**: Encrypted configuration files for sensitive data
6. **Auto-discovery**: Contract address auto-detection from deployment records
