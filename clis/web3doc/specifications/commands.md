# Web3PGP CLI - Commands Specification

## Command Structure

All commands follow the pattern:
```bash
web3pgp [global-options] <command> [command-options] [arguments]
```

### Global Options

Available for all commands:

```
--config, -c <path>     Path to configuration file (default: $HOME/.web3pgp/config.yaml)
--log-level <level>, -L Logging level (debug, info, warn, error)
--help, -h              Show help message
--version, -v           Show version
```

### Fingerprint Format

**Important**: Always use full-length fingerprints (40 hex characters, 0x-prefixed). 

**Why full-length fingerprints matter:**
- The smart contract stores fingerprints as `bytes32` to ensure compatibility with upcoming OpenPGP RFC standards for Post-Quantum Cryptography (which will use 32-byte fingerprints)
- Fingerprints (20 bytes or 16 bytes) are left-padded with zeros to fill the 32-byte field
- Using truncated fingerprints (Key IDs) can cause:
  - **Collisions**: Multiple keys could map to the same padded value
  - **Retrieval failures**: Users may retrieve incorrect keys from the contract
- Example of proper format: `0xabcdef1234567890abcdef1234567890abcdef12` (40 hex characters)

---

## Commands

### `register`

Register a new OpenPGP public key (primary key with optional subkeys) on the blockchain.

#### Usage

```bash
web3pgp register [options] [--key <path> | --stdin]
```

#### Options

```
--key <path>          Path to armored PGP public key file
--stdin               Read key from stdin (default if --key not provided)
--chain-id <id>       Chain ID (overrides network setting from config)
--rpc-url <url>       Ethereum RPC endpoint URL (overrides config)
--web3pgp-address <addr> Web3PGP contract address (overrides config)
--private-key <key>   Private key for wallet (0x-prefixed hex string, overrides config)
--help, -h            Show help for this command
```

#### Inputs

1. **PGP Public Key**: One of:
   - File path via `--key` flag
   - Stdin if no `--key` provided
   - Format: Armored OpenPGP public key block

#### Processing

1. Read OpenPGP key from input
2. Parse and validate the key using OpenPGP.js
3. Verify the key and all subkeys are valid (not expired, not revoked at time of publication)
4. Extract primary key and subkey fingerprints
5. Serialize key to binary format
6. Submit transaction to Web3PGP contract via `register()` method
7. Wait for transaction confirmation
8. Output transaction receipt to stdout

#### Outputs

**Success (stdout):**
```json
{
  "transactionHash": "0x123abc...",
  "blockNumber": 12345678,
  "from": "0xabc123...",
  "to": "0xdef456...",
  "gasUsed": "150000",
  "gasPrice": "20000000000",
  "status": 1,
  "logs": [
    {
      "address": "0xdef456...",
      "topics": [
        "0x123abc... (KeyRegistered event signature)"
      ],
      "data": "0x...",
      "blockNumber": 12345678,
      "transactionHash": "0x123abc...",
      "logIndex": 0
    }
  ]
}
```

**Error (stderr - JSON log):**
```json
{
  "timestamp": "2025-12-03T10:30:45.123Z",
  "level": "error",
  "component": "commands/register",
  "message": "Key registration failed",
  "details": {
    "errorCode": "BLOCKCHAIN_ERROR",
    "reason": "KeyAlreadyExists",
    "transactionHash": "0x...",
    "blockNumber": 12345678
  }
}
```

#### Exit Codes

- `0`: Success
- `2`: Configuration error
- `3`: Validation error (invalid key format, etc.)
- `4`: Blockchain error (transaction failed, key already exists, etc.)

#### Examples

```bash
# From file
web3pgp register --key /path/to/key.asc

# From stdin
cat my-key.asc | web3pgp register

# With custom RPC and contract
web3pgp \
  --rpc-url "https://eth-mainnet.g.alchemy.com/v2/xxx" \
  --private-key "0x..." \
  --web3pgp-address "0x..." \
  register --key my-key.asc

# Using config file
web3pgp --config ~/.web3pgp/mainnet.yaml register --key my-key.asc
```

---

### `addSubkey`

Add a new subkey to an already registered primary key on the blockchain.

#### Usage

```bash
web3pgp addSubkey [options] <subkey-fingerprint> [--key <path> | --stdin]
```

#### Arguments

```
<subkey-fingerprint>  Full-length fingerprint of the specific subkey to add from the provided key (0x-prefixed hex string)
```

#### Options

```
--key <path>          Path to armored PGP public key file containing both primary and new subkey
--stdin               Read key from stdin (default if --key not provided)
--chain-id <id>       Chain ID (overrides network setting from config)
--rpc-url <url>       Ethereum RPC endpoint URL (overrides config)
--web3pgp-address <addr> Web3PGP contract address (overrides config)
--private-key <key>   Private key for wallet (0x-prefixed hex string, overrides config)
--help, -h            Show help for this command
```

#### Inputs

1. **Subkey Fingerprint**: Full-length 0x-prefixed hex string (40 hex characters) identifying which subkey within the provided key should be added
2. **PGP Public Key**: File or stdin containing both the primary key and the new subkey to add
   - Format: Armored OpenPGP public key block

#### Processing

1. Read OpenPGP key from input
2. Parse and validate the key
3. Verify the key contains both the primary key and the specified subkey (by fingerprint)
4. Verify the primary key and subkey are valid (not expired, not revoked at time of addition)
5. Extract primary key fingerprint from the key
6. Serialize key material (primary + subkey) to binary format
7. Submit transaction to Web3PGP contract via `addSubkey()` method (contract will verify existence)
8. Wait for transaction confirmation
9. Output transaction receipt to stdout

#### Outputs

**Success (stdout):**
```json
{
  "transactionHash": "0x456def...",
  "blockNumber": 12345679,
  "from": "0xabc123...",
  "to": "0xdef456...",
  "gasUsed": "180000",
  "gasPrice": "20000000000",
  "status": 1,
  "logs": [...]
}
```

**Error (stderr - JSON log):**
```json
{
  "timestamp": "2025-12-03T10:30:46.456Z",
  "level": "error",
  "component": "commands/addSubkey",
  "message": "Failed to add subkey",
  "details": {
    "errorCode": "VALIDATION_ERROR",
    "reason": "Primary key not registered on-chain",
    "primaryKeyFingerprint": "0x..."
  }
}
```

#### Exit Codes

- `0`: Success
- `2`: Configuration error
- `3`: Validation error (invalid subkey fingerprint, primary key not found, etc.)
- `4`: Blockchain error (transaction failed, subkey already exists, etc.)

#### Examples

```bash
# Add subkey from file
web3pgp addSubkey 0xabcdef123456... --key /path/to/key.asc

# Add subkey from stdin
cat my-key.asc | web3pgp addSubkey 0xabcdef123456...

# Specify subkey fingerprint from armored key
PRIMARY_FP="0x$(gpg --with-fingerprint my-key.asc | grep -oE '[A-F0-9]{40}' | head -1)"
SUBKEY_FP="0x$(gpg --with-fingerprint my-key.asc | grep -oE '[A-F0-9]{40}' | tail -1)"
web3pgp addSubkey "$SUBKEY_FP" --key my-key.asc
```

---

### `revoke`

Publish a key revocation certificate on the blockchain.

#### Usage

```bash
web3pgp revoke [options] <fingerprint> [--key <path> | --stdin]
```

#### Arguments

```
<fingerprint>  Fingerprint of the key being revoked (0x-prefixed hex string)
```

#### Options

```
--key <path>          Path to revoked OpenPGP key or revocation certificate file
--stdin               Read from stdin (default if --key not provided)
--chain-id <id>       Chain ID (overrides network setting from config)
--rpc-url <url>       Ethereum RPC endpoint URL (overrides config)
--web3pgp-address <addr> Web3PGP contract address (overrides config)
--private-key <key>   Private key for wallet (0x-prefixed hex string, overrides config)
--help, -h            Show help for this command
```

#### Inputs

1. **Fingerprint**: Full-length 0x-prefixed hex string (40 hex characters) identifying the key/subkey being revoked
2. **Key or Certificate**: One of:
   - Revoked OpenPGP public key (armored format)
   - Standalone revocation certificate (armored format)
   - Via file or stdin

#### Processing

1. Read key or certificate from input
2. Attempt to parse as OpenPGP key; if fails, parse as standalone revocation certificate
3. If a standalone certificate is provided:
   - Download the public key from the blockchain by fingerprint
   - Apply the revocation certificate to the key
   - Verify the key is effectively revoked at present time
4. Otherwise (key certificate provided):
   - Verify the key/certificate effectively revokes the target fingerprint at present time
5. Serialize revoked key or certificate to binary format
6. Submit transaction to Web3PGP contract via `revoke()` method (contract will verify existence)
7. Wait for transaction confirmation
8. Output transaction receipt to stdout

#### Outputs

**Success (stdout):**
```json
{
  "transactionHash": "0x789ghi...",
  "blockNumber": 12345680,
  "from": "0xabc123...",
  "to": "0xdef456...",
  "gasUsed": "165000",
  "gasPrice": "20000000000",
  "status": 1,
  "logs": [...]
}
```

**Error (stderr - JSON log):**
```json
{
  "timestamp": "2025-12-03T10:30:47.789Z",
  "level": "error",
  "component": "commands/revoke",
  "message": "Key revocation failed",
  "details": {
    "errorCode": "VALIDATION_ERROR",
    "reason": "Key is not registered on-chain",
    "fingerprint": "0x..."
  }
}
```

#### Exit Codes

- `0`: Success
- `2`: Configuration error
- `3`: Validation error (invalid format, key not found, etc.)
- `4`: Blockchain error (transaction failed, key not registered, etc.)

#### Examples

```bash
# Revoke using revoked key
gpg --output revoked-key.asc --export-options export-revocation --import-options import-revocation --armor <key-id>
web3pgp revoke 0xabcdef123456... --key revoked-key.asc

# Revoke using revocation certificate
gpg --generate-revocation <key-id> > revocation.asc
web3pgp revoke 0xabcdef123456... --key revocation.asc

# Revoke from stdin
cat revoked-key.asc | web3pgp revoke 0xabcdef123456...
```

---

### `getPublicKey`

Retrieve and reconstruct an OpenPGP public key from the blockchain by its fingerprint.

#### Usage

```bash
web3pgp getPublicKey [options] <fingerprint>
```

#### Arguments

```
<fingerprint>  Full-length fingerprint of the key to retrieve (0x-prefixed hex string)
```

#### Options

```
--chain-id <id>       Chain ID (overrides network setting from config)
--rpc-url <url>       Ethereum RPC endpoint URL (overrides config)
--web3pgp-address <addr> Web3PGP contract address (overrides config)
--help, -h            Show help for this command
```

#### Processing

1. Verify configuration is valid
2. Verify key exists on-chain
3. Retrieve the block numbers where events related to the target key were published
5. Fetch the KeyRegistered and SubkeyAdded events from these blocks
6. Extract binary OpenPGP messages from the events
7. Parse and validate the OpenPGP messages and reconstruct the full key
8. Check for published revocations
9. Apply revocation signatures if found
10. Output armored public key to stdout

#### Outputs

**Success (stdout - Plain armored key, not JSON):**
```
-----BEGIN PGP PUBLIC KEY BLOCK-----

xjMEZXe4dBYJKwYBBAHaRw8BAQdA...
(key content)
-----END PGP PUBLIC KEY BLOCK-----
```

**Error (stderr - JSON log):**
```json
{
  "timestamp": "2025-12-03T10:30:48.012Z",
  "level": "error",
  "component": "commands/getPublicKey",
  "message": "Failed to retrieve public key",
  "details": {
    "errorCode": "BLOCKCHAIN_ERROR",
    "reason": "Key not found on-chain",
    "fingerprint": "0x..."
  }
}
```

#### Exit Codes

- `0`: Success
- `2`: Configuration error
- `3`: Validation error (invalid fingerprint format, etc.)
- `4`: Blockchain error (key not found, corrupted data, etc.)

#### Examples

```bash
# Get key and display
web3pgp getPublicKey 0xabcdef123456...

# Get key and save to file
web3pgp getPublicKey 0xabcdef123456... > my-key.asc

# Get key and import to gpg
web3pgp getPublicKey 0xabcdef123456... | gpg --import

# Get key with custom RPC
web3pgp \
  --rpc-url "https://eth-mainnet.g.alchemy.com/v2/xxx" \
  --web3pgp-address "0x..." \
  getPublicKey 0xabcdef123456...
```

---

### `listen`

Continuously listen to blockchain events related to key registration, subkey addition, and revocation. Prints received events in real-time.

#### Usage

```bash
web3pgp listen [options]
```

#### Options

```
--event <type>           Event type to listen for (KeyRegistered, SubkeyAdded, KeyRevoked, all)
                         Default: all
--fingerprint <fp>       Listen only for specific key/subkey (full-length, 0x-prefixed hex string)
--from-block <n>         Block number to start listening from (default: latest)
--poll-interval <ms>     Polling interval in milliseconds (default: 5000)
--chain-id <id>          Chain ID (overrides network setting from config)
--rpc-url <url>          Ethereum RPC endpoint URL (overrides config)
--web3pgp-address <addr> Web3PGP contract address (overrides config)
--help, -h               Show help for this command
```

#### Processing

1. Verify configuration is valid
2. Initialize Web3 event listener
3. Subscribe to specified events (or all if not specified)
4. For each event received:
   - Parse event data from blockchain
   - Log blockchain data and validation results to stderr (JSON)
   - Extract OpenPGP message/certificate from event
   - Validate message/certificate integrity
   - If validation successful, output armored OpenPGP message/certificate to stdout
5. Continue listening until interrupted (Ctrl+C)

#### Outputs

**Event Stream (stdout - JSON, one per line):**
```json
{"event":"KeyRegistered","fingerprint":"0xabcdef123456...","blockNumber":12345678,"transactionHash":"0x...","timestamp":1701598245000}
{"event":"SubkeyAdded","primaryFingerprint":"0xabcdef123456...","subkeyFingerprint":"0x789ghi...","blockNumber":12345679,"transactionHash":"0x...","timestamp":1701598246000}
{"event":"KeyRevoked","fingerprint":"0xabcdef123456...","blockNumber":12345680,"transactionHash":"0x...","timestamp":1701598247000}
```

**Blockchain Data & Validation Logging (stderr - JSON logs):**
```json
{"timestamp":"2025-12-03T10:30:45.123Z","level":"info","component":"commands/listen","message":"Event listener started","details":{"events":["KeyRegistered","SubkeyAdded","KeyRevoked"],"fromBlock":"latest"}}
{"timestamp":"2025-12-03T10:30:50.456Z","level":"info","component":"commands/listen","message":"Event received and validated","details":{"event":"KeyRegistered","fingerprint":"0xabcdef123456...","blockNumber":12345678,"validationResult":"valid"}}
{"timestamp":"2025-12-03T10:30:55.000Z","level":"warn","component":"commands/listen","message":"Event validation failed","details":{"event":"SubkeyAdded","blockNumber":12345679,"validationError":"Corrupted key data"}}
{"timestamp":"2025-12-03T10:30:55.789Z","level":"warn","component":"commands/listen","message":"Connection lost, reconnecting...","details":{"attemptNumber":1}}
```

#### Exit Codes

- `0`: Graceful shutdown (Ctrl+C)
- `2`: Configuration error
- `4`: Connection error (cannot connect to RPC or contract)

#### Examples

```bash
# Listen to all events
web3pgp listen

# Listen to specific event type
web3pgp listen --event KeyRegistered

# Listen for specific fingerprint
web3pgp listen --fingerprint 0xabcdef123456...

# Listen from specific block
web3pgp listen --from-block 12345000

# Listen with custom polling interval
web3pgp listen --poll-interval 10000

# Combine options
web3pgp listen \
  --event KeyRegistered \
  --fingerprint 0xabcdef123456789012345678901234567890abcd \
  --from-block 12345000 \
  --poll-interval 10000

# Pipe events to another tool
web3pgp listen | jq '.fingerprint'

# Run in background and save to file
web3pgp listen > events.jsonl 2> logs.jsonl &
```

#### Event Data Structure

**KeyRegistered Event:**
```json
{
  "event": "KeyRegistered",
  "fingerprint": "0xabcdef123456...",
  "subkeys": ["0x789ghi...", "0x123jkl..."],
  "blockNumber": 12345678,
  "blockTimestamp": 1701598245,
  "transactionHash": "0x...",
  "logIndex": 0,
  "publicKey": "-----BEGIN PGP PUBLIC KEY BLOCK-----\n..."
}
```

**SubkeyAdded Event:**
```json
{
  "event": "SubkeyAdded",
  "primaryFingerprint": "0xabcdef123456...",
  "subkeyFingerprint": "0x789ghi...",
  "blockNumber": 12345679,
  "blockTimestamp": 1701598246,
  "transactionHash": "0x...",
  "logIndex": 0,
  "publicKey": "-----BEGIN PGP PUBLIC KEY BLOCK-----\n..."
}
```

**KeyRevoked Event:**
```json
{
  "event": "KeyRevoked",
  "fingerprint": "0xabcdef123456...",
  "blockNumber": 12345680,
  "blockTimestamp": 1701598247,
  "transactionHash": "0x...",
  "logIndex": 0,
  "revokedKey": "-----BEGIN PGP PUBLIC KEY BLOCK-----\n..."
}
```

---

### `configuration`

Manage Web3PGP CLI configuration. This command has subcommands for generating, displaying, and validating configuration files.

#### Usage

```bash
web3pgp configuration <subcommand> [options]
```

#### Subcommands

##### `configuration generate`

Generate a template configuration file with all available options and comments.

**Usage:**
```bash
web3pgp configuration generate [options]
```

**Options:**
```
--output, -o <path>  Path where to save the template config file
                     (default: prints to stdout)
--help, -h           Show help for this command
```

**Description:**
Generates a commented YAML configuration template showing all available configuration keys, their types, defaults, and explanations. Useful for creating a new configuration file or understanding available options.

**Output (stdout if no --output specified):**
```yaml
# Web3PGP CLI Configuration Template
# 
# This is a template showing all available configuration options.
# Uncomment and modify values as needed.

# RPC Configuration
rpc:
  endpoints:
    - url: "https://eth-mainnet.g.alchemy.com/v2/"
      apiKey: "${ALCHEMY_KEY}"
      priority: 1
      timeout: 10000
  network:
    name: "ethereum"
    chainId: 1

# Wallet Configuration
wallet:
  type: "private-key"
  privateKey: "${PRIVATE_KEY}"

# Contract Configuration
contract:
  web3pgp: "0x..."

# Logging Configuration
logging:
  level: "info"
  format: "json"
```

**Exit Codes:**
- `0`: Success
- `2`: Configuration error (invalid output path, etc.)

**Examples:**
```bash
# Display template
web3pgp configuration generate

# Save template to file
web3pgp configuration generate --output ~/.web3pgp/config.yaml.template

# Save and edit
web3pgp configuration generate -o ~/.web3pgp/config.yaml && nano ~/.web3pgp/config.yaml
```

---

##### `configuration display`

Display the currently loaded configuration (from config file, environment variables, and defaults).

**Usage:**
```bash
web3pgp configuration display [options]
```

**Options:**
```
--config, -c <path>  Path to configuration file (default: $HOME/.web3pgp/config.yaml)
--masked             Mask sensitive values (private keys, API keys)
--help, -h           Show help for this command
```

**Description:**
Displays the effective configuration that will be used by the CLI. This is useful for validating that the configuration file is being found and parsed correctly, and to see the final merged configuration (config file + environment variables + defaults).

**Output (stdout - JSON format):**
```json
{
  "rpc": {
    "endpoints": [
      {
        "url": "https://eth-mainnet.g.alchemy.com/v2/...",
        "priority": 1,
        "timeout": 10000
      }
    ],
    "network": {
      "name": "ethereum",
      "chainId": 1
    }
  },
  "wallet": {
    "type": "private-key",
    "privateKey": "***MASKED***"
  },
  "contract": {
    "web3pgp": "0x1234567890abcdef1234567890abcdef12345678"
  },
  "logging": {
    "level": "info",
    "format": "json"
  }
}
```

**Exit Codes:**
- `0`: Success
- `2`: Configuration error (file not found, invalid format, etc.)

**Examples:**
```bash
# Display current configuration
web3pgp configuration display

# Display with masked secrets
web3pgp configuration display --masked

# Check if custom config is found
web3pgp configuration display --config /etc/web3pgp/config.yaml
```

---

##### `configuration validate`

Validate the configuration file without running any commands.

**Usage:**
```bash
web3pgp configuration validate [options]
```

**Options:**
```
--config, -c <path>  Path to configuration file (default: $HOME/.web3pgp/config.yaml)
--help, -h           Show help for this command
```

**Description:**
Validates the configuration file and all merged settings (config file + environment variables + defaults). Reports any validation errors, missing required fields, or invalid values. Useful for catching configuration issues before running actual commands.

**Output (stderr - JSON logs):**
```json
{
  "timestamp": "2025-12-03T10:30:45.123Z",
  "level": "info",
  "component": "commands/configuration/validate",
  "message": "Configuration validation successful",
  "details": {
    "configFile": "$HOME/.web3pgp/config.yaml",
    "rpcEndpoints": 2,
    "walletConfigured": true,
    "contractAddressConfigured": true
  }
}
```

**Validation Errors (stderr - JSON logs):**
```json
{
  "timestamp": "2025-12-03T10:30:45.123Z",
  "level": "error",
  "component": "commands/configuration/validate",
  "message": "Configuration validation failed",
  "details": {
    "errors": [
      {
        "field": "wallet.privateKey",
        "message": "Private key is required for private-key wallet type"
      },
      {
        "field": "rpc.endpoints",
        "message": "At least one RPC endpoint must be configured"
      }
    ]
  }
}
```

**Exit Codes:**
- `0`: Configuration is valid
- `2`: Configuration error (validation failed, file not found, invalid format, etc.)

**Examples:**
```bash
# Validate default configuration
web3pgp configuration validate

# Validate custom configuration file
web3pgp configuration validate --config ~/.web3pgp/mainnet.yaml

# Validate before using in scripts
if web3pgp configuration validate; then
  web3pgp register --key my-key.asc
else
  echo "Configuration error, aborting"
  exit 1
fi
```

---

## Error Handling Standards

All commands follow consistent error handling:

1. **Validation Errors** (Exit Code 3)
   - Input validation failures
   - Configuration validation failures
   - Format/parsing errors

2. **Blockchain Errors** (Exit Code 4)
   - Transaction failures
   - Contract revert reasons
   - Key not found on-chain
   - Network/RPC errors

3. **Configuration Errors** (Exit Code 2)
   - Missing required configuration
   - Invalid configuration values

All errors are logged to stderr in JSON format with full context for debugging.

---

## Help System

Each command provides comprehensive help:

```bash
web3pgp --help               # Global help
web3pgp register --help      # Command-specific help
web3pgp -h                   # Short form
```

Help output includes:
- Description of command/option
- Usage examples
- Required vs optional arguments
- Available options and their defaults
