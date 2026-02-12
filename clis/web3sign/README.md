# Web3Sign CLI

A command-line interface for timestamping documents on Ethereum through the Web3Sign smart contracts. Create tamper-proof timestamps for any digital document with cryptographic verification.

## Features

- 📅 **Document Timestamping**: Create immutable timestamps for any digital document
- 🔐 **Cryptographic Verification**: Verify document integrity and timestamp authenticity
- 🔍 **Blockchain Verification**: Check timestamps against on-chain records
- ⚙️ **Configuration**: Generate and manage environment-specific configurations
- 📊 **Event Monitoring**: Real-time monitoring of timestamp events
- 🛡️ **Security**: Secure wallet integration with private key management

## Installation

### Global Installation (Recommended)

```bash
npm install -g @cryptogram/web3sign-cli
```

Then use directly:

```bash
web3sign --help
```

### Local Installation

```bash
npm install --save-dev @cryptogram/web3sign-cli
```

Then use with npx:

```bash
npx web3sign --help
```

### Direct Execution (No Installation)

```bash
npx @cryptogram/web3sign-cli --help
```

## Quick Start

### 1. Generate Configuration

```bash
# Generate test environment configuration
web3sign configuration generate test

# Or production configuration
web3sign configuration generate prod

# Save to a file
web3sign configuration generate test -o ~/.web3sign/config.yaml
```

### 2. Timestamp Your First Document

See the complete [timestamping example](examples/timestamping.md) for a step-by-step guide on how to:

- Create cryptographic timestamps for documents
- Verify document integrity and timestamp authenticity
- Use detached signatures with PGP keys registered on Web3PGP

### Example Usage

```bash
# Timestamp a document with a detached signature
web3sign timestamp -e <key-fingerprint> -H <document-hash> -s <signature-file>

# Verify a timestamp
web3sign verify --id <timestamp-id> --doc <document-path>

# Find all timestamps for a document
web3sign verify --all --doc <document-path>
```

## Configuration

The CLI requires a configuration file at `~/.web3sign/config.yaml`. Generate a default:

```bash
web3sign configuration generate test -o ~/.web3sign/config.yaml
```

### Configuration Structure

```yaml
ethereum:
  chain: sepolia  # Target blockchain (sepolia for testnet, ink for mainnet)
  
  wallet:
    type: private-key
    privateKey: "${DEXES_WALLET_PRIVATE_KEY}"  # Use environment variable

web3pgp:
  contract: "0x82733B49e65A2FE6B611e5CE454AC21237071638"  # Web3PGP contract address

web3sign:
  contract: "0x6f81441691340Bcf41b7eC323b6E74645820389E"  # Web3Sign contract address

monitoring:
  logging:
    level: info  # debug, info, warn, error
```

### Environment Variables

Override configuration with environment variables:

```bash
export DEXES_CHAIN=sepolia
export DEXES_WALLET_PRIVATE_KEY=0x...
export DEXES_WEB3PGP_CONTRACT=0x82733B49e65A2FE6B611e5CE454AC21237071638
export DEXES_WEB3SIGN_CONTRACT=0x6f81441691340Bcf41b7eC323b6E74645820389E
export DEXES_LOG_LEVEL=debug
```

## Commands

### Timestamp Commands

#### `web3sign timestamp [options]`

Create a timestamp for a document with a detached signature.

```bash
# Timestamp with signature file
web3sign timestamp -e <emitter-fingerprint> -H <document-hash> -s <signature-file>

# Timestamp with signature from stdin
cat signature.asc | web3sign timestamp -e <emitter-fingerprint> -H <document-hash>
```

#### `web3sign verify [options]`

Verify timestamps for documents.

```bash
# Verify specific timestamp
web3sign verify --id <timestamp-id> --doc <document-path>

# Find all timestamps for a document
web3sign verify --all --doc <document-path>

# Verify using document hash
web3sign verify --id <timestamp-id> --hash <document-hash>
```

### Configuration Commands

#### `web3sign configuration generate [environment]`

Generate configuration templates.

```bash
web3sign configuration generate test   # Test environment (Sepolia)
web3sign configuration generate prod   # Production environment (Ink)
```

#### `web3sign configuration display`

Display current configuration.

```bash
web3sign configuration display
```

#### `web3sign configuration validate`

Validate configuration file.

```bash
web3sign configuration validate
```

## Documentation

For detailed configuration options, RPC setup, and advanced usage:

- [Configuration Reference](documentation/CONFIGURATION.md) - Complete configuration guide
- [Transport Documentation](documentation/TRANSPORT.md) - RPC configuration and batching strategies

## Examples

### Complete Timestamping Workflow

See the [timestamping example](examples/timestamping.md) for a comprehensive guide on:

- Creating document timestamps with cryptographic signatures
- Verifying document integrity and timestamp authenticity
- Using Web3Sign with keys registered on Web3PGP

### Basic Usage

```bash
# 1. Generate configuration
web3sign configuration generate test -o ~/.web3sign/config.yaml

# 2. Set your wallet private key
export DEXES_WALLET_PRIVATE_KEY=0x...

# 3. Create a timestamp
web3sign timestamp -e <your-key-fingerprint> -H <document-hash> -s signature.asc

# 4. Verify the timestamp
web3sign verify --id <timestamp-id> --doc document.txt
```

## Prerequisites

- **Web3PGP Key**: You need a PGP key registered on Web3PGP to create timestamps
- **GPG Tools**: Install GPG for creating detached signatures
- **Node.js**: Required for CLI installation
- **Ethereum Wallet**: Private key for blockchain transactions

## Troubleshooting

### Configuration Issues

```bash
# Generate fresh configuration
web3sign configuration generate test -o ~/.web3sign/config.yaml

# Validate configuration
web3sign configuration validate

# Display current config
web3sign configuration display
```

### RPC Connection Problems

Verify your RPC endpoints:

```bash
web3sign configuration display | grep -A 10 "rpc:"
```

Ensure the `ethereum.chain` setting matches your target network.

### Timestamp Verification Fails

- Check that the document hash matches exactly
- Verify the PGP key used for signing is registered on Web3PGP
- Ensure the signature is a valid detached signature over the document hash

### Wallet/Private Key Issues

```bash
# Verify private key format (should start with 0x and be 64 hex chars)
echo $DEXES_WALLET_PRIVATE_KEY | head -c 10
```

## Contributing

This CLI is part of the Cryptogram project. See the main project repository for contribution guidelines.

## License

See LICENSE file in the project root.
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
