# Web3PGP CLI - Implementation Plan

## Overview

This document outlines the phased approach to implementing the Web3PGP CLI TypeScript application. The implementation is divided into 4 phases, each with clear deliverables and dependencies.

**Total Estimated Timeline**: 4-6 weeks (depending on development velocity and testing scope)

---

## Phase 1: Project Setup & Foundation (1 week)

### Objective
Establish the development environment, project structure, and core infrastructure that all phases depend on.

### Deliverables

#### 1.1 Project Initialization
- Initialize npm project with proper `package.json`
- Configure TypeScript (`tsconfig.json`)
- Set up build pipeline (tsc or esbuild)
- Configure Jest testing framework with TypeScript support
- Set up ESLint and Prettier for code quality

**Key Files to Create:**
- `package.json` - Dependencies, scripts, metadata
- `tsconfig.json` - TypeScript configuration
- `jest.config.js` - Testing configuration
- `.eslintrc.json` - Linting rules
- `.prettierrc.json` - Code formatting rules
- `src/index.ts` - Entry point (minimal: just export)

**Dependencies to Install:**
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

**Dev Dependencies:**
```json
{
  "typescript": "^5.0.0",
  "jest": "^29.0.0",
  "@types/node": "^20.0.0",
  "@types/jest": "^29.0.0",
  "ts-jest": "^29.0.0",
  "eslint": "^8.0.0",
  "@typescript-eslint/eslint-plugin": "^6.0.0",
  "@typescript-eslint/parser": "^6.0.0",
  "prettier": "^3.0.0"
}
```

#### 1.2 Type Definitions
Create foundational TypeScript interfaces that all other components depend on.

**Files to Create:**
- `src/types.ts` - Global type definitions
- `src/config/types.ts` - Configuration interface
- `src/errors.ts` - Custom error classes

**Type Definitions Needed:**
```typescript
// src/types.ts
export type ChainId = number;
export type EthereumAddress = `0x${string}`;
export type Fingerprint = `0x${string}`;

// src/config/types.ts
export interface RpcEndpoint {
  url: string;
  priority: number;
}

export interface MergedConfig {
  ethereum: {
    chainId: ChainId;
    rpc: {
      endpoints: RpcEndpoint[];
    };
    wallet: {
      type: 'private-key';  # pragma: allowlist secret
      privateKey?: `0x${string}`;  # pragma: allowlist secret
    };
  };
  web3pgp: {
    contract: EthereumAddress;
  };
  monitoring: {
    logging: {
      level: 'debug' | 'info' | 'warn' | 'error';
    };
  };
}

// src/errors.ts
export class ConfigError extends Error { ... }
export class ValidationError extends Error { ... }
export class BlockchainError extends Error { ... }
```

#### 1.3 Logger Utility
Set up Pino logger factory for consistent logging across the CLI.

**File to Create:**
- `src/utils/logger.ts`

**Functionality:**
- Root logger initialization with configurable log level
- Child logger factory with context support
- JSON output to stderr configuration
- Log level environment variable support (DEXES_LOG_LEVEL)

#### 1.4 Output & Input Utilities
Create utility functions for handling CLI input/output.

**Files to Create:**
- `src/utils/output.ts` - Output formatting
- `src/utils/input.ts` - Input handling from files/stdin
- `src/utils/format.ts` - JSON/table formatting utilities

**Functionality:**
- `readInputFromFile(path)` - Read from file
- `readInputFromStdin()` - Read from stdin with timeout
- `formatJson(data)` - Pretty JSON output
- `formatError(error)` - Error formatting

#### 1.5 Directory Structure
Create empty directories for organizing code:

```bash
mkdir -p src/commands/blockchain
mkdir -p src/commands/configuration
mkdir -p src/config
mkdir -p src/services
mkdir -p src/utils
mkdir -p __tests__/unit
mkdir -p __tests__/integration
```

### Testing
- Unit tests for custom error classes
- Unit tests for logger initialization
- Unit tests for output formatters

### Validation Checklist
- [ ] `npm install` completes without errors
- [ ] `npm run build` produces `dist/` directory
- [ ] `npm run lint` passes
- [ ] `npm run test` runs (even if no tests yet)
- [ ] TypeScript types compile without errors
- [ ] Logger initializes and writes to stderr

---

## Phase 2: Configuration System (1.5 weeks)

### Objective
Implement the complete configuration loading and validation system that supports 3-tier precedence (flags > env vars > config file > defaults).

### Deliverables

#### 2.1 Default Configuration
Create hardcoded defaults with Ink Sepolia testnet as the default network.

**File to Create:**
- `src/config/defaults.ts`

**Content:**
```typescript
export const DEFAULT_CONFIG: MergedConfig = {
  ethereum: {
    chainId: 763373, // Ink Sepolia
    rpc: {
      endpoints: [
        { url: 'https://rpc-gel-sepolia.inkonchain.com', priority: 1 },
        { url: 'https://rpc-qnd-sepolia.inkonchain.com', priority: 2 },
      ],
    },
    wallet: { type: 'private-key' },
  },
  web3pgp: { contract: '0x72d02B94317ac899B34459a4e6685eFe12Ac17a8' },
  monitoring: { logging: { level: 'info' } },
};
```

#### 2.2 Configuration Validator
Create format validation logic to ensure YAML is well-formed.

**File to Create:**
- `src/config/validator.ts`

**Functions:**
- `validateYamlFormat(content: string): boolean` - Validate YAML is well-formed
- `validateYamlStructure(data: unknown): void` - Validate YAML structure matches expected shape

**Error Handling:**
- Throw `ConfigError` for malformed YAML
- Include helpful error messages (e.g., "Invalid YAML syntax at line X")

**Validation Scope (Format Only):**
- YAML syntax is valid (can be parsed)
- YAML structure matches expected shape (required fields present, correct types)
- **No semantic validation** (e.g., no RPC endpoint connectivity checks, no private key format validation)

**What NOT to validate (deferred to Phase 3):**
- ❌ Chain ID must be positive integer
- ❌ RPC endpoints must be valid URLs or reachable
- ❌ Ethereum addresses must be valid (0x-prefixed hex)
- ❌ Private key must be 0x-prefixed hex (64 chars = 32 bytes)
- ❌ Contract address must be valid Ethereum address
- ❌ Log level must be one of: debug, info, warn, error
- ❌ RPC endpoints priority must be positive integers

Note: Semantic validation will be implemented when services initialize in Phase 3.

#### 2.3 Configuration Loader
Implement the 3-tier configuration merging from defaults → config file → env vars → CLI flags.

**File to Create:**
- `src/config/loader.ts`

**Functions:**
- `loadConfig(options: LoadConfigOptions): MergedConfig`

**Configuration Loading Order:**
1. Start with defaults from `src/config/defaults.ts`
2. Load YAML config file (from `--config` flag or `~/.web3pgp/config.yaml`)
3. Override with `DEXES_*` environment variables
4. Override with CLI flags passed to command
5. ~~Validate~~ Load final merged configuration (no validation at this stage)

**Environment Variable Mapping:**
```
DEXES_CHAIN_ID → ethereum.chainId
DEXES_RPC_ENDPOINTS → ethereum.rpc.endpoints (JSON array)
DEXES_RPC_URL → ethereum.rpc.endpoints[0].url (single endpoint override)
DEXES_WALLET_PRIVATE_KEY → ethereum.wallet.privateKey  # pragma: allowlist secret
DEXES_WEB3PGP_CONTRACT → web3pgp.contract
DEXES_LOG_LEVEL → monitoring.logging.level
```

**YAML Config File Support:**
- Location: `$HOME/.web3pgp/config.yaml`
- Custom location: `--config /path/to/config.yaml`
- Example structure:
  ```yaml
  ethereum:
    chainId: 763373
    rpc:
      endpoints:
        - url: https://rpc-gel-sepolia.inkonchain.com
          priority: 1
        - url: https://rpc-qnd-sepolia.inkonchain.com
          priority: 2
    wallet:
      type: private-key
      privateKey: "0x..."  # pragma: allowlist secret
  web3pgp:
    contract: "0x72d02B94317ac899B34459a4e6685eFe12Ac17a8"  # pragma: allowlist secret
  monitoring:
    logging:
      level: info
  ```

**Support for Environment Variable Expansion:**
- In YAML files, support `${VAR_NAME}` syntax for env var expansion
- Example: `privateKey: "${DEXES_WALLET_PRIVATE_KEY}"`
- This allows storing secrets in env vars instead of config files

#### 2.4 Configuration Command Subcommand
Implement the `configuration` command with 3 subcommands for managing configuration.

**Files to Create:**
- `src/commands/configuration/generate.ts` - Generate template config
- `src/commands/configuration/display.ts` - Show loaded config
- `src/commands/configuration/validate.ts` - Validate config file

**Subcommand Details:**

**`configuration generate`**
- Outputs a template YAML config file to stdout
- Option: `--output, -o <path>` to write to file instead
- Includes comments explaining each field
- Shows examples of DEXES_ env vars

**`configuration display`**
- Loads and displays the merged configuration
- Masks sensitive values (private key shows only first 4 and last 4 chars)
- Shows which configuration sources were used (defaults/file/env/flags)
- Output format: YAML with comments

**`configuration validate`**
- Loads YAML config and validates format
- Reports format validation errors (malformed YAML, missing required fields)
- Exit code 0 if valid, 2 if invalid
- Helpful error messages for debugging

### Testing
- Unit tests for YAML format validation
- Unit tests for environment variable parsing
- Unit tests for YAML loading
- Unit tests for config merging logic
- Integration test: Load config from file, env vars, flags and verify merge order
- Test case: Missing required field defaults properly

### Validation Checklist
- [ ] `npm run build` succeeds
- [ ] Configuration loader passes all unit tests
- [ ] Configuration validator catches malformed YAML
- [ ] `configuration generate` produces valid YAML template
- [ ] `configuration display` shows loaded config
- [ ] `configuration validate` validates YAML format
- [ ] DEXES_* env vars properly override config file
- [ ] CLI flags properly override env vars
- [ ] Sensitive data (private key) masked in display

---

## Phase 3: Services & Web3 Integration (1 week)

### Objective
Implement the Web3PGPServiceFactory that initializes and returns a Web3PGP service instance with proper Viem client setup and wallet configuration.

### Architecture Overview

The service layer follows a single, clean dependency chain:

```
MergedConfig
  ↓
Viem PublicClient (with RPC fallback chain)
  ↓
[Viem WalletClient - if private key configured]
  ↓
IWeb3PGP (low-level contract wrapper from SDK)
  ↓
IWeb3PGPService (high-level service from SDK)
```

**Key Design Principles:**
- Single factory entry point for dependency injection
- Leverages SDK primitives (IWeb3PGP, Web3PGPService from @web3pgp/sdk)
- Clear responsibilities: factory creates, service operates
- Commands depend only on IWeb3PGPService interface

### Deliverables

#### 3.1 Web3PGPServiceFactory
Create the main factory that orchestrates Viem client initialization and Web3PGP service creation.

**File to Create:**
- `src/services/web3pgpServiceFactory.ts`

**Functions:**
- `createWeb3PGPService(config: MergedConfig): Promise<IWeb3PGPService>` - Main factory function

**Implementation Details:**

1. **Viem PublicClient Creation:**
   - Extract RPC endpoints from config and sort by priority
   - Create PublicClient with Viem's `fallback()` transport for automatic RPC endpoint retry
   - Viem handles failover transparently across multiple endpoints
   - Throw ConfigError if no RPC endpoints configured

2. **Viem WalletClient Creation (Conditional):**
   - Check if wallet.type is set (currently only 'private-key' supported)
   - If wallet.type exists and privateKey is configured:
     - Validate private key format (0x-prefixed hex, 64 chars = 32 bytes)
     - Use `privateKeyToAccount` from viem/accounts to derive wallet account
     - Create WalletClient with wallet transport
   - If wallet.type exists but privateKey is missing:
     - Warn in logs but continue (read-only operations supported)
     - Pass undefined as walletClient to service
   - Throw ConfigError if private key format invalid

3. **Low-level IWeb3PGP Contract Initialization:**
   - Import Web3PGP contract wrapper from @web3pgp/sdk
   - Initialize with contract address from config
   - Pass publicClient and walletClient to constructor

4. **High-level Web3PGPService Creation:**
   - Create Web3PGPService instance from @web3pgp/sdk
   - Pass IWeb3PGP instance to constructor
   - Return service instance implementing IWeb3PGPService

**Return Type:**
```typescript
Promise<IWeb3PGPService>
```

**Error Handling:**
- No RPC endpoints → ConfigError with helpful message
- Invalid private key format → ConfigError with format requirements
- Invalid contract address → ConfigError with address validation details
- RPC connection errors → propagate from Viem (network failures)

**Usage Example:**
```typescript
const config = loadConfig({ configPath: './config.yaml' });
const service = await createWeb3PGPService(config);

// Service is ready for read operations
const exists = await service.contract.exists(fingerprint);

// Service ready for write operations if wallet configured
if (config.ethereum.wallet.privateKey) {
  const receipt = await service.register(publicKey);
}
```

### Key Implementation Notes

**Fallback Transport Chain:**
- Viem's `fallback()` transport automatically tries the next RPC endpoint if one fails
- Priority ordering ensures primary endpoint is tried first
- No manual health checking needed - transparent failover handled by Viem

**Private Key Handling:**
- Private key validation: must be 0x-prefixed, 64 hex characters (32 bytes)
- Validation happens in factory, not in service
- If private key invalid, throw early rather than at operation time

**SDK Leverage:**
- All cryptographic operations delegated to @web3pgp/sdk
- Factory only handles Viem client setup and service wiring
- Commands use IWeb3PGPService interface for decoupling

**Configuration:**
- Chain ID used to get Viem chain object (passed to PublicClient)
- RPC endpoints list with priority ordering
- Contract address for Web3PGP contract deployment
- Private key (optional) for wallet operations

### Testing
- Unit test: Service factory creates service with valid config
- Unit test: PublicClient initialized with correct RPC endpoints
- Unit test: WalletClient created when private key configured
- Unit test: WalletClient skipped when private key missing (read-only mode)
- Unit test: ConfigError thrown when no RPC endpoints configured
- Unit test: ConfigError thrown when private key format invalid
- Unit test: Service implements IWeb3PGPService interface
- Integration test: Initialize service with test config and call contract methods
- Error case: Missing private key for write operation
- Error case: Malformed RPC URL

### Validation Checklist
- [ ] Web3PGPServiceFactory creates service from config
- [ ] PublicClient initializes with fallback transport chain
- [ ] WalletClient created conditionally based on private key presence
- [ ] Private key format validated before wallet creation
- [ ] Service returns IWeb3PGPService interface
- [ ] ConfigError thrown for invalid configurations
- [ ] All unit tests pass
- [ ] Service can call both read and write methods on contract

---

## Phase 4: Command Implementation (2-2.5 weeks)

### Objective
Implement all 8 CLI commands (5 blockchain + 3 configuration) with full error handling and output formatting.

### Deliverables

#### 4.1 Base Command Factory Pattern
Create shared infrastructure for command creation.

**File to Create:**
- `src/commands/factory.ts` - Command factory utilities

**Functions:**
- `createBlockchainCommand(deps)` - Base for blockchain commands
- `createConfigCommand(deps)` - Base for configuration commands
- `createCommandGroup(name, description)` - Helper for subcommands

#### 4.2 Blockchain Commands (5 commands)

**4.2.1 Register Command**
- **File:** `src/commands/blockchain/register.ts`
- **Flags:** `--key <path>`, `--stdin`, `--chain-id`, `--rpc-url`, `--web3pgp-address`, `--private-key`
- **Input:** Armored OpenPGP public key (from file/stdin/arg)
- **Process:**
  1. Read and parse PGP key
  2. Validate key format (must be public key, not expired, not revoked)
  3. Extract fingerprint (40 hex chars)
  4. Submit transaction via Web3PGP service
  5. Wait for receipt
- **Output:** JSON transaction receipt to stdout
- **Logging:** All steps logged to stderr (JSON)
- **Errors:** ValidationError (exit 3), BlockchainError (exit 4)

**4.2.2 AddSubkey Command**
- **File:** `src/commands/blockchain/addSubkey.ts`
- **Flags:** `--key <path>`, `--stdin`, `--parent-fingerprint <fp>`, `--chain-id`, `--rpc-url`, `--web3pgp-address`, `--private-key`
- **Input:** Armored OpenPGP subkey
- **Process:**
  1. Read and parse subkey
  2. Validate subkey format
  3. Extract subkey fingerprint
  4. Parse parent fingerprint from flag
  5. Submit transaction
  6. Wait for receipt
- **Output:** JSON transaction receipt to stdout
- **Errors:** ValidationError (exit 3), BlockchainError (exit 4)

**4.2.3 Revoke Command**
- **File:** `src/commands/blockchain/revoke.ts`
- **Flags:** `--fingerprint <fp>`, `--cert <path>`, `--stdin`, `--chain-id`, `--rpc-url`, `--web3pgp-address`, `--private-key`
- **Input:** Full-length fingerprint or revocation certificate
- **Process:**
  1. If certificate provided: Parse and extract revocation fingerprint
  2. If standalone certificate: Download key from blockchain and verify certificate
  3. Submit revocation transaction
  4. Wait for receipt
- **Output:** JSON transaction receipt to stdout
- **Errors:** ValidationError (exit 3), BlockchainError (exit 4)

**4.2.4 GetPublicKey Command**
- **File:** `src/commands/blockchain/getPublicKey.ts`
- **Flags:** `--chain-id`, `--rpc-url`, `--web3pgp-address`
- **Input:** Full-length fingerprint (argument)
- **Process:**
  1. Parse fingerprint argument
  2. Query blockchain for key
  3. Deserialize key
- **Output:** Armored PGP key to stdout (for piping)
- **Logging:** Query details to stderr
- **Errors:** ValidationError (exit 3), BlockchainError (exit 4)

**4.2.5 Listen Command**
- **File:** `src/commands/blockchain/listen.ts`
- **Flags:** `--fingerprint <fp>`, `--chain-id`, `--rpc-url`, `--web3pgp-address`
- **Input:** Optional fingerprint filter
- **Process:**
  1. Set up event listeners on blockchain
  2. Stream events in real-time
  3. Validate and format events
- **Output:** 
  - Stdout: Armored messages from events
  - Stderr: JSON logs with validation results
- **Errors:** BlockchainError (exit 4)

#### 4.3 Configuration Commands (3 commands)
Already partially specified in Phase 2, fully implement:

**4.3.1 Configuration Generate**
- Already designed in Phase 2

**4.3.2 Configuration Display**
- Already designed in Phase 2

**4.3.3 Configuration Validate**
- Already designed in Phase 2

#### 4.4 CLI Entry Point
Create main CLI entry point that sets up Commander.js and registers all commands.

**File to Create:**
- `src/index.ts`

**Functionality:**
- Initialize Pino logger with DEXES_LOG_LEVEL env var
- Register all 8 commands
- Set up global options: `--config`, `--log-level`, `--help`, `--version`
- Implement error handler for uncaught errors
- Proper exit code handling

**Structure:**
```typescript
const program = new Command()
  .name('web3pgp')
  .version('1.0.0')
  .description('Web3PGP CLI - Decentralized OpenPGP key infrastructure on Ethereum')
  .option('--config <path>', 'Config file path')
  .option('--log-level <level>', 'Logging level')
  .option('--help', 'Show help')
  .option('--version', 'Show version');

// Register command groups
program.addCommand(createBlockchainCommands(deps));
program.addCommand(createConfigurationCommands(deps));

program.parse(process.argv);
```

#### 4.5 CLI Scripts & Execution
Set up npm scripts for running the CLI during development.

**package.json scripts:**
```json
{
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/index.ts",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src",
    "lint:fix": "eslint src --fix",
    "format": "prettier --write src"
  }
}
```

### Testing
- Unit tests for each command factory
- Unit tests for command option parsing
- Integration tests: Command execution with mocked services
- End-to-end tests: Full flows with test contract/network (if possible)
- Error handling tests: Invalid inputs, blockchain errors, network errors

### Validation Checklist
- [ ] All 8 commands implemented
- [ ] All commands pass linting
- [ ] All commands have proper error handling
- [ ] All commands output correct format
- [ ] Exit codes correct (0, 2, 3, 4)
- [ ] Help text available for all commands
- [ ] Dependencies injected correctly per command type
- [ ] All commands pass unit tests
- [ ] Integration tests pass with mocked services

---

## Implementation Order & Dependencies

### Recommended Sequence

**Week 1: Phase 1**
1. Initialize project, install dependencies, configure build
2. Create type definitions and error classes
3. Set up logger utility
4. Set up output/input utilities
5. Create directory structure

**Week 2-3: Phase 2**
1. Implement configuration defaults
2. Implement configuration validator
3. Implement configuration loader with 3-tier merging
4. Implement configuration commands (generate, display, validate)
5. Test configuration system thoroughly

**Week 3-4: Phase 3**
1. Implement Web3PGPServiceFactory with Viem client setup
2. Implement conditional wallet creation based on config
3. Implement contract wrapper and service initialization
4. Test service factory with unit and integration tests
5. Validate error handling for edge cases

**Week 4-6: Phase 4**
1. Create base command factory patterns
2. Implement blockchain commands in order:
   - getPublicKey (read-only, simplest)
   - register (write, simpler)
   - addSubkey (write, similar to register)
   - revoke (write, more complex)
   - listen (ongoing, most complex)
3. Implement configuration commands (already partially done)
4. Create main CLI entry point
5. Test all commands end-to-end
6. Refine error handling and logging

### Critical Dependencies
- **Phase 1 blocks all other phases** (foundational)
- **Phase 2 blocks Phase 3 & 4** (config needed for services)
- **Phase 3 blocks Phase 4** (services needed by commands)
- Within Phase 4: Configuration commands can be done in parallel, blockchain commands have partial dependencies

---

## Development Guidelines

### Testing Strategy
- **Unit Tests**: Test individual functions in isolation with mocks
- **Integration Tests**: Test service initialization with real config structures
- **End-to-End Tests**: Full command execution with mocked blockchain (Hardhat or similar)
- **Target Coverage**: 80%+ line coverage, 100% for critical paths

### Code Organization
- Keep commands focused and small (< 200 lines each)
- Extract complex logic into utility functions
- Use dependency injection throughout
- Prefer composition over inheritance
- Keep service boundaries clear

### Error Handling
- Always catch and log errors appropriately
- Map service errors to CLI errors with helpful messages
- Include context in error logs (e.g., which RPC endpoint failed)
- Use custom error classes with specific exit codes

### Logging Best Practices
- Log all network calls with endpoints and response times
- Log validation steps for debugging
- Include fingerprints/addresses in log context (masked if sensitive)
- Use structured JSON logging for machine readability
- Avoid logging sensitive data (private keys)

---

## Phase-by-Phase Success Criteria

### Phase 1 Complete When
- Project builds without errors
- All type definitions compile
- Logger initializes and writes JSON to stderr
- All utilities have passing unit tests
- Directory structure matches specification

### Phase 2 Complete When
- Configuration loads from all 3 sources (file/env/flags)
- Configuration validation catches all error cases
- All 3 configuration commands work
- DEXES_* env vars properly recognized
- Config merge order correct (flags > env > file > defaults)

### Phase 3 Complete When
- Web3PGPServiceFactory creates service from config
- PublicClient initializes with multiple RPC endpoints and fallback chain
- WalletClient created only when private key configured and valid
- Service implements IWeb3PGPService interface from SDK
- All unit and integration tests pass
- Error handling for invalid RPC endpoints, missing private key, malformed addresses works correctly

### Phase 4 Complete When
- All 8 commands implemented and tested
- Commands accept correct flags and options
- Commands output correct format (JSON, armored keys)
- Error handling produces correct exit codes
- CLI help text complete and accurate
- All integration tests pass

---

## Known Challenges & Mitigation

### Challenge 1: RPC Endpoint Fallback
**Issue**: Viem's fallback transport may mask which endpoint failed
**Mitigation**: Add comprehensive logging with endpoint retry attempts

### Challenge 2: Private Key Security
**Issue**: Private key stored in memory or config
**Mitigation**: 
- Never log full private key
- Support reading from env var for automation
- Document secure setup guide
- Plan for hardware wallet support (future)

### Challenge 3: OpenPGP Key Validation
**Issue**: openpgp.js library learning curve
**Mitigation**:
- Create wrapper functions in Web3PGP service
- Reference specifications for validation rules
- Write unit tests for key parsing

### Challenge 4: Testing with Real Blockchain
**Issue**: Need test environment for integration tests
**Mitigation**:
- Use Hardhat local network for tests
- Mock Web3PGP service for unit tests
- Plan integration tests against Sepolia (if needed)

---

## Future Enhancements (Post-MVP)

1. **Hardware Wallet Support** - Ledger, Trezor integration
2. **Key Management UI** - Web dashboard for key management
3. **Batch Operations** - Register multiple keys at once
4. **Key Rotation** - Automated key rotation policies
5. **Multi-Signature** - Multi-sig contract support
6. **Decryption Flow** - Full EDI document decryption
7. **Performance** - Caching and optimization
8. **Analytics** - Usage metrics and monitoring

---

## Resources & References

- **Commander.js**: https://github.com/tj/commander.js
- **Pino Logger**: https://getpino.io/
- **Viem Documentation**: https://viem.sh/
- **OpenPGP.js**: https://openpgpjs.org/
- **Web3PGP SDK**: Reference local workspace implementation
- **Solidity Contracts**: Reference `contracts/src/Web3PGP.sol`
