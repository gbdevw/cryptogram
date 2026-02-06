# Sepolia Integration Test Setup

## Overview

The integration tests have been migrated from local Anvil to Sepolia testnet. This eliminates the Anvil responsiveness issues caused by Jest's TypeScript compilation overhead.

## Architecture Changes

### Before: Anvil-based Testing
```
test-orchestrator.js
  ├─ Spawn Anvil server
  ├─ Wait for health checks
  ├─ Deploy contracts via Foundry
  ├─ Generate .env.test
  └─ Run Jest tests
  └─ Kill Anvil
```

### After: Sepolia Configuration-Driven Testing
```
test-orchestrator.js
  ├─ Verify .env.integration exists
  └─ Run Jest tests
     ├─ jest.integration.setup.js
     │  ├─ Load environment variables
     │  ├─ Validate with test-config.ts
     │  └─ Print RPC configuration
     └─ Tests use:
        ├─ getTestWalletClient() - Viem client with fallback RPC
        ├─ getPublicClient() - For read-only operations
        └─ getContractAddress() - Get pre-deployed contract addresses
```

## Configuration System

### 1. **test-config.ts** (`src/config/test-config.ts`)
- **Purpose**: Load and validate Sepolia configuration
- **Validates**:
  - RPC URLs (comma-separated, valid URLs)
  - Private key (0x + 64 hex characters)
  - Contract addresses (0x + 40 hex characters)
- **Exports**: `loadTestConfig()`, `getTestConfig()`
- **Error Handling**: Clear instructions for missing/invalid config

### 2. **test-wallet.ts** (`src/utils/test-wallet.ts`)
- **Purpose**: Create Viem clients for integration tests
- **Exports**:
  - `getTestWalletClient()` - Wallet client with fallback RPC
  - `getPublicClient()` - Public client for read-only calls
  - `getContractAddress(key)` - Get contract address by key
- **Features**:
  - Fallback transport with multiple RPC endpoints
  - Batching: size=20, wait=100ms per endpoint
  - Automatic account derivation from private key
  - Sepolia chain configuration

### 3. **jest.integration.setup.js**
- **Loads**: `.env.integration` or `.env.test` (backwards compatible)
- **Validates**: Configuration via test-config.ts
- **Prints**: RPC endpoints and contract addresses for debugging
- **Fails Fast**: With clear error messages if config is invalid

### 4. **test-orchestrator.js**
- **Simplified**: From 411 lines (Anvil) to 78 lines (Sepolia)
- **Removed**: All Anvil spawn/deployment logic
- **Purpose**: Verify config exists, run Jest, report results

## Required Setup

### Step 1: Create `.env.integration`

Copy the template and fill in your values:

```bash
cp sdks/typescript/.env.integration.example sdks/typescript/.env.integration
```

Edit `.env.integration`:

```bash
# RPC endpoints (comma-separated) with fallback support
RPC_URLS=https://ethereum-sepolia-rpc.publicnode.com,https://rpc2.sepolia.org,https://gateway.tenderly.co/public/sepolia

# Your test account private key (keep this secret!)
# Get testnet ETH from: https://www.alchemy.com/faucets/ethereum-sepolia
WALLET_PRIVATE_KEY=0x...

# Pre-deployed contract addresses on Sepolia
DEXES_ACCESS_MANAGER=0xEE9C6cBB829A65185cD9756A83fD576B4985d8a3
DEXES_WEB3PGP=0xDa63568866C8eB53627a5CCF27DaB76061538dB1
DEXES_WEB3SIGN=0x8ceb8c20c367C32a459575f165566978c54da2c4
```

### Step 2: Fund Your Test Account

Get testnet ETH (faucets require signup):
1. **Alchemy Faucet**: https://www.alchemy.com/faucets/ethereum-sepolia
2. **Faucet.sepolia.dev**: https://faucet.sepolia.dev/

### Step 3: Update Test Files

Replace hardcoded addresses with `getContractAddress()`:

```typescript
// Before
const Web3PGPAddress = '0xDa63568866C8eB53627a5CCF27DaB76061538dB1';

// After
import { getContractAddress } from '../../utils/test-wallet';
const Web3PGPAddress = getContractAddress('DEXES_WEB3PGP');
```

### Step 4: Run Tests

```bash
cd sdks/typescript
npm run test:integration
```

Or directly via orchestrator:
```bash
node scripts/test-orchestrator.js
```

## Environment Variables Reference

| Variable | Type | Example | Notes |
|----------|------|---------|-------|
| `RPC_URLS` | string (comma-separated) | `https://endpoint1,https://endpoint2` | Fallback RPC endpoints for Sepolia |
| `WALLET_PRIVATE_KEY` | string | `0xac0974bec39a17e36ba4a6b4d238ff944bacb476cbed5490deccb132b12c722` | Test account (66 chars: 0x + 64 hex) |
| `DEXES_ACCESS_MANAGER` | string | `0xEE9C6cBB829A65185cD9756A83fD576B4985d8a3` | Access Manager address |
| `DEXES_WEB3PGP` | string | `0xDa63568866C8eB53627a5CCF27DaB76061538dB1` | Web3PGP contract address |
| `DEXES_WEB3SIGN` | string | `0x8ceb8c20c367C32a459575f165566978c54da2c4` | Web3Sign contract address |

## RPC Fallback Configuration

Each RPC endpoint has batching enabled:
- **Batch Size**: 20 requests per batch
- **Batch Wait**: 100ms between batches
- **Fallback**: Automatically tries next endpoint if one fails

This provides:
- Network resilience (one endpoint down? Use backup)
- Better performance (batch RPC calls)
- Stable integration tests (no Anvil responsiveness issues)

## Common Issues

### Error: "Configuration file not found"
**Solution**: Create `.env.integration` with RPC_URLS, WALLET_PRIVATE_KEY, and contract addresses

### Error: "Invalid WALLET_PRIVATE_KEY format"
**Solution**: Private key must be exactly 66 characters: `0x` + 64 hex digits

### Error: "Invalid RPC_URLS: Invalid URL"
**Solution**: Check RPC_URLS format (comma-separated, valid HTTPS URLs)

### Timeout: Tests hang or fail with timeout
**Solution**: 
1. Verify test account has Sepolia ETH
2. Check RPC endpoints are accessible: `curl https://ethereum-sepolia-rpc.publicnode.com -X POST -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId"}'`
3. Increase jest timeout in `jest.integration.config.js`

## Files Changed

**New Files**:
- `src/config/test-config.ts` - Configuration loader and validator
- `src/utils/test-wallet.ts` - Viem client factories
- `.env.integration.example` - Configuration template

**Modified Files**:
- `jest.integration.setup.js` - Added config validation
- `jest.integration.config.js` - Increased timeout for network latency
- `scripts/test-orchestrator.js` - Removed Anvil logic, simplified to Sepolia runner

**To Update**:
- `__tests__/web3pgp.integration.test.ts` - Use `getContractAddress()`
- `__tests__/web3pgp.service.integration.test.ts` - Use `getContractAddress()`
- `__tests__/web3sign.integration.test.ts` - Use `getContractAddress()`

## Test Execution Flow

```
npm run test:integration
    ↓
scripts/test-orchestrator.js (start)
    ├─ Check .env.integration exists
    ├─ Run: npx jest --config jest.integration.config.js
    │   ├─ jest.integration.setup.js (beforeAll)
    │   │   ├─ Load .env.integration
    │   │   ├─ Validate with test-config.ts
    │   │   └─ Print RPC configuration
    │   ├─ Run test files
    │   │   └─ Tests use getTestWalletClient(), getPublicClient(), getContractAddress()
    │   └─ Report results
    └─ Exit with status
```

## Performance Comparison

| Metric | Anvil (Old) | Sepolia (New) |
|--------|------------|----------------|
| Setup time | ~5-10s | 0s (config only) |
| RPC startup | ~2-3s | 0s (no startup) |
| Jest compile | ~40s | ~40s (unchanged) |
| RPC availability | ❌ Unresponsive during compile | ✅ Always available |
| Test isolation | ✅ Fresh state each run | ⚠️ Shared testnet state |
| Cost | Free (local) | Free (Sepolia faucet) |

## Why Sepolia Over Anvil?

The original Anvil approach had a critical flaw: **Jest's TypeScript compilation is CPU-intensive and lasts 40+ seconds**. During this time, Anvil becomes unresponsive to RPC calls, causing all tests to timeout.

With Sepolia:
- ✅ No Anvil startup overhead
- ✅ No local deployment overhead
- ✅ RPC stays responsive during Jest compilation
- ✅ Multiple RPC endpoints with fallback
- ✅ Real blockchain testing (more realistic)
- ✅ Easier CI/CD integration
