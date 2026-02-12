# Dexes - Web3PGP & Web3Sign SDK

A TypeScript SDK for managing OpenPGP keys and timestamping documents on Ethereum through the Web3PGP and Web3Sign smart contracts. Build decentralized key infrastructure and document timestamping with cryptographic operations powered by OpenPGP.

## Features

- 🔐 **OpenPGP Integration**: Seamless integration with OpenPGP.js for cryptographic operations
- ⛓️ **Ethereum Native**: Direct interaction with Web3PGP and Web3Sign smart contracts
- 📅 **Document Timestamping**: Create immutable timestamps for any digital document
- 🔍 **Event Searching**: Query blockchain events for key registrations, subkey additions, revocations, and timestamps
- ⚡ **Viem integration**: Viem is used for its fallback and batching features.
- 📦 **TypeScript First**: Full type safety with comprehensive TypeScript support
- 🧪 **Well Tested**: Comprehensive integration tests with contracts deployed on Sepolia

## Installation

```bash
npm install @cryptogram/dexes
```

Or with yarn:

```bash
yarn add @cryptogram/dexes
```

Or with pnpm:

```bash
pnpm add @cryptogram/dexes
```

## Quick Start

### Basic Usage

```typescript
import { Web3PGP, Web3Sign } from '@cryptogram/dexes';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

// Create a Viem public client
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
});

// Initialize Web3PGP
const web3pgpAddress = '0x82733B49e65A2FE6B611e5CE454AC21237071638';
const web3pgp = new Web3PGP(publicClient, web3pgpAddress);

// Initialize Web3Sign
const web3signAddress = '0x6f81441691340Bcf41b7eC323b6E74645820389E';
const web3sign = new Web3Sign(publicClient, web3signAddress);

// Search for key events
const keyEvents = await web3pgp.searchKeyEvents('earliest', 'latest');
console.log('Key events:', keyEvents);

// Search for timestamp events
const timestampEvents = await web3sign.searchTimestampEvents('earliest', 'latest');
console.log('Timestamp events:', timestampEvents);
```

### With Web3PGPService (High-Level API)

```typescript
import { Web3PGPService, Web3PGP, Web3SignService, Web3Sign } from '@cryptogram/dexes';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
});

const web3pgp = new Web3PGP(publicClient, '0x82733B49e65A2FE6B611e5CE454AC21237071638');
const web3pgpService = new Web3PGPService(web3pgp);

// Get a public key by fingerprint
const publicKey = await web3pgpService.getPublicKey('0x1234567890abcdef...');

// Register a new key
await web3pgpService.registerKey(armoredKey, walletClient);

// Add a subkey
await web3pgpService.addSubkey(fingerprint, armoredSubkey, walletClient);

// Revoke a key
await web3pgpService.revokeKey(fingerprint, revocationCertificate, walletClient);

// Web3Sign for timestamping
const web3sign = new Web3Sign(publicClient, '0x6f81441691340Bcf41b7eC323b6E74645820389E');
const web3signService = new Web3SignService(web3sign);

// Create a timestamp
await web3signService.timestampDocument(documentHash, signature, emitterFingerprint, walletClient);

// Verify a timestamp
const verification = await web3signService.verifyTimestamp(timestampId, documentHash);
```

## API Reference

### Web3PGP (Low-Level)

The `Web3PGP` class provides direct access to Web3PGP smart contract methods.

#### Methods

- `searchKeyEvents(fromBlock, toBlock)`: Search for key-related events
- `getPublicKey(fingerprint)`: Retrieve a public key from storage
- `registerKey(fingerprint, publicKey)`: Register a new key (requires wallet)
- `addSubkey(fingerprint, subkeyFingerprint, subkey)`: Add a subkey
- `revokeKey(fingerprint, revocationCertificate)`: Revoke a key

### Web3Sign (Low-Level)

The `Web3Sign` class provides direct access to Web3Sign smart contract methods.

#### Methods

- `searchTimestampEvents(fromBlock, toBlock)`: Search for timestamp-related events
- `getTimestamp(timestampId)`: Retrieve a timestamp by ID
- `timestampDocument(documentHash, signature, emitterFingerprint)`: Create a timestamp (requires wallet)
- `verifyTimestamp(timestampId, documentHash)`: Verify a timestamp against a document hash

### Web3PGPService (High-Level)

The `Web3PGPService` class provides a higher-level API with OpenPGP integration.

#### Methods

- `getPublicKey(fingerprint)`: Get an OpenPGP PublicKey object
- `registerKey(armoredKey, walletClient)`: Register an armored key
- `addSubkey(fingerprint, armoredSubkey, walletClient)`: Add an armored subkey
- `revokeKey(fingerprint, revocationCertificate, walletClient)`: Revoke with certificate
- `searchKeyEvents(fromBlock, toBlock)`: Search for events with parsed results

### Web3SignService (High-Level)

The `Web3SignService` class provides a higher-level API for document timestamping with cryptographic verification.

#### Methods

- `timestampDocument(documentHash, signature, emitterFingerprint, walletClient)`: Create a timestamp for a document
- `verifyTimestamp(timestampId, documentHash)`: Verify a timestamp against a document hash
- `getTimestamp(timestampId)`: Get timestamp details by ID
- `searchTimestampsByHash(documentHash, fromBlock, toBlock)`: Find all timestamps for a document hash
- `searchTimestampEvents(fromBlock, toBlock)`: Search for timestamp events with parsed results

## Environment

This SDK requires:

- **Node.js**: 18.x or higher
- **Viem**: ^2.0.0

## Testing

Run the test suite:

```bash
# Unit tests
npm run test:unit

# Integration tests (connects to Sepolia testnet)
npm run test:integration

# All tests
npm run test:all
```

## Updating Contract ABIs

The SDK includes contract ABIs that must stay synchronized with the deployed smart contracts. When the contracts in `/contracts` are modified, you need to refresh the ABIs:

### Why Update ABIs?

The ABIs define the smart contract function signatures, events, and error types. When contract changes are deployed, the ABIs must be updated to ensure:
- ✓ Type safety matches current contract implementation
- ✓ New functions/events are available to the SDK
- ✓ Integration tests work with the latest contract code
- ✓ No runtime errors from mismatched function signatures

### How to Update ABIs

```bash
npm run update-abis
```

This command:
1. Compiles smart contracts using Foundry (`forge build`)
2. Extracts ABIs from compiled artifacts
3. Generates TypeScript files in `src/abis/`
4. Validates all contract artifacts are present

**Note**: This task is automatically run before integration tests, but should be manually run whenever smart contracts are modified.

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to the main repository.

## Support

For issues, questions, or contributions, please visit:
- GitHub: https://github.com/cryptogram/dexes
- Documentation: https://github.com/cryptogram/cryptogram
