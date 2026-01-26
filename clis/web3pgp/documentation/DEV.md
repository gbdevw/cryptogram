# Web3PGP CLI - Development Guide

This guide explains the code structure and how to get started with developing the Web3PGP CLI.

## Project Overview

The Web3PGP CLI is a TypeScript-based command-line interface that enables users to manage OpenPGP keys on the Ethereum blockchain through the Web3PGP smart contract. It provides commands for key registration, revocation, certification, and blockchain synchronization.

## Architecture

### High-Level Structure

```
src/
├── index.ts                    # Entry point - CLI setup and command routing
├── setup.ts                    # Console and logging initialization
├── types.ts                    # Global TypeScript type definitions
├── errors.ts                   # Error classes
├── config/                     # Configuration management
│   ├── types.ts               # Configuration type definitions
│   ├── defaults.ts            # Default configuration
│   ├── testnet.ts             # Testnet-specific configuration
│   ├── loader.ts              # YAML/env config loading and merging
│   ├── transport.ts           # Viem transport layer construction
│   └── validator.ts           # Configuration validation
├── commands/                   # CLI command definitions
│   ├── blockchain/            # Blockchain operations (register, get, etc.)
│   ├── configuration/         # Configuration commands (generate, display, validate)
│   └── factory.ts             # Command factory functions
├── services/                   # Business logic and service layer
│   ├── web3pgpServiceFactory.ts    # Service initialization
│   └── [service implementations]
└── utils/                      # Utility functions
    └── logger.ts              # Logging setup
```

## Key Components

### Configuration System (`src/config/`)

The configuration system is designed with a 3-tier precedence model:

1. **Defaults** (`defaults.ts`, `testnet.ts`)
   - Built-in default values that serve as the base
   - Currently uses Ink Sepolia testnet configuration

2. **Config File** (`loader.ts`)
   - YAML file at `~/.web3pgp/config.yaml`
   - Overrides defaults if present
   - Supports environment variable expansion with `${VAR}` syntax

3. **Environment Variables** (`loader.ts`)
   - `DEXES_*` prefixed variables
   - Override config file values

4. **CLI Flags** (command arguments)
   - `--config` flag for custom config file path
   - Highest precedence

**Key Files:**
- `types.ts` - Type definitions for the configuration structure
- `loader.ts` - Loads and merges configuration from all sources
- `transport.ts` - Builds Viem transport layer with batching and retry logic
- `validator.ts` - Validates configuration on startup

### Commands (`src/commands/`)

Commands are organized by feature area:

#### Blockchain Commands (`commands/blockchain/`)
- `register` - Register OpenPGP keys on-chain
- `get` - Retrieve keys by fingerprint
- `certify` - Certify existing keys with another key
- `revoke-certification` - Revoke key certifications
- `add-subkey` - Register subkeys
- `sync` - Listen to blockchain events in real-time

#### Configuration Commands (`commands/configuration/`)
- `generate` - Generate template configurations
- `display` - Show current configuration
- `validate` - Validate configuration syntax and values

### Services (`src/services/`)

The service layer contains business logic:

- `web3pgpServiceFactory.ts` - Creates and initializes the Web3PGP service
- Service instances handle:
  - Interaction with the Web3PGP smart contract
  - Wallet operations and signing
  - Key registration and retrieval logic
  - Event listening and blockchain synchronization

### Entry Point (`src/index.ts`)

The main entry point:

1. Extracts `--config` flag from CLI arguments
2. Loads configuration using `loadConfig()`
3. Initializes logging based on log level
4. Creates Web3PGP service
5. Sets up Commander.js CLI program
6. Registers all commands
7. Parses and executes CLI arguments

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- NPM or Yarn
- TypeScript knowledge

### Setup Steps

1. **Install dependencies**
   ```bash
   cd clis/web3pgp
   npm install
   ```

2. **Build the project**
   ```bash
   npm run build
   ```

3. **Test the build**
   ```bash
   node dist/index.js --help
   ```

### Development Workflow

1. **Development mode** - Hot reload with ts-node
   ```bash
   npm run dev -- --help
   ```

2. **Watch mode compilation**
   ```bash
   npm run build -- --watch
   ```

3. **Run tests**
   ```bash
   npm test
   ```

4. **Run integration tests**
   ```bash
   npm run test:integration
   ```

## Configuration Development

When adding new configuration options:

1. Update `src/config/types.ts` - Add interface properties
2. Update `src/config/testnet.ts` - Set default values
3. Update `src/config/loader.ts` - Add environment variable mapping
4. Update `src/config/validator.ts` - Add validation rules
5. Update `documentation/CONFIGURATION.md` - Document the option

Example:
```typescript
// types.ts
export interface EthereumConfig {
  chain: ChainConfig;
  rpc?: {
    endpoints: RpcEndpoint[];
    maxBlockRange?: number;  // New option
    retry?: RetryConfig;
  };
  // ...
}
```

## Adding New Commands

Commands use the Commander.js framework. To add a new command:

1. Create a command file in `src/commands/[feature]/[command].ts`
2. Export a function that creates the command:
   ```typescript
   export function createMyCommand(options: CommandOptions): Command {
     return new Command('my-command')
       .description('Description')
       .action(async () => {
         // Implementation
       });
   }
   ```
3. Register the command in the factory (`src/commands/factory.ts`)
4. Add tests in `__tests__/unit/commands/`

## Logging

The CLI uses structured logging with Pino:

```typescript
import { createRootLogger } from './utils/logger';

const logger = createRootLogger('info');
const childLogger = logger.child({ component: 'my-component' });

childLogger.debug('Debug message');
childLogger.info('Info message');
childLogger.warn('Warning message');
childLogger.error({ error: err }, 'Error message');
```

Logging level is controlled by the `monitoring.logging.level` configuration.

## Error Handling

Custom errors are defined in `src/errors.ts`:

- `ConfigError` - Configuration-related errors
- Other error types as needed

Errors are caught at the root level and reported with proper exit codes:
- Exit code 2: Configuration error
- Exit code 1: Other fatal errors

## SDK Integration

The CLI uses the Web3PGP TypeScript SDK (`sdks/typescript/`) for:

- Smart contract interaction
- OpenPGP key operations
- Blockchain communication

The SDK is imported and used through the service layer, providing abstraction between CLI commands and core functionality.

## Type Safety

The project uses strict TypeScript configuration:

- `tsconfig.json` - Strict mode enabled
- All code must be fully typed
- No `any` types without explicit `// @ts-ignore` comments

## Code Style

- Follows Prettier formatting
- ESLint rules enforce consistency
- JSDoc comments for public APIs
- Descriptive variable and function names

## Resources

- [Configuration Reference](CONFIGURATION.md)
- [Transport and RPC Setup](TRANSPORT.md)
- [Test Guide](TEST.md)
- [Web3PGP Protocol Overview](../../DEMO.md)
