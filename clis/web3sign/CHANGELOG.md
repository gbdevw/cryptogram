# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-12-15

### Added

- Initial public release of @cryptogram/web3pgp-cli
- `blockchain` command group for key management operations
- `configuration` command group for configuration management

### Blockchain Commands

- `generate-key`: Generate new Ethereum private keys
- `get <fingerprint>`: Retrieve public keys from the blockchain
- `register [options]`: Register OpenPGP keys on-chain
- `add-subkey [options] <subkeyFingerprint>`: Add subkeys to existing keys
- `revoke [options] <fingerprint>`: Revoke keys on-chain
- `sync [options]`: Listen for blockchain events in real-time

### Configuration Commands

- `generate [environment]`: Generate template configurations (test/prod)
- `display`: Show current configuration
- `validate`: Validate configuration integrity

### Features

- Support for both test (scrollSepolia) and production (scroll) environments
- Graceful shutdown with SIGINT/SIGTERM signal handling
- Real-time event monitoring with configurable polling intervals
- Secure wallet integration via environment variables
- Structured logging with Pino
- YAML configuration file support
- Armored OpenPGP message output

### Configuration

- Test environment defaults with Scroll Sepolia
- Production environment configuration templates
- Environment variable overrides (DEXES_* prefix)
- Configuration validation and display commands

### Testing

- Comprehensive unit and integration tests
- Jest test framework with TypeScript support
- Integration tests with Anvil blockchain

### Documentation

- Complete README with installation instructions
- Command reference for all CLI commands
- Configuration guide with examples
- Troubleshooting section

### Code Quality

- ESLint configuration for code linting
- Prettier configuration for code formatting
- TypeScript strict mode for type safety
- Comprehensive error handling and validation

### CLI Features

- Commander.js for professional CLI structure
- Hierarchical command structure (blockchain, configuration)
- Proper exit codes for error handling
- Colored output support via Pino
- Signal handling for graceful process termination

## Known Limitations

- Requires Node.js 18.x or higher
- Configuration file required at `~/.web3pgp/config.yaml`
- Private key management requires environment variables for security
- Contract address must be configured for blockchain operations
- Currently supports Ethereum and Scroll chain only
