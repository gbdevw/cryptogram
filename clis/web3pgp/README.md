# Web3PGP CLI

A command-line interface for decentralized OpenPGP key infrastructure on Ethereum. Register, manage, and verify cryptographic identities directly from your terminal through the Web3PGP smart contract.

## Related CLIs

This is one of two CLIs in the Cryptogram project:

- **[Web3PGP CLI](web3pgp/)** - Manage OpenPGP keys on Ethereum
- **[Web3Sign CLI](web3sign/)** - Timestamp documents with cryptographic verification

## What is Web3PGP?

Web3PGP enables a decentralized public key infrastructure (PKI) using OpenPGP and Ethereum. It allows:

- **Decentralized Key Registry**: Store and retrieve OpenPGP public keys on the blockchain
- **Identity Certification**: Establish trust chains by certifying keys on-chain
- **Key Revocation**: Revoke compromised or expired keys transparently
- **Transparent Auditing**: Immutable record of all key operations via blockchain events
- **Cost Efficiency**: Uses event logs for gas-optimized storage instead of contract state

The Web3PGP protocol is implemented as a set of smart contracts that provide a composable foundation for building decentralized PKI applications. The CLI is the primary tool for interacting with these contracts.

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
npm install -g @jibidieuw/web3pgp-cli
```

Then use directly:

```bash
web3pgp --help
```

### Local Installation

```bash
npm install --save-dev @jibidieuw/web3pgp-cli
```

Then use with npx:

```bash
npx web3pgp --help
```

### Direct Execution (No Installation)

```bash
npx @jibidieuw/web3pgp-cli --help
```

## Create and fund your Ethereum key

Generate an Ethereum private key for signing transactions:

```bash
web3pgp generate-key
```

The CLI uses this approach for automation-friendly, low-risk operations. A small amount of ETH woorth a few dollars covers severall dozens of write operations; read operations are free unless using private RPC endpoints.

Fund your key on the target blockchain (Sepolia for testing, Scroll for production).

## Quick Start

Guides about how to use the CLI can be found [in the 'examples' folder](clis/web3pgp/examples/USE_WITH_GPG.md).

## Configuration

The CLI uses a flexible configuration system with multiple sources (defaults, YAML file, environment variables, CLI flags). See [CONFIGURATION.md](documentation/CONFIGURATION.md) for the complete reference.


## Getting Started with Development

See [DEV.md](documentation/DEV.md) for detailed information about:
- Project architecture and code structure
- How to set up the development environment
- Guidelines for adding new features and commands
- Configuration system design

## Running Tests

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