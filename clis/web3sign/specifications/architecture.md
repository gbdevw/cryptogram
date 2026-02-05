# Web3PGP CLI - Architecture & Framework Recommendation

## Framework Recommendation

### Recommended: **Commander.js** + **Pino** (JSON Logger)

#### Why Commander.js?

**Commander.js** is the most suitable framework for this CLI because:

1. **Subcommand Support**: Native, intuitive subcommand system with `.command()` API
2. **Option Parsing**: Sophisticated parsing of flags with automatic validation
3. **Help Generation**: Automatic, well-formatted help text for commands and options
4. **Maturity**: Battle-tested in production (used by Vue CLI, Create React App, Angular CLI)
5. **TypeScript Support**: Excellent TypeScript definitions
6. **Lightweight**: Minimal dependencies (~10KB)
7. **Configuration Flexibility**: Easy to integrate custom option processing for env variables and config files

#### Alternative Considered: Yargs, Oclif

- **Yargs**: Good alternative but less elegant API; better for simpler CLIs
- **Oclif**: Built by Salesforce, excellent for complex CLIs but heavier; overkill for our use case

---

### Logging: **Pino**

**Pino** is the best JSON logging library because:

1. **Performance**: Asynchronous JSON logging with minimal overhead
2. **Structured Logging**: Native support for structured, machine-readable logs
3. **TypeScript Support**: First-class TypeScript support
4. **Ecosystem**: Well-integrated with standard Node.js tooling
5. **Simplicity**: Clean, minimal API
6. **Streaming**: Built-in support for log piping and redirection

#### Log Output Convention

- **Stdout**: Command results only (transaction receipts, keys, events)
- **Stderr**: All logging via Pino in JSON format

---

## Architecture Overview

```
clis/web3pgp/
├── src/
│   ├── index.ts                    # CLI entry point (main program setup)
│   ├── commands/                   # Command implementations
│   │   ├── blockchain/
│   │   │   ├── register.ts         # register subcommand
│   │   │   ├── addSubkey.ts        # addSubkey subcommand
│   │   │   ├── revoke.ts           # revoke subcommand
│   │   │   ├── getPublicKey.ts     # getPublicKey subcommand
│   │   │   └── listen.ts           # listen subcommand
│   │   └── configuration/
│   │       ├── generate.ts         # configuration generate subcommand
│   │       ├── display.ts          # configuration display subcommand
│   │       └── validate.ts         # configuration validate subcommand
│   ├── config/                     # Configuration management
│   │   ├── loader.ts               # Load config from files/env/flags
│   │   ├── validator.ts            # Validate configuration
│   │   ├── types.ts                # Configuration type definitions
│   │   └── defaults.ts             # Default configuration values
│   ├── services/                   # Domain-specific services
│   │   ├── web3Service.ts          # Viem client factory (PublicClient + WalletClient)
│   │   └── walletService.ts        # Wallet initialization from private key
│   ├── utils/                      # Utility functions
│   │   ├── logger.ts               # Logger factory and setup
│   │   ├── input.ts                # Input handling (stdin, files)
│   │   ├── output.ts               # Output formatting
│   │   └── errors.ts               # Custom error classes
│   └── types.ts                    # Global type definitions
├── __tests__/                      # Test suite
├── specifications/                 # Design specifications
├── package.json
├── tsconfig.json
└── README.md
```

---

## Design Patterns

### 1. Dependency Injection Strategy

Commands are organized by category and receive dependencies based on their needs:

#### Blockchain Interaction Commands
Commands that interact with blockchain (`register`, `addSubkey`, `revoke`, `getPublicKey`, `listen`) receive:
- **Configuration**: Merged configuration object from file/env/flags
- **Logger**: Pino logger instance with command context
- **Web3 Client**: Viem client initialized with RPC configuration
- **Wallet**: Wallet instance (if command requires writing)
- **Web3PGP Service**: Initialized service from `@web3pgp/sdk`

```typescript
interface BlockchainCommandDeps {
  config: MergedConfig;
  logger: Logger;
  web3Client: PublicClient;
  wallet?: PrivateKeyAccount;
  web3pgpService: IWeb3PGPService;
}
```

#### Configuration Commands
Commands under `configuration` subcommand (`generate`, `display`, `validate`) receive only:
- **Logger**: Pino logger instance

These commands do NOT need blockchain clients or wallets since they only work with local files and configuration.

```typescript
interface ConfigCommandDeps {
  logger: Logger;
}
```

#### Pattern Implementation
```typescript
// Base command creator factory
interface CommandDeps {
  config?: MergedConfig;
  logger: Logger;
  web3Client?: PublicClient;
  wallet?: PrivateKeyAccount;
  web3pgpService?: IWeb3PGPService;
}

// Example: Blockchain command factory
function createRegisterCommand(deps: CommandDeps & { 
  config: MergedConfig;
  web3Client: PublicClient;
  wallet: PrivateKeyAccount;
  web3pgpService: IWeb3PGPService;
}): Command { ... }

// Example: Configuration command factory
function createConfigGenerateCommand(deps: Pick<CommandDeps, 'logger'>): Command { ... }
```

This approach:
- Ensures type safety (TypeScript prevents passing wrong deps)
- Keeps configuration commands lightweight
- Avoids initializing unnecessary services
- Makes testing simpler (mock only what's needed)

---

### 2. Configuration Loading Flow

```
1. Load defaults (config/defaults.ts) → Ink Sepolia testnet
2. Load YAML config file (if exists at $HOME/.web3pgp/config.yaml or custom --config)
3. Override with environment variables (DEXES_*)
4. Override with command-line flags (--chain-id, --rpc-url, etc.)
5. Validate complete configuration
6. Initialize blockchain services (Viem client, wallet, Web3PGP service)
7. Execute command with configured dependencies
```

---

### 3. Service Initialization Hierarchy

Services are initialized lazily and only when needed:

```
Configuration Loader
    ↓
Config Validator (fails fast if invalid)
    ↓
Viem Web3 Client Factory
    ├─ Parses RPC endpoints from config
    ├─ Creates PublicClient with fallback transport chain
    └─ Creates WalletClient (if private key available)
        └─ Uses privateKeyToAccount for wallet derivation
    ↓
Web3PGP Service (wraps SDK with clients)
```

**Viem's Native RPC Fallback:**
Viem's `fallback()` transport handler automatically tries RPC endpoints in sequence if one fails:
```typescript
const client = createPublicClient({
  transport: fallback([
    http('https://rpc-endpoint-1.com'),
    http('https://rpc-endpoint-2.com'),
  ])
});
```

For read-only commands (`getPublicKey`, `listen`):
- Initialize PublicClient only
- Skip WalletClient

For write commands (`register`, `addSubkey`, `revoke`):
- Initialize PublicClient + WalletClient with wallet account

---

### 4. Error Handling Strategy

- **Validation Layer**: Configuration and input validation before service calls
- **Error Mapping**: Service errors → CLI-friendly error messages
- **Exit Codes**: Semantic exit codes for scripting/CI integration
- **Custom Error Classes**: 
  - `ConfigError` (exit 2)
  - `ValidationError` (exit 3)
  - `BlockchainError` (exit 4)

### 5. Input Handling

Three input modes:
1. **File**: `--key /path/to/key.pgp`
2. **Stdin**: `cat key.pgp | web3pgp register`
3. **Argument**: `web3pgp getPublicKey 0x1234...`

### 6. Output Formatting

- **Success**: Direct to stdout
  - `register`, `addSubkey`, `revoke`: JSON transaction receipt
  - `getPublicKey`: Armored OpenPGP key
  - `listen`: JSON events (one per line)
- **Errors**: Structured JSON on stderr
- **Logging**: Real-time JSON logs on stderr

---

## Command Structure Examples

### Blockchain Command (Write - Requires Wallet)

```typescript
// commands/blockchain/register.ts
import { Command } from 'commander';
import { Logger } from 'pino';
import { PublicClient, PrivateKeyAccount } from 'viem';
import { IWeb3PGPService } from '@web3pgp/sdk';
import { MergedConfig } from '../../config/types';

interface RegisterCommandDeps {
  config: MergedConfig;
  logger: Logger;
  web3Client: PublicClient;
  wallet: PrivateKeyAccount;
  web3pgpService: IWeb3PGPService;
}

export function createRegisterCommand(deps: RegisterCommandDeps): Command {
  const { config, logger, web3pgpService } = deps;
  const cmdLogger = logger.child({ command: 'register' });

  return new Command('register')
    .description('Register a new OpenPGP public key on the blockchain')
    .option('--key <path>', 'Path to armored PGP public key file')
    .option('--stdin', 'Read key from stdin')
    .option('--chain-id <id>', 'Override chain ID')
    .option('--rpc-url <url>', 'Override RPC endpoint')
    .option('--web3pgp-address <addr>', 'Override contract address')
    .option('--private-key <key>', 'Override private key')
    .action(async (options) => {
      try {
        cmdLogger.info('Starting key registration');
        // Implementation using web3pgpService
      } catch (error) {
        cmdLogger.error({ error }, 'Key registration failed');
        process.exit(4);
      }
    });
}
```

### Blockchain Command (Read-Only)

```typescript
// commands/blockchain/getPublicKey.ts
import { Command } from 'commander';
import { Logger } from 'pino';
import { PublicClient } from 'viem';
import { IWeb3PGPService } from '@web3pgp/sdk';
import { MergedConfig } from '../../config/types';

interface GetPublicKeyCommandDeps {
  config: MergedConfig;
  logger: Logger;
  web3Client: PublicClient;
  web3pgpService: IWeb3PGPService;
  // Note: NO wallet needed for read-only operations
}

export function createGetPublicKeyCommand(deps: GetPublicKeyCommandDeps): Command {
  const { logger, web3pgpService } = deps;
  const cmdLogger = logger.child({ command: 'getPublicKey' });

  return new Command('getPublicKey')
    .description('Retrieve OpenPGP public key from blockchain')
    .argument('<fingerprint>', 'Full-length fingerprint (0x-prefixed)')
    .option('--chain-id <id>', 'Override chain ID')
    .option('--rpc-url <url>', 'Override RPC endpoint')
    .option('--web3pgp-address <addr>', 'Override contract address')
    .action(async (fingerprint, options) => {
      try {
        cmdLogger.info({ fingerprint }, 'Retrieving public key');
        const key = await web3pgpService.getPublicKey(fingerprint);
        console.log(key.armor());
      } catch (error) {
        cmdLogger.error({ error }, 'Failed to retrieve key');
        process.exit(4);
      }
    });
}
```

### Configuration Command

```typescript
// commands/configuration/generate.ts
import { Command } from 'commander';
import { Logger } from 'pino';

interface ConfigGenerateCommandDeps {
  logger: Logger;
}

export function createConfigGenerateCommand(deps: ConfigGenerateCommandDeps): Command {
  const { logger } = deps;
  const cmdLogger = logger.child({ command: 'configuration.generate' });

  return new Command('generate')
    .description('Generate a template configuration file')
    .option('--output, -o <path>', 'Output file path (default: stdout)')
    .action(async (options) => {
      try {
        cmdLogger.info('Generating config template');
        const template = generateConfigTemplate();
        
        if (options.output) {
          fs.writeFileSync(options.output, template);
          cmdLogger.info({ path: options.output }, 'Config template written');
        } else {
          console.log(template);
        }
      } catch (error) {
        cmdLogger.error({ error }, 'Failed to generate config');
        process.exit(2);
      }
    });
}
```

---

## Service Integration

### Viem Web3 Client Factory

```typescript
// services/web3Service.ts
import { 
  createPublicClient, 
  createWalletClient,
  fallback,
  http,
  PublicClient,
  WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { MergedConfig } from '../config/types';

export interface Web3Clients {
  publicClient: PublicClient;
  walletClient?: WalletClient;
}

export function initializeWeb3Clients(
  config: MergedConfig,
  includeWallet: boolean = false
): Web3Clients {
  // Extract and sort RPC endpoints by priority
  const rpcEndpoints = config.ethereum.rpc.endpoints
    .sort((a, b) => a.priority - b.priority)
    .map(ep => http(ep.url));

  if (rpcEndpoints.length === 0) {
    throw new Error('No RPC endpoints configured');
  }

  // Create PublicClient with fallback transport for reads
  const publicClient = createPublicClient({
    chain: getChainFromId(config.ethereum.chainId),
    transport: rpcEndpoints.length > 1 
      ? fallback(rpcEndpoints) 
      : rpcEndpoints[0],
  });

  // Create WalletClient if needed and private key available
  let walletClient: WalletClient | undefined;
  if (includeWallet && config.ethereum.wallet.privateKey) {
    const account = privateKeyToAccount(
      config.ethereum.wallet.privateKey as `0x${string}`
    );

    walletClient = createWalletClient({
      account,
      chain: getChainFromId(config.ethereum.chainId),
      transport: rpcEndpoints.length > 1
        ? fallback(rpcEndpoints)
        : rpcEndpoints[0],
    });
  }

  return { publicClient, walletClient };
}
```

### Wallet Service Setup

The wallet is now integrated into the WalletClient creation. If you need standalone wallet operations:

```typescript
// services/walletService.ts
import { PrivateKeyAccount, privateKeyToAccount } from 'viem/accounts';
import { MergedConfig } from '../config/types';

export function deriveWalletAccount(config: MergedConfig): PrivateKeyAccount {
  const privateKey = config.ethereum.wallet.privateKey;
  
  if (!privateKey) {
    throw new Error('Private key required for write operations');
  }

  return privateKeyToAccount(privateKey as `0x${string}`);
}
```

### Web3PGP Service Setup

```typescript
// services/web3pgpService.ts (wrapper/factory)
import { Web3PGPService } from '@web3pgp/sdk';
import { PublicClient, WalletClient } from 'viem';
import { MergedConfig } from '../config/types';
import { initializeWeb3Clients } from './web3Service';

export function initializeWeb3PGPService(
  config: MergedConfig,
  publicClient: PublicClient,
  walletClient?: WalletClient
): Web3PGPService {
  return new Web3PGPService({
    publicClient,
    walletClient,
    contractAddress: config.web3pgp.contract as `0x${string}`,
  });
}
```

## Transaction Receipt Handling

For write commands that submit transactions (`register`, `addSubkey`, `revoke`):

1. Submit transaction via Web3PGP service (uses Viem wallet client)
2. Wait for receipt confirmation
3. Output receipt as JSON to stdout
4. Log completion event to stderr (JSON)

Example receipt output (stdout):
```json
{
  "transactionHash": "0x...",
  "blockNumber": 12345678,
  "gasUsed": "150000",
  "status": 1,
  "logs": [...]
}
```

---

## Logging Architecture

### Logger Instances
- **Root Logger**: For general CLI operations, created in `index.ts`
- **Command Loggers**: Per-command child loggers with command context (via `.child()`)
- **Service Loggers**: For blockchain service operations

### Child Logger Pattern
```typescript
const cmdLogger = logger.child({ command: 'register' });
cmdLogger.info('Starting registration'); 
// Output: { "command": "register", "message": "Starting registration", ... }
```

### Log Levels
- `debug`: Detailed information for debugging (RPC calls, etc.)
- `info`: General informational messages
- `warn`: Warning messages (RPC fallback, etc.)
- `error`: Error messages with stack traces

## Error Handling Examples

### Configuration Error (Exit Code 2)
```json
{
  "timestamp": "2025-12-03T10:30:45.123Z",
  "level": "error",
  "component": "config",
  "message": "Invalid configuration: RPC endpoint URL is invalid",
  "details": {
    "errorCode": "CONFIG_ERROR",
    "field": "ethereum.rpc.endpoints[0].url",
    "value": "not-a-url"
  }
}
```

### Validation Error (Exit Code 3)
```json
{
  "timestamp": "2025-12-03T10:30:45.123Z",
  "level": "error",
  "component": "commands/register",
  "message": "Validation failed: Invalid PGP key format",
  "details": {
    "errorCode": "VALIDATION_ERROR",
    "field": "key"
  }
}
```

### Blockchain Error (Exit Code 4)
```json
{
  "timestamp": "2025-12-03T10:30:45.123Z",
  "level": "error",
  "component": "commands/register",
  "message": "Transaction reverted: Key already registered",
  "details": {
    "errorCode": "BLOCKCHAIN_ERROR",
    "transactionHash": "0x...",
    "reason": "KeyAlreadyExists"
  }
}
```

## Development Setup

### Stack
- **Language**: TypeScript (matching project convention)
- **Build**: tsc or esbuild
- **Testing**: Jest (matching project convention)
- **Packaging**: NPM
- **Node.js**: 18+ (LTS)
- **Blockchain Client**: Viem (Web3 library)
- **OpenPGP**: openpgp.js library
- **SDK**: @web3pgp/sdk (workspace dependency)

### Key Dependencies
```json
{
  "commander": "^11.0.0",
  "pino": "^8.16.0",
  "yaml": "^2.3.0",
  "viem": "^1.0.0",
  "openpgp": "^5.10.0",
  "@web3pgp/sdk": "workspace:*"
}
```

### Dev Dependencies
```json
{
  "typescript": "^5.0.0",
  "jest": "^29.0.0",
  "@types/node": "^20.0.0",
  "@types/jest": "^29.0.0"
}
```

---

## Benefits of This Architecture

1. **Modular**: Easy to add new commands or features
2. **Testable**: Dependency injection makes mocking trivial
3. **Observable**: Comprehensive JSON logging for debugging and monitoring
4. **Maintainable**: Clear separation of concerns
5. **User-Friendly**: Helpful error messages and automatic help generation
6. **Scalable**: Can handle complex configuration and multiple RPC providers
