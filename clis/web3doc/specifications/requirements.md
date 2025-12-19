# Web3PGP CLI - Requirements Specification

## Overview

The Web3PGP CLI is a command-line interface for managing OpenPGP keys on the Ethereum blockchain. It provides direct access to the Web3PGP service functionality, allowing users to register keys, add subkeys, revoke keys, retrieve keys, and listen to blockchain events.

## Key Features

### 1. Subcommands

The CLI implements the following subcommands based on the Web3PGP service interface:

#### `register`
Register a new OpenPGP public key (primary key with optional subkeys) on the blockchain.

**Inputs:**
- Path to armored PGP public key file or stdin
- Configuration parameters (RPC endpoint, wallet)

**Outputs:**
- JSON transaction receipt to stdout

---

#### `addSubkey`
Add a new subkey to an already registered primary key on the blockchain.

**Inputs:**
- Path to armored PGP public key file or stdin (containing both primary key and new subkey)
- Subkey fingerprint to add
- Configuration parameters

**Outputs:**
- JSON transaction receipt to stdout

---

#### `revoke`
Publish a key revocation certificate on the blockchain.

**Inputs:**
- Path to revoked OpenPGP public key OR revocation certificate (armored format) or stdin
- Fingerprint of the key being revoked (primary key or subkey)
- Configuration parameters

**Outputs:**
- JSON transaction receipt to stdout

---

#### `getPublicKey`
Retrieve and reconstruct an OpenPGP public key from the blockchain by its fingerprint.

**Inputs:**
- Fingerprint of the key to retrieve (0x-prefixed hex string)
- Configuration parameters

**Outputs:**
- Armored OpenPGP public key to stdout

---

#### `listen`
Continuous listening of blockchain events related to key registration, subkey addition, and revocation. Prints received events in real-time.

**Inputs:**
- Optional filter parameters (e.g., specific fingerprints)
- Configuration parameters

**Outputs:**
- JSON-formatted event data to stdout (one event per line)
- All other logging to stderr (JSON formatted)

---

### 2. Configuration System

The CLI uses a hierarchical configuration system with the following priority (highest to lowest):

1. **Command Flags** - Explicit command-line arguments
2. **Environment Variables** - Prefixed with `WEB3PGP_`
3. **Configuration File** - YAML format (default location: `$HOME/.web3pgp/config.yaml` or specified via `--config` flag)
4. **Defaults** - Built-in sensible defaults

#### Configuration Scope

Configuration covers:
- **Ethereum RPC**: Multiple endpoints with fallback support, authorization for services (Infura, Alchemy)
- **Wallet**: Private key-based wallet (future support for hardware wallets, Ledger, etc.)
- **Logging**: Log level, format
- **Misc**: Web3PGP contract address, network details

#### Details

See `configuration.md` for complete configuration keys and structure.

---

### 3. Output Handling

#### Stdout
- **Subcommands (`register`, `addSubkey`, `revoke`)**: JSON transaction receipt
- **`getPublicKey` subcommand**: Armored OpenPGP public key (plain text, not JSON)
- **`listen` subcommand**: JSON-formatted event objects (one per line)

#### Stderr
- All logging output in JSON format (structured logging)
- Includes: timestamps, log levels, component names, error details
- Never used for normal command output

---

### 4. Error Handling

- Validation errors should be reported with clear messages
- Failed transactions should include revert reasons if available
- Exit codes:
  - `0`: Success
  - `1`: General error
  - `2`: Configuration error
  - `3`: Validation error
  - `4`: Blockchain/transaction error

---

### 5. Logging

All logging is JSON-formatted to stderr with the following structure:

```json
{
  "timestamp": "2025-12-03T10:30:45.123Z",
  "level": "info|warn|error|debug",
  "component": "component_name",
  "message": "Human-readable message",
  "details": {...}
}
```

Log levels should be configurable via environment variable or config file.

---

## Non-Functional Requirements

### Performance
- CLI should start quickly (< 500ms)
- Large key operations should provide progress feedback via logging

### Compatibility
- Works across Linux, macOS, and Windows
- Supports Node.js 18+

### Maintainability
- Clear separation of concerns (config, logging, commands, service layer)
- Comprehensive error messages for debugging
- Well-documented code with JSDoc

---

## Future Considerations

- Hardware wallet support (Ledger, Trezor)
- Multi-signature wallet support
- Key export/import functionality
- Batch operations
- Watch mode for specific keys/addresses
- Integration with GPG keyring
