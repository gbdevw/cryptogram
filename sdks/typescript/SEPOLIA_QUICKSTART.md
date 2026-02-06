# Quick Start: Sepolia Integration Tests

## TL;DR - Get Running in 5 Minutes

### 1. Create `.env.integration`

```bash
cd sdks/typescript
cat > .env.integration << 'EOF'
RPC_URLS=https://ethereum-sepolia-rpc.publicnode.com,https://rpc2.sepolia.org,https://gateway.tenderly.co/public/sepolia
WALLET_PRIVATE_KEY=0x[YOUR_PRIVATE_KEY_HERE]
DEXES_ACCESS_MANAGER=0xEE9C6cBB829A65185cD9756A83fD576B4985d8a3
DEXES_WEB3PGP=0xDa63568866C8eB53627a5CCF27DaB76061538dB1
DEXES_WEB3SIGN=0x8ceb8c20c367C32a459575f165566978c54da2c4
EOF
```

### 2. Fund Your Test Account

Your wallet address will be derived from the private key. Get testnet ETH:
- **Alchemy**: https://www.alchemy.com/faucets/ethereum-sepolia
- **Sepolia.dev**: https://faucet.sepolia.dev/

### 3. Run Tests

```bash
npm run test:integration
```

## Files Overview

| File | Purpose | Action |
|------|---------|--------|
| `.env.integration.example` | Configuration template | Copy to `.env.integration` and fill in |
| `src/config/test-config.ts` | Load & validate config | (Auto-loaded by Jest) |
| `src/utils/test-wallet.ts` | Viem clients with fallback RPC | Import in test files |
| `jest.integration.setup.js` | Validate config before tests | (Auto-runs) |
| `jest.integration.config.js` | Jest configuration | 120s timeout for Sepolia |
| `scripts/test-orchestrator.js` | Test runner | `npm run test:integration` → runs this |

## Key Exports

### From `src/utils/test-wallet.ts`

```typescript
// Get wallet client for sending transactions
const walletClient = getTestWalletClient();
const hash = await walletClient.sendTransaction({
  to: '0x...',
  value: parseEther('0.001'),
});

// Get public client for reading state
const publicClient = getPublicClient();
const balance = await publicClient.getBalance({ address: '0x...' });

// Get contract address by environment variable name
const web3pgpAddr = getContractAddress('DEXES_WEB3PGP');
```

## Environment Variables

All variables go in `.env.integration`:

```bash
# RPC endpoints (comma-separated, with fallback support)
RPC_URLS=https://endpoint1.com,https://endpoint2.com

# Test account private key (66 chars: 0x + 64 hex)
WALLET_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb476cbed5490deccb132b12c722

# Contract addresses (40 chars: 0x + 40 hex)
DEXES_ACCESS_MANAGER=0xEE9C6cBB829A65185cD9756A83fD576B4985d8a3
DEXES_WEB3PGP=0xDa63568866C8eB53627a5CCF27DaB76061538dB1
DEXES_WEB3SIGN=0x8ceb8c20c367C32a459575f165566978c54da2c4
```

## Validation

When you run tests, Jest setup validates:

1. ✅ `.env.integration` file exists
2. ✅ All RPC_URLS are valid HTTPS URLs
3. ✅ WALLET_PRIVATE_KEY is exactly 0x + 64 hex chars
4. ✅ Contract addresses are 0x + 40 hex chars each

If validation fails, you'll get a **clear error message** showing exactly what's wrong.

## Sepolia Contract Addresses (Pre-Deployed)

These are already deployed on Sepolia, just copy them into `.env.integration`:

```
DEXES_ACCESS_MANAGER=0xEE9C6cBB829A65185cD9756A83fD576B4985d8a3
DEXES_WEB3PGP=0xDa63568866C8eB53627a5CCF27DaB76061538dB1
DEXES_WEB3SIGN=0x8ceb8c20c367C32a459575f165566978c54da2c4
```

## Fallback RPC Configuration

The tests use **3 RPC endpoints with automatic fallback**:

1. `https://ethereum-sepolia-rpc.publicnode.com` (primary)
2. `https://rpc2.sepolia.org` (fallback 1)
3. `https://gateway.tenderly.co/public/sepolia` (fallback 2)

Each endpoint has:
- **Batch size**: 20 requests
- **Batch wait**: 100ms

If endpoint 1 fails, tests automatically use endpoint 2, then endpoint 3.

## Troubleshooting

### "ENOENT: no such file or directory, open '.env.integration'"

**Solution**: Create the file:
```bash
cp .env.integration.example .env.integration
```

### "Invalid WALLET_PRIVATE_KEY format"

**Cause**: Private key must be exactly 66 characters

**Fix**: Count: should be `0x` + 64 hex digits (0-9, a-f)
```
✓ Correct:   0xac0974bec39a17e36ba4a6b4d238ff944bacb476cbed5490deccb132b12c722
✗ Wrong:     0xac0974bec39a17e36ba4a6b4d238ff944bacb476cbed5490deccb132b12c7
✗ Wrong:     ac0974bec39a17e36ba4a6b4d238ff944bacb476cbed5490deccb132b12c722
```

### Tests timeout or fail

**Cause**: Likely no testnet ETH in account

**Fix**:
1. Get your address from private key using viem:
   ```typescript
   import { privateKeyToAccount } from 'viem/accounts';
   const account = privateKeyToAccount('0x...');
   console.log(account.address);
   ```
2. Fund it: https://www.alchemy.com/faucets/ethereum-sepolia
3. Wait ~30 seconds for transaction to finalize
4. Try tests again

### RPC endpoint errors

**Check RPC is working**:
```bash
curl https://ethereum-sepolia-rpc.publicnode.com \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
```

Should respond with: `{"jsonrpc":"2.0","result":"0xaa36a7","id":1}`

## Architecture Comparison

### ❌ Old (Anvil - Broken)
```
Start Anvil → Deploy contracts → Generate env → Run tests
     ↓
Jest compiles TypeScript (40+ sec)
     ↓
Anvil becomes unresponsive to RPC
     ↓
All tests timeout ✗
```

### ✅ New (Sepolia - Working)
```
Load .env.integration → Validate config → Run tests
          ↓
Jest compiles TypeScript (40+ sec)
          ↓
RPC endpoints stay responsive (on Sepolia)
          ↓
Tests pass ✓
```

## Performance

- **Setup time**: 0s (no Anvil startup)
- **Teardown**: 0s (nothing to cleanup)
- **Test isolation**: Tests share Sepolia state (be aware)
- **Cost**: Free (Sepolia faucet provides testnet ETH)

## Next Steps

1. ✅ Create `.env.integration` with your private key and RPC endpoints
2. ✅ Fund your test account with Sepolia ETH
3. ✅ Run `npm run test:integration`
4. ✅ Tests should pass!

Need help? Check `SEPOLIA_SETUP.md` for detailed information.
