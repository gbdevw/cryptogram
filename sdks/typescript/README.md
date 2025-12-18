# Dexes - Web3PGP SDK

A TypeScript SDK for managing OpenPGP keys on Ethereum through the Web3PGP smart contracts. Build decentralized key infrastructure with cryptographic operations powered by OpenPGP.

## Features

- 🔐 **OpenPGP Integration**: Seamless integration with OpenPGP.js for cryptographic operations
- ⛓️ **Ethereum Native**: Direct interaction with Web3PGP smart contracts
- 🔍 **Event Searching**: Query blockchain events for key registrations, subkey additions, and revocations
- ⚡ **Rate Limiting**: Built-in rate limiting to prevent RPC throttling
- 📦 **TypeScript First**: Full type safety with comprehensive TypeScript support
- 🧪 **Well Tested**: Comprehensive integration tests with Anvil blockchain

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
import { Web3PGP } from '@cryptogram/dexes';
import { createPublicClient, http } from 'viem';
import { inksepolia } from 'viem/chains';

// Create a Viem public client
const publicClient = createPublicClient({
  chain: inksepolia,
  transport: http('https://rpc-gel-sepolia.inkonchain.com'),
});

// Initialize Web3PGP
const contractAddress = '0x...'; // Your Web3PGP contract address
const web3pgp = new Web3PGP(publicClient, contractAddress);

// Search for key events
const events = await web3pgp.searchKeyEvents('earliest', 'latest');
console.log(events);
```

### With Web3PGPService (High-Level API)

```typescript
import { Web3PGPService, Web3PGP } from '@cryptogram/dexes';
import { createPublicClient, http } from 'viem';

const publicClient = createPublicClient({
  chain: inksepolia,
  transport: http('https://rpc-gel-sepolia.inkonchain.com'),
});

const web3pgp = new Web3PGP(publicClient, contractAddress);
const service = new Web3PGPService(web3pgp);

// Get a public key by fingerprint
const publicKey = await service.getPublicKey('0x1234567890abcdef...');

// Register a new key
await service.registerKey(armoredKey, walletClient);

// Add a subkey
await service.addSubkey(fingerprint, armoredSubkey, walletClient);

// Revoke a key
await service.revokeKey(fingerprint, revocationCertificate, walletClient);
```

## API Reference

### Web3PGP (Low-Level)

The `Web3PGP` class provides direct access to smart contract methods.

#### Methods

- `searchKeyEvents(fromBlock, toBlock)`: Search for key-related events
- `getPublicKey(fingerprint)`: Retrieve a public key from storage
- `registerKey(fingerprint, publicKey)`: Register a new key (requires wallet)
- `addSubkey(fingerprint, subkeyFingerprint, subkey)`: Add a subkey
- `revokeKey(fingerprint, revocationCertificate)`: Revoke a key

### Web3PGPService (High-Level)

The `Web3PGPService` class provides a higher-level API with OpenPGP integration.

#### Methods

- `getPublicKey(fingerprint)`: Get an OpenPGP PublicKey object
- `registerKey(armoredKey, walletClient)`: Register an armored key
- `addSubkey(fingerprint, armoredSubkey, walletClient)`: Add an armored subkey
- `revokeKey(fingerprint, revocationCertificate, walletClient)`: Revoke with certificate
- `searchKeyEvents(fromBlock, toBlock)`: Search for events with parsed results

## Environment

This SDK requires:

- **Node.js**: 18.x or higher
- **Viem**: ^2.0.0

## Testing

Run the test suite:

```bash
# Unit tests
npm run test:unit

# Integration tests (requires Anvil)
npm run test:integration

# All tests
npm run test:all
```

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to the main repository.

## Support

For issues, questions, or contributions, please visit:
- GitHub: https://github.com/cryptogram/dexes
- Documentation: https://github.com/cryptogram/cryptogram
