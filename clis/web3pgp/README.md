# Web3PGP CLI

A command-line interface for decentralized OpenPGP key infrastructure on Ethereum. Register, manage, and verify cryptographic identities directly from your terminal through the Web3PGP smart contract.

## What is Web3PGP?

Web3PGP enables a decentralized public key infrastructure (PKI) using OpenPGP and Ethereum. It allows:

- **Decentralized Key Registry**: Store and retrieve OpenPGP public keys on the blockchain
- **Identity Certification**: Establish trust chains by certifying keys on-chain
- **Key Revocation**: Revoke compromised or expired keys transparently
- **Transparent Auditing**: Immutable record of all key operations via blockchain events
- **Cost Efficiency**: Uses event logs for gas-optimized storage instead of contract state

The Web3PGP protocol is implemented as a set of smart contracts that provide a composable foundation for building decentralized PKI applications. The CLI is the primary tool for interacting with these contracts.

See [DEMO.md](../../DEMO.md) for a complete tutorial on using Web3PGP for timestamping and key certification.

## Features

- 🔐 **Key Management**: Register, revoke, and manage OpenPGP keys on-chain
- ⛓️ **Blockchain Sync**: Listen to blockchain events and listen to key changes and revocations in real-time
- 🔍 **Key Lookup**: Retrieve public keys by fingerprint from the blockchain
- ✅ **Key Certification**: Establish and revoke trust chains for identity verification
- ⚙️ **Configuration**: Flexible YAML-based and environment-variable configuration
- 🛡️ **Security**: Easy wallet coonfiiguration with private key management
- 🧩 **SDK-Powered**: Built on the Web3PGP TypeScript SDK for robust blockchain interaction

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

The CLI uses a flexible configuration system with multiple sources (defaults, YAML file, environment variables, CLI flags). See [CONFIGURATION.md](documentation/CONFIGURATION.md) for the complete reference.

### Quick Setup

Generate a configuration file:

```bash
web3pgp configuration generate prod -o ~/.web3pgp/config.yaml
```

Or set environment variables:

```bash
export DEXES_CHAIN=ink-sepolia
export DEXES_WALLET_PRIVATE_KEY=0x...
export DEXES_WEB3PGP_CONTRACT=0x72d02B94317ac899B34459a4e6685eFe12Ac17a8
export DEXES_LOG_LEVEL=info
```

### Custom Config File

Use a custom configuration file location:

```bash
web3pgp --config /path/to/custom/config.yaml blockchain get 0x...
```

### Configuration Topics

- **Detailed Reference**: See [CONFIGURATION.md](documentation/CONFIGURATION.md)
- **RPC Setup & Transport**: See [TRANSPORT.md](documentation/TRANSPORT.md) for batching, retries, and failover configuration

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
- *Development

### Getting Started with Development

See [DEV.md](documentation/DEV.md) for detailed information about:
- Project architecture and code structure
- How to set up the development environment
- Guidelines for adding new features and commands
- Configuration system design

### Running Tests

See [TEST.md](documentation/TEST.md) for comprehensive testing documentation:
- Unit tests: `npm test`
- Integration tests: `npm run test:integration`
- Test coverage: `npm run test:coverage`
- Watch mode: `npm run test:watch`

## Architecture

The Web3PGP CLI is built on top of the Web3PGP TypeScript SDK (`sdks/typescript/`), which provides:

- Smart contract abstractions for key operations
- OpenPGP message handling and validation
- Ethereum wallet integration
- Event listening and blockchain synchronization

The CLI layer adds:
- User-friendly command-line interface
- Configuration management
- Command routing and error handling
- Structured logging

## Documentation

- **[CONFIGURATION.md](documentation/CONFIGURATION.md)** - Complete configuration reference with examples
- **[TRANSPORT.md](documentation/TRANSPORT.md)** - RPC configuration, batching, and retry strategies
- **[DEV.md](documentation/DEV.md)** - Development guide and architecture overview
- **[TEST.md](documentation/TEST.md)** - Testing guide and test structure
- **[DEMO.md](../../DEMO.md)** - Complete end-to-end tutorial with timestamping and certification

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

See [DEV.md](documentation/DEV.md) for development setup and [TEST.md](documentation/TEST.md) for testing guidelines.