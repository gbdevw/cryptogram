# Web3PGP CLI - Startup Instructions

## Fresh Context Setup

This document provides step-by-step instructions for beginning implementation of the Web3PGP CLI from a fresh development context. Use this guide when starting a new implementation session or bringing a new team member up to speed.

---

## Prerequisites Checklist

Before starting, verify you have:

- [ ] Node.js 18.x or higher (`node --version`)
- [ ] npm 9.x or higher (`npm --version`)
- [ ] Git configured (`git config user.name` and `git config user.email`)
- [ ] Text editor/IDE (VS Code recommended)
- [ ] Cryptogram project cloned: `/home/gbdevw/Projects/cryptogram`
- [ ] Read all specification documents:
  - `clis/web3pgp/specifications/requirements.md`
  - `clis/web3pgp/specifications/configuration.md`
  - `clis/web3pgp/specifications/commands.md`
  - `clis/web3pgp/specifications/architecture.md`

---

## Context Understanding (30 minutes)

### Project Overview
The Web3PGP CLI is a TypeScript command-line tool for managing OpenPGP keys on the Ethereum blockchain via a smart contract. It enables:
- Registering OpenPGP public keys on-chain
- Adding subkeys to existing keys
- Revoking keys
- Retrieving keys from the blockchain
- Listening for key events in real-time

### Architecture at a Glance
```
User Command
    ↓
Commander.js (CLI parsing)
    ↓
Config Loader (3-tier: file/env/flags)
    ↓
Viem Web3 Service (PublicClient/WalletClient with RPC fallback)
    ↓
Web3PGP Service (from @web3pgp/sdk)
    ↓
Smart Contract (Web3PGP.sol)
```

### Key Dependencies
- **Commander.js**: CLI framework with subcommand support
- **Pino**: JSON logger
- **Viem**: Ethereum client library
- **OpenPGP.js**: PGP key parsing and validation
- **@web3pgp/sdk**: Wrapper around Web3PGP contract

### Configuration System
- **3-tier precedence**: Command flags > Environment variables > Config file > Defaults
- **Environment prefix**: All env vars start with `DEXES_`
- **Config file**: YAML format at `~/.web3pgp/config.yaml`
- **Default network**: Ink Sepolia testnet (chainId: 763373)

---

## Implementation Roadmap

### Phase Breakdown (4-6 weeks total)

**Phase 1: Foundation** (1 week)
- Project setup, TypeScript configuration, type definitions, logger, utilities
- Deliverable: Build passes, logger works, types compile

**Phase 2: Configuration** (1.5 weeks)
- Config loading, validation, merging
- Configuration commands (generate, display, validate)
- Deliverable: Config system fully functional with 3-tier merging

**Phase 3: Services** (1.5 weeks)
- Viem client initialization with RPC fallback
- Wallet derivation from private key
- Web3PGP service factory
- Deliverable: All services initialize correctly with mocked config

**Phase 4: Commands** (2-2.5 weeks)
- All 8 commands (5 blockchain + 3 configuration)
- Error handling, logging, output formatting
- Deliverable: CLI fully functional with all commands

### Which Phase to Start?
**ALWAYS START WITH PHASE 1.** Each phase depends on previous phases.

---

## Step-by-Step Startup Guide

### Step 1: Navigate to CLI Directory

```bash
cd /home/gbdevw/Projects/cryptogram/clis/web3pgp
```

Verify you see:
```
spec/
├── commands.md
├── architecture.md
├── configuration.md
├── requirements.md
└── implementation_plan.md
```

### Step 2: Initialize npm Project

If `package.json` doesn't exist, create it:

```bash
npm init -y
```

This creates a basic `package.json`. We'll update it in the next step.

### Step 3: Create package.json

Replace the auto-generated `package.json` with the Phase 1 configuration:

```json
{
  "name": "@web3pgp/cli",
  "version": "0.1.0",
  "description": "Web3PGP CLI - Decentralized OpenPGP key infrastructure on Ethereum",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "web3pgp": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/index.ts",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src",
    "lint:fix": "eslint src --fix",
    "format": "prettier --write src"
  },
  "dependencies": {
    "commander": "^11.0.0",
    "pino": "^8.16.0",
    "yaml": "^2.3.0",
    "viem": "^1.20.0",
    "openpgp": "^5.10.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "ts-node": "^10.9.0",
    "@types/node": "^20.10.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "@types/jest": "^29.5.0",
    "eslint": "^8.54.0",
    "@typescript-eslint/parser": "^6.13.0",
    "@typescript-eslint/eslint-plugin": "^6.13.0",
    "prettier": "^3.1.0"
  }
}
```

### Step 4: Create TypeScript Configuration

Create `tsconfig.json` in the `clis/web3pgp` directory:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "allowJs": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "__tests__"]
}
```

### Step 5: Create Directory Structure

```bash
# Create all required directories
mkdir -p src/commands/blockchain
mkdir -p src/commands/configuration
mkdir -p src/config
mkdir -p src/services
mkdir -p src/utils
mkdir -p __tests__/unit
mkdir -p __tests__/integration

# Verify structure
find src -type d | sort
```

Expected output:
```
src
src/commands
src/commands/blockchain
src/commands/configuration
src/config
src/services
src/utils
```

### Step 6: Create ESLint Configuration

Create `.eslintrc.json`:

```json
{
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "plugins": ["@typescript-eslint"],
  "env": {
    "node": true,
    "es2020": true
  },
  "rules": {
    "@typescript-eslint/explicit-function-return-types": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "no-console": "off",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

### Step 7: Create Prettier Configuration

Create `.prettierrc.json`:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

### Step 8: Create Jest Configuration

Create `jest.config.js`:

```javascript
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

### Step 9: Install Dependencies

```bash
npm install
```

This will take 2-3 minutes. Verify completion:
```bash
ls node_modules | head -20
```

### Step 10: Create Initial Source Files

#### Create `src/types.ts`

```typescript
/**
 * Global type definitions for Web3PGP CLI
 */

export type ChainId = number;
export type EthereumAddress = `0x${string}`;
export type Fingerprint = `0x${string}`;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
```

#### Create `src/errors.ts`

```typescript
/**
 * Custom error classes for Web3PGP CLI
 */

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class BlockchainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockchainError';
  }
}
```

#### Create `src/config/types.ts`

```typescript
/**
 * Configuration type definitions
 */

import { ChainId, EthereumAddress, LogLevel } from '../types';

export interface RpcEndpoint {
  url: string;
  priority: number;
}

export interface EthereumConfig {
  chainId: ChainId;
  rpc: {
    endpoints: RpcEndpoint[];
  };
  wallet: {
    type: 'private-key';
    privateKey?: `0x${string}`;  # pragma: allowlist secret
  };
}

export interface Web3PGPConfig {
  contract: EthereumAddress;
}

export interface MonitoringConfig {
  logging: {
    level: LogLevel;
  };
}

export interface MergedConfig {
  ethereum: EthereumConfig;
  web3pgp: Web3PGPConfig;
  monitoring: MonitoringConfig;
}
```

#### Create `src/index.ts`

```typescript
/**
 * Web3PGP CLI Entry Point
 * 
 * To be implemented in Phase 4 after all services and commands are built.
 */

console.log('Web3PGP CLI v0.1.0 - Starting...');

export {};
```

### Step 11: Create .gitignore

Create `.gitignore` in `clis/web3pgp`:

```
node_modules/
dist/
coverage/
.env
.env.local
*.log
.DS_Store
```

### Step 12: Test Build

Verify the project builds:

```bash
npm run build
```

Expected output:
```
Successfully compiled TypeScript files to dist/
```

Expected `dist/` structure:
```
dist/
├── types.js
├── errors.js
├── index.js
└── config/
    └── types.js
```

### Step 13: Verify Installation

Run these verification commands:

```bash
# Check TypeScript version
npx tsc --version

# Check ESLint is available
npx eslint --version

# Check Jest is available
npx jest --version

# Run linter (should pass with no errors)
npm run lint

# Format code (should complete without output)
npm run format

# Run tests (should show "No tests found")
npm run test
```

All commands should complete successfully.

---

## Starting Phase 1 Implementation

### Phase 1 Overview
Create foundational infrastructure that all other phases depend on.

### Phase 1 Checklist
- [ ] Project builds without errors
- [ ] TypeScript compiles cleanly
- [ ] Logger initializes and outputs to stderr
- [ ] Output utilities format JSON correctly
- [ ] Error classes work and have correct exit codes
- [ ] All Phase 1 unit tests pass

### First Task in Phase 1: Create Logger Utility

Create `src/utils/logger.ts`:

```typescript
import pino, { Logger as PinoLogger } from 'pino';
import { LogLevel } from '../types';

/**
 * Create root logger for the CLI
 */
export function createRootLogger(level: LogLevel = 'info'): PinoLogger {
  return pino({
    level,
    transport: {
      target: 'pino/file',
      options: {
        destination: 2, // stderr (fd 2)
        sync: false,
      },
    },
  });
}

/**
 * Create child logger with additional context
 */
export function createChildLogger(
  parent: PinoLogger,
  context: Record<string, unknown>
): PinoLogger {
  return parent.child(context);
}

export type Logger = PinoLogger;
```

### Creating First Unit Test

Create `__tests__/unit/errors.test.ts`:

```typescript
import {
  ConfigError,
  ValidationError,
  BlockchainError,
} from '../../src/errors';

describe('Custom Errors', () => {
  it('should create ConfigError with correct name', () => {
    const error = new ConfigError('Test config error');
    expect(error.message).toBe('Test config error');
    expect(error.name).toBe('ConfigError');
  });

  it('should create ValidationError with correct name', () => {
    const error = new ValidationError('Test validation error');
    expect(error.message).toBe('Test validation error');
    expect(error.name).toBe('ValidationError');
  });

  it('should create BlockchainError with correct name', () => {
    const error = new BlockchainError('Test blockchain error');
    expect(error.message).toBe('Test blockchain error');
    expect(error.name).toBe('BlockchainError');
  });
});
```

### Running First Test

```bash
npm run test
```

Expected output: 1 test passing

### Next Steps After Setup

Once the setup is complete:

1. **Read the Architecture Document**: Understand the design patterns and service initialization flow
2. **Read the Implementation Plan**: Understand Phase 1 deliverables in detail
3. **Start with Logger**: First real implementation task
4. **Progress through Phase 1 items**: Follow the checklist in `implementation_plan.md`
5. **Commit regularly**: After each component is complete, commit to git

---

## Development Workflow Commands

### During Development

```bash
# Watch mode - rebuild on file changes
npm run build -- --watch

# Run tests in watch mode
npm run test:watch

# Check linting issues
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Format code
npm run format

# Full check before committing
npm run lint && npm run format && npm run build && npm run test
```

### Debugging

```bash
# Run a command with logging enabled
DEXES_LOG_LEVEL=debug npm run dev -- register --help

# Run a specific test with verbose output
npm run test -- commands.test.ts --verbose

# Generate test coverage report
npm run test:coverage
```

---

## Common Issues & Troubleshooting

### Issue: "Cannot find module 'viem'"
**Solution:** Run `npm install` again. If persists, delete `node_modules` and `package-lock.json`, then reinstall.

### Issue: "TypeScript errors but no build output"
**Solution:** Run `npm run lint` to see detailed TypeScript errors. Fix them and rebuild.

### Issue: "Jest can't find tests"
**Solution:** Make sure test files end in `.test.ts` and are in `__tests__/` directory.

### Issue: "Port already in use" (if running dev server)
**Solution:** Kill existing process: `pkill -f "ts-node"` and try again.

### Issue: "Cannot read private key from environment"
**Solution:** Ensure `DEXES_WALLET_PRIVATE_KEY` is set if you're testing write operations. For development, use a hardhat test private key (never use real funds).

---

## Key Files to Reference During Implementation

### Specifications (Read First)
- `specifications/requirements.md` - What the CLI should do
- `specifications/commands.md` - Exact command specifications with examples
- `specifications/configuration.md` - Config structure and DEXES_* env vars
- `specifications/architecture.md` - Design patterns and service initialization

### Implementation Plan
- `specifications/implementation_plan.md` - Phased breakdown with deliverables

### Reference Code
- `/home/gbdevw/Projects/cryptogram/sdks/typescript/` - SDK usage examples
- `/home/gbdevw/Projects/cryptogram/contracts/src/Web3PGP.sol` - Contract interface

---

## Getting Help

### When Stuck
1. **Check the specifications** - Commands are specified in detail
2. **Review architecture.md** - Design patterns are documented with code examples
3. **Look at implementation_plan.md** - Each phase has step-by-step deliverables
4. **Check existing code** - Reference `/sdks/typescript/` for SDK patterns

### Common Questions

**Q: How do I handle errors?**
A: Use custom error classes (ConfigError, ValidationError, BlockchainError) defined in `src/errors.ts`. Each maps to a specific exit code.

**Q: How do I validate configuration?**
A: Implement validator functions in `src/config/validator.ts`. See implementation_plan Phase 2.2 for details.

**Q: How do I test without a real blockchain?**
A: Use Jest mocks to mock Viem clients and the Web3PGP service. Example patterns in implementation_plan.

**Q: Where should I put utility functions?**
A: Place in `src/utils/` directory. Create separate files per utility (logger.ts, output.ts, input.ts, etc.).

---

## Success Criteria for Setup

You have successfully completed the setup when:

- [ ] `npm install` completes without errors
- [ ] `npm run build` produces files in `dist/`
- [ ] `npm run lint` passes with no errors
- [ ] `npm run test` runs (even if no tests yet)
- [ ] All TypeScript files compile without errors
- [ ] You can describe the 4 phases in your own words
- [ ] You understand the 3-tier configuration system
- [ ] You know where to find each specification document
- [ ] Initial directory structure matches the project structure

---

## Ready to Begin?

Once you've completed all setup steps:

1. **Create a new git branch** for your work: `git checkout -b feature/cli-phase1`
2. **Start with Phase 1** by creating the logger utility
3. **Follow the implementation_plan.md** for detailed deliverables
4. **Commit after each component** is complete
5. **Reference the specifications** as needed

For detailed implementation steps for Phase 1, see `implementation_plan.md` Section "Phase 1: Project Setup & Foundation".

Good luck! 🚀
