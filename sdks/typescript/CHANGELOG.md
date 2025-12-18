# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-15

### Added

- Initial public release of @cryptogram/dexes
- `Web3PGP` class for low-level smart contract interactions
- `Web3PGPService` class for high-level OpenPGP integration
- `searchKeyEvents()` method for querying blockchain events
- Support for key registration, subkey addition, and key revocation
- Rate limiting with Bottleneck to prevent RPC throttling
- Comprehensive integration tests with Anvil blockchain
- Full TypeScript support with type definitions
- Support for Viem ^2.0.0

### Features

- Query blockchain events for `KeyRegistered`, `SubkeyAdded`, and `KeyRevoked` events
- Extract and parse OpenPGP keys from blockchain events
- Type-safe event filtering and validation
- Rate-limited contract calls to prevent throttling
- Proper error handling with descriptive messages

### Testing

- 44 comprehensive integration tests
- Tests covering all major SDK functionality
- Event search with various block ranges and filter combinations
- Proper test setup and cleanup with Anvil

### Documentation

- Complete README with installation and usage examples
- API reference for Web3PGP and Web3PGPService
- Quick start guide with code examples

## Security

- OpenPGP operations handled securely
- Blockchain transaction validation
- Input validation for all contract calls
- No hardcoded secrets or sensitive data

## Known Limitations

- Requires a valid Viem PublicClient for blockchain interaction
- Contract address must be correctly configured
- Supports Ethereum and compatible chains only
