# Web3PGP CLI - Testing Guide

This guide explains how to run tests and where test files are located in the Web3PGP CLI project.

## Test Structure

The project uses Jest for testing with two types of test suites:

### Unit Tests
- **Location**: `__tests__/unit/`
- **Purpose**: Test individual functions, components, and services in isolation
- **Config**: `jest.config.js`

### Integration Tests
- **Location**: `__tests__/integration/`
- **Purpose**: Test interactions between components and with the blockchain
- **Config**: `jest.integration.config.js`

## Test Organization

```
__tests__/
├── jest.setup.ts                   # Jest setup configuration
├── setup.ts                        # Test setup utilities
├── unit/
│   ├── config-loader.test.ts       # Configuration loader tests
│   ├── config-validator.test.ts    # Configuration validator tests
│   ├── errors.test.ts              # Error handling tests
│   └── services/
│       └── [service tests]         # Service layer tests
└── integration/
    └── [integration tests]          # End-to-end and integration tests
```

## Running Tests

### Run All Unit Tests

```bash
npm test
```

This runs all unit tests matching the pattern `**/*.test.ts` in the `__tests__/unit/` directory.

### Run All Integration Tests

```bash
npm run test:integration
```

This runs integration tests using the separate Jest configuration.

### Watch Mode (Unit Tests)

Automatically re-run tests when files change:

```bash
npm run test:watch
```

### Watch Mode (Integration Tests)

```bash
npm run test:integration:watch
```

### Test Coverage

Generate a coverage report for unit tests:

```bash
npm run test:coverage
```

Coverage reports are generated in the `coverage/` directory with:
- HTML report: `coverage/lcov-report/index.html`
- Text summary in console output

## Test Types and Examples

### Unit Tests - Configuration

**File**: `__tests__/unit/config-loader.test.ts`

Tests the configuration loading and merging logic:

```typescript
describe('loadConfig', () => {
  it('should load default configuration', () => {
    const config = loadConfig({});
    expect(config.ethereum.chain).toBe('ink-sepolia');
  });

  it('should override defaults with environment variables', () => {
    const config = loadConfig({
      envVars: { DEXES_CHAIN: 'sepolia' }
    });
    expect(config.ethereum.chain).toBe('sepolia');
  });

  it('should load and merge YAML config file', () => {
    // Test loading from file
  });
});
```

### Unit Tests - Validation

**File**: `__tests__/unit/config-validator.test.ts`

Tests configuration validation:

```typescript
describe('validateConfig', () => {
  it('should validate correct configuration', () => {
    const valid = validateConfig(validConfig);
    expect(valid).toBe(true);
  });

  it('should reject invalid private key format', () => {
    expect(() => {
      validateConfig({ ...validConfig, wallet: { privateKey: 'invalid' } }); // pragma: allowlist secret
    }).toThrow(ConfigError);
  });
});
```

### Service Tests

**Location**: `__tests__/unit/services/`

Tests service layer logic:

```typescript
describe('Web3PGPService', () => {
  it('should register a key', async () => {
    // Mock blockchain calls
    // Test key registration flow
  });

  it('should retrieve keys by fingerprint', async () => {
    // Mock contract queries
    // Test key retrieval
  });
});
```

### Integration Tests

**Location**: `__tests__/integration/`

Test real interactions with smart contracts and blockchain:

```typescript
describe('Key Registration Integration', () => {
  beforeAll(async () => {
    // Setup test blockchain environment (Anvil)
  });

  it('should register and retrieve a key end-to-end', async () => {
    // Register key via blockchain
    // Query blockchain to verify
    // Validate results
  });
});
```

## Jest Configuration

### Unit Tests (`jest.config.js`)

```javascript
{
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__/unit'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/jest.setup.ts']
}
```

### Integration Tests (`jest.integration.config.js`)

```javascript
{
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__/integration'],
  testMatch: ['**/*.test.ts'],
  // Longer timeout for blockchain operations
  testTimeout: 30000
}
```

## Writing Tests

### Basic Unit Test Structure

```typescript
import { functionToTest } from '../../src/path/to/function';

describe('Feature Name', () => {
  describe('Specific Behavior', () => {
    it('should do something specific', () => {
      const result = functionToTest(input);
      expect(result).toBe(expected);
    });

    it('should handle error cases', () => {
      expect(() => functionToTest(invalidInput)).toThrow(CustomError);
    });
  });
});
```

### Mocking

Use Jest mocking for dependencies:

```typescript
jest.mock('../../src/config/loader', () => ({
  loadConfig: jest.fn().mockReturnValue({
    ethereum: { chain: 'ink-sepolia' }
  })
}));

import { loadConfig } from '../../src/config/loader';

describe('ConfigurationTests', () => {
  it('should use mocked configuration', () => {
    const config = loadConfig({});
    expect(config.ethereum.chain).toBe('ink-sepolia');
  });
});
```

### Testing Async Code

```typescript
describe('Async Operations', () => {
  it('should handle async operations', async () => {
    const result = await asyncFunction();
    expect(result).toBeDefined();
  });

  it('should handle rejected promises', async () => {
    await expect(failingAsyncFunction()).rejects.toThrow();
  });
});
```

## Test Utilities

**File**: `__tests__/setup.ts`

Contains common test utilities:

- Configuration fixtures
- Mock service factories
- Test data generators
- Blockchain mock helpers

## Coverage Goals

Maintain test coverage across:

- **Configuration system**: > 80%
  - Loader, validator, transport layer
- **Services**: > 75%
  - Business logic and blockchain interactions
- **Error handling**: 100%
  - All error paths tested
- **Commands**: > 70%
  - CLI command execution

Run coverage report:

```bash
npm run test:coverage
```

View HTML report:

```bash
open coverage/lcov-report/index.html
```

## Debugging Tests

### Run Specific Test File

```bash
npm test -- config-loader.test.ts
```

### Run Tests Matching Pattern

```bash
npm test -- --testNamePattern="should load configuration"
```

### Enable Debug Output

```bash
DEBUG=* npm test
```

### Debug with Node Inspector

```bash
node --inspect-brk ./node_modules/.bin/jest --runInBand
```

Then open `chrome://inspect` in Chrome DevTools.

## CI/CD Testing

Tests are run automatically in CI pipeline:

1. Unit tests run on every push
2. Coverage reports are generated
3. Integration tests run in test environment
4. Coverage thresholds must be met before merge

## Continuous Development

As you add new features:

1. Write test cases first (TDD approach)
2. Implement the feature
3. Ensure all tests pass: `npm test`
4. Check coverage: `npm run test:coverage`
5. Run integration tests: `npm run test:integration`

## Common Testing Issues

### Tests Timing Out

Increase timeout for integration tests:

```typescript
jest.setTimeout(30000); // 30 seconds
```

### Mocks Not Working

Clear mocks between tests:

```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

### Async Test Hangs

Ensure promises are properly returned or awaited:

```typescript
// Good
return promise;
// Or
await promise;
```

## Resources

- [Jest Documentation](https://jestjs.io/)
- [ts-jest Documentation](https://kulshekhar.github.io/ts-jest/)
- [Testing Best Practices](../../documentation/SETUP.md)
- [Configuration Reference](CONFIGURATION.md)
