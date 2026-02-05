# Deployment and Role Management Scripts

This directory contains Foundry scripts for deploying contracts and managing roles in the AccessManager.

## Deployment Scripts

### DeployAccessManager.s.sol
Deploys the AccessManagerUpgradeable contract with UUPS proxy pattern.

**Environment Variables:**
- `PRIVATE_KEY`: Deployer's private key
- `RPC_URL`: RPC endpoint URL

**Usage:**
```bash
forge script scripts/DeployAccessManager.s.sol --rpc-url $RPC_URL --broadcast
```

### DeployWeb3PGP.s.sol
Deploys Web3PGP contract and configures roles in AccessManager.

**Environment Variables:**
- `PRIVATE_KEY`: Deployer's private key
- `ACCESS_MANAGER`: Address of deployed AccessManager proxy
- `FEE_IN_WEIS`: Initial fee amount in wei
- `RPC_URL`: RPC endpoint URL

**Usage:**
```bash
export ACCESS_MANAGER=0x...
export FEE_IN_WEIS=1000000000000000
forge script scripts/DeployWeb3PGP.s.sol --rpc-url $RPC_URL --broadcast
```

### DeployWeb3Sign.s.sol
Deploys Web3Sign contract and assigns existing roles to its functions.

**Environment Variables:**
- `PRIVATE_KEY`: Deployer's private key
- `ACCESS_MANAGER`: Address of deployed AccessManager proxy
- `WEB3PGP`: Address of deployed Web3PGP proxy
- `FEE_IN_WEIS`: Initial fee amount in wei
- `RPC_URL`: RPC endpoint URL

**Usage:**
```bash
export ACCESS_MANAGER=0x...
export WEB3PGP=0x...
export FEE_IN_WEIS=1000000000000000
forge script scripts/DeployWeb3Sign.s.sol --rpc-url $RPC_URL --broadcast
```

## Role Management Scripts

### Role IDs
- `ADMIN_ROLE` = 0 (can manage all roles)
- `UPGRADE_MANAGER_ROLE` = 1 (can upgrade contracts)
- `TREASURER_ROLE` = 2 (can manage fees)

### Admin Role Management

**Grant Admin Role:**
```bash
export ACCESS_MANAGER=0x...
export TARGET_ADDRESS=0x...
export EXECUTION_DELAY=0  # Optional, default 0
forge script scripts/GrantAdminRole.s.sol --rpc-url $RPC_URL --broadcast
```

**Revoke Admin Role:**
```bash
export ACCESS_MANAGER=0x...
export TARGET_ADDRESS=0x...
forge script scripts/RevokeAdminRole.s.sol --rpc-url $RPC_URL --broadcast
```

### Upgrade Manager Role Management

**Grant Upgrade Manager Role:**
```bash
export ACCESS_MANAGER=0x...
export TARGET_ADDRESS=0x...
export EXECUTION_DELAY=0  # Optional, default 0
forge script scripts/GrantUpgradeManagerRole.s.sol --rpc-url $RPC_URL --broadcast
```

**Revoke Upgrade Manager Role:**
```bash
export ACCESS_MANAGER=0x...
export TARGET_ADDRESS=0x...
forge script scripts/RevokeUpgradeManagerRole.s.sol --rpc-url $RPC_URL --broadcast
```

### Treasurer Role Management

**Grant Treasurer Role:**
```bash
export ACCESS_MANAGER=0x...
export TARGET_ADDRESS=0x...
export EXECUTION_DELAY=0  # Optional, default 0
forge script scripts/GrantTreasurerRole.s.sol --rpc-url $RPC_URL --broadcast
```

**Revoke Treasurer Role:**
```bash
export ACCESS_MANAGER=0x...
export TARGET_ADDRESS=0x...
forge script scripts/RevokeTreasurerRole.s.sol --rpc-url $RPC_URL --broadcast
```

## Important Notes

### Security Warnings
- **Admin Role**: Ensure at least one admin address remains active, or the AccessManager becomes unmanageable
- **Execution Delay**: Consider adding execution delays for critical roles in production
- **Private Keys**: Never commit private keys or `.env` files to version control

### Execution Delays
The `EXECUTION_DELAY` parameter adds a timelock before a granted role becomes active. This provides:
- Time to detect and respond to malicious grants
- Governance transparency for role changes
- Protection against immediate privilege escalation

Set to 0 for immediate activation (development/testing) or use values like 86400 (1 day) for production.

### Role Hierarchy
- ADMIN_ROLE can grant/revoke all roles including itself
- Other roles can only execute their assigned functions
- Role assignments are per-contract (Web3PGP and Web3Sign have separate function assignments)

## Deployment Workflow Example

```bash
# 1. Deploy AccessManager
forge script scripts/DeployAccessManager.s.sol --rpc-url $RPC_URL --broadcast
export ACCESS_MANAGER=<deployed_proxy_address>

# 2. Deploy Web3PGP
export FEE_IN_WEIS=1000000000000000
forge script scripts/DeployWeb3PGP.s.sol --rpc-url $RPC_URL --broadcast
export WEB3PGP=<deployed_proxy_address>

# 3. Deploy Web3Sign
forge script scripts/DeployWeb3Sign.s.sol --rpc-url $RPC_URL --broadcast

# 4. Grant roles to additional addresses
export TARGET_ADDRESS=0x...
forge script scripts/GrantTreasurerRole.s.sol --rpc-url $RPC_URL --broadcast
```
