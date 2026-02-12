# Cryptogram

A decentralized infrastructure for cryptographic identity and document timestamping on Ethereum, enabling secure digital interactions through OpenPGP cryptography.

## Products

Cryptogram provides two complementary products for decentralized cryptographic operations:

### 🔐 Web3PGP
**Decentralized Public Key Infrastructure (PKI)**

Web3PGP enables a decentralized public key infrastructure using OpenPGP and Ethereum. It allows:

- **Decentralized Key Registry**: Store and retrieve OpenPGP public keys on the blockchain
- **Identity Certification**: Establish trust chains by certifying keys on-chain
- **Key Revocation**: Revoke compromised or expired keys transparently
- **Transparent Auditing**: Immutable record of all key operations via blockchain events
- **Cost Efficiency**: Uses event logs for gas-optimized storage instead of contract state

[📖 Web3PGP Documentation](clis/web3pgp/) | [⚙️ Web3PGP CLI](clis/web3pgp/)

### 📅 Web3Sign
**Document Timestamping & EDI System**

Web3Sign provides decentralized Electronic Data Interchange (EDI) with cryptographic timestamping:

- **Document Timestamping**: Create immutable timestamps for any digital document
- **Proof-of-Existence**: Cryptographically prove document existence at specific times
- **Certified Copies**: Track document provenance with signature workflows
- **Blockchain Verification**: Verify document integrity and timestamp authenticity
- **OpenPGP Integration**: Leverages Web3PGP keys for cryptographic operations

[📖 Web3Sign Documentation](clis/web3sign/) | [⚙️ Web3Sign CLI](clis/web3sign/)

## Project Structure

This monorepo contains all components of the Cryptogram ecosystem:

```
cryptogram/
├── contracts/           # Solidity smart contracts (Foundry)
│   ├── src/            # Contract source code
│   ├── test/           # Contract tests
│   └── scripts/        # Deployment & management scripts
├── clis/               # Command-line interfaces
│   ├── web3pgp/        # Web3PGP CLI
│   └── web3sign/       # Web3Sign CLI
├── sdks/               # Software development kits
│   └── typescript/     # TypeScript SDK
├── frontends/          # Web applications
│   ├── web3pgp/        # Web3PGP frontend
│   └── timestamp-verification/  # Timestamp verification tool
├── documentation/      # Project documentation
│   ├── NETWORKS.md     # Network information
│   └── SETUP.md        # Setup guides
├── examples/           # Usage examples and tutorials
└── scripts/            # Utility scripts
```

### 📚 Documentation Links

- **[Smart Contracts](contracts/)** - Foundry-based Solidity contracts
- **[Web3PGP CLI](clis/web3pgp/)** - Command-line tool for key management
- **[Web3Sign CLI](clis/web3sign/)** - Command-line tool for document timestamping
- **[TypeScript SDK](sdks/typescript/)** - SDK for integrating with applications
- **[Setup Guide](documentation/SETUP.md)** - Getting started with the project
- **[Network Information](documentation/NETWORKS.md)** - Deployed contract addresses

## Quick Start

### Prerequisites

- **Node.js** 18.x or higher
- **Foundry** (for smart contract development)
- **GPG** (for cryptographic operations)

### Installation

```bash
# Clone the repository
git clone https://github.com/cryptogram/cryptogram.git
cd cryptogram

# Install dependencies
npm install

# For contract development
cd contracts && forge install
```

### Basic Usage

```bash
# Generate a key and register it
web3pgp blockchain generate-key > key.json
export DEXES_WALLET_PRIVATE_KEY=$(jq -r '.privateKey' key.json)
web3pgp blockchain register --key my-key.asc

# Timestamp a document
web3sign timestamp -e <fingerprint> -H <hash> -s signature.asc
```

## Architecture

### Smart Contracts (Ethereum)
- **Web3PGP**: Core PKI contract for key registration and management
- **Web3Sign**: Timestamping contract for document verification
- **FlatFee**: Fee management with access control
- **AccessManager**: Role-based access control system

### Client Libraries
- **TypeScript SDK**: Comprehensive SDK for both Web3PGP and Web3Sign
- **CLIs**: Command-line tools for direct interaction
- **Web Frontends**: Browser-based interfaces

### Key Design Principles

- **Decentralized**: No central authority or single point of failure
- **Gas Efficient**: Event-based storage for cost optimization
- **Composability**: Modular design for integration with other systems
- **OpenPGP Native**: Leverages existing cryptographic standards
- **Upgradeable**: UUPS proxy pattern for future enhancements

## Development

### Building

```bash
# Build all components
npm run build

# Build contracts
cd contracts && forge build

# Build CLIs
cd clis/web3pgp && npm run build
cd clis/web3sign && npm run build
```

### Testing

```bash
# Test contracts
cd contracts && forge test

# Test CLIs
cd clis/web3pgp && npm test
cd clis/web3sign && npm test

# Test SDK
cd sdks/typescript && npm test
```

### Deployment

```bash
# Deploy contracts to testnet
cd contracts
forge script script/DeployTestEnvironment.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast

# Publish CLIs
cd clis/web3pgp && npm publish
cd clis/web3sign && npm publish
```

## Contributing

We welcome contributions to Cryptogram! Here's how to get involved:

### Development Process

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Reporting Issues

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/cryptogram/cryptogram/issues)
- 💡 **Feature Requests**: [GitHub Issues](https://github.com/cryptogram/cryptogram/issues)
- ❓ **Questions**: [GitHub Discussions](https://github.com/cryptogram/cryptogram/discussions)

### Guidelines

- Follow the existing code style and conventions
- Write tests for new functionality
- Update documentation for API changes
- Ensure all tests pass before submitting PRs

### Development Setup

See the [Setup Guide](documentation/SETUP.md) for detailed development environment setup.

## Security

Cryptogram takes security seriously:

- **Audit Ready**: Contracts designed with security best practices
- **OpenPGP Validation**: All cryptographic validation performed off-chain
- **Access Control**: Role-based permissions for sensitive operations
- **Upgradeable**: Secure upgrade mechanisms for bug fixes

For security-related issues, please email security@cryptogram.dev instead of creating public issues.

## License

Business Source License 1.1 - see [LICENSE](LICENSE) file for details.

## Community

- **GitHub**: [cryptogram/cryptogram](https://github.com/cryptogram/cryptogram)
- **Documentation**: [docs.cryptogram.dev](https://docs.cryptogram.dev)
- **Twitter**: [@cryptogram](https://twitter.com/cryptogram)

---

*Cryptogram - Decentralized Cryptography for the Digital Age*</content>
<parameter name="filePath">/home/gbdevw/Projects/cryptogram/README.md