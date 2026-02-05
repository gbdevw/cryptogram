# Web3PGP CLI

A command-line interface for managing OpenPGP keys on Ethereum through the Web3PGP smart contracts. Interact with the decentralized key infrastructure directly from your terminal.

## Features

- 🔐 **Key Management**: Register, revoke, and manage OpenPGP keys on-chain
- ⛓️ **Blockchain Sync**: Listen to blockchain events and sync key changes in real-time
- 🔍 **Key Lookup**: Retrieve public keys by fingerprint from the blockchain
- ⚙️ **Configuration**: Generate and manage environment-specific configurations
- 📊 **Event Monitoring**: Real-time monitoring of key registration events
- 🛡️ **Security**: Secure wallet integration with private key management

## Installation

### Global Installation (Recommended)

```bash
npm install -g @cryptogram/web3pgp-cli
```

Then use directly:

```bash
web3pgp --help
```

### Local Installation

```bash
npm install --save-dev @cryptogram/web3pgp-cli
```

Then use with npx:

```bash
npx web3pgp --help
```

### Direct Execution (No Installation)

```bash
npx @cryptogram/web3pgp-cli --help
```

## Quick Start

### 1. Generate Configuration

```bash
# Generate test environment configuration
web3pgp configuration generate test

# Or production configuration
web3pgp configuration generate prod

# Save to a file
web3pgp configuration generate prod -o ~/.web3pgp/config.yaml
```

### 2. Use the CLI

```bash
# Generate a new Ethereum key
web3pgp blockchain generate-key

# Get a public key by fingerprint
web3pgp blockchain get 0x1234567890abcdef...

# Register your key
web3pgp blockchain register --key /path/to/key.asc

# Add a subkey
web3pgp blockchain add-subkey 0xsubkeyfingerprint --key /path/to/subkey.asc

# Revoke a key
web3pgp blockchain revoke 0xfingerprint --revocation /path/to/revocation.asc

# Listen for blockchain events
web3pgp blockchain sync

# View configuration
web3pgp configuration display

# Validate configuration
web3pgp configuration validate
```

## Configuration

The CLI requires a configuration file at `~/.web3pgp/config.yaml`. Generate a default:

```bash
web3pgp configuration generate prod -o ~/.web3pgp/config.yaml
```

### Configuration Structure

```yaml
ethereum:
  chain: ink  # Target blockchain (ink for mainnet, ink-sepolia for testnet)
  
  wallet:
    type: private-key
    privateKey: "${DEXES_WALLET_PRIVATE_KEY}"  # Use environment variable

web3pgp:
  contract: "0x..."  # Web3PGP contract address

monitoring:
  logging:
    level: info  # debug, info, warn, error
```

### Environment Variables

Override configuration with environment variables:

```bash
export DEXES_CHAIN_ID=763373
export DEXES_WALLET_PRIVATE_KEY=0x...
export DEXES_WEB3PGP_CONTRACT=0x...
export DEXES_LOG_LEVEL=debug
```

## Commands

### Blockchain Commands

#### `web3pgp blockchain generate-key`

Generate a new Ethereum private key.

```bash
web3pgp blockchain generate-key
# Output:
# {
#   "privateKey": "...", 
#   "address": "0x..."
# }
```

#### `web3pgp blockchain get <fingerprint>`

Retrieve a public key from the blockchain.

```bash
web3pgp blockchain get 0x1234567890abcdef...
```

#### `web3pgp blockchain register [options]`

Register a public key on the blockchain.

```bash
web3pgp blockchain register --key ./my-key.asc
```

**Options:**
- `--key <path>`: Path to armored OpenPGP key file

#### `web3pgp blockchain add-subkey [options] <subkeyFingerprint>`

Add a subkey to an existing key.

```bash
web3pgp blockchain add-subkey 0xsubkeyfingerprint --key ./subkey.asc
```

**Options:**
- `--key <path>`: Path to armored subkey file

#### `web3pgp blockchain revoke [options] <fingerprint>`

Revoke a key on the blockchain.

```bash
web3pgp blockchain revoke 0xfingerprint --revocation ./revocation.asc
```

**Options:**
- `--revocation <path>`: Path to revocation certificate

#### `web3pgp blockchain sync [options]`

Listen for blockchain events and output armored keys to stdout.

```bash
# Listen indefinitely
web3pgp blockchain sync

# Listen to a specific block range
web3pgp blockchain sync --from 1000 --to 2000

# Custom polling interval (in seconds)
web3pgp blockchain sync --interval 30
```

**Options:**
- `--from <block>`: Starting block (default: latest)
- `--to <block>`: Ending block (default: listen indefinitely)
- `--interval <seconds>`: Polling interval (default: 15)

### Configuration Commands

#### `web3pgp configuration generate [environment]`

Generate a template configuration file.

```bash
# Test environment (default)
web3pgp configuration generate

# Production environment
web3pgp configuration generate prod

# Save to file
web3pgp configuration generate prod -o ~/.web3pgp/config.yaml
```

**Arguments:**
- `environment`: 'test' or 'prod' (default: test)

**Options:**
- `-o, --output <path>`: Output file path (default: stdout)

#### `web3pgp configuration display`

Display the current configuration.

```bash
web3pgp configuration display
```

#### `web3pgp configuration validate`

Validate the current configuration.

```bash
web3pgp configuration validate
```

## Examples

### Generate a key and register it

```bash
# 1. Generate new key
web3pgp blockchain generate-key > account.json

# 2. Export the private key and use it for signing
export DEXES_WALLET_PRIVATE_KEY=$(jq -r '.privateKey' account.json)

# 3. Create/import your OpenPGP key
# (e.g., use Kleopatra or command line GPG tools)

# 4. Register it
web3pgp blockchain register --key my-key.asc
```

### Sync and export events

```bash
# Export all historical events to a file
web3pgp blockchain sync --from 0 --to latest > keys.json

# Listen for new events in real-time
web3pgp blockchain sync
```

## Troubleshooting

### Configuration not found

```bash
# Generate configuration in the default location
web3pgp configuration generate prod -o ~/.web3pgp/config.yaml
```

### RPC connection failed

Check your RPC endpoint configuration:

```bash
web3pgp configuration display
```

Verify the `ethereum.chain` matches your target network.

### Private key issues

Ensure your wallet private key is set correctly:

```bash
export DEXES_WALLET_PRIVATE_KEY=0xyourprivatekey...
web3pgp configuration validate
```

## Requirements

- **Node.js**: 18.x or higher
- **npm**: 8.x or higher

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or contributions:
- GitHub: https://github.com/cryptogram/web3pgp-cli
- Documentation: https://github.com/cryptogram/cryptogram
- Issues: https://github.com/cryptogram/cryptogram/issues

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
