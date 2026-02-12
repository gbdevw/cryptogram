# Smart Contracts

This directory contains the Solidity smart contracts for the Cryptogram project, built with [Foundry](https://book.getfoundry.sh/). The contracts implement a decentralized Public Key Infrastructure (PKI) and Electronic Data Interchange (EDI) system using OpenPGP cryptography.

## Architecture Overview

The system consists of three main contracts:

### Core Contracts

#### **Web3PGP** (`Web3PGP.sol`)
- **Purpose**: Decentralized OpenPGP key registry on Ethereum
- **Features**:
  - Register and manage OpenPGP public keys
  - Support for primary keys and subkeys
  - Key revocation with certificate publication
  - Gas-efficient storage using event logs
  - UUPS upgradeable for future enhancements

#### **Web3Sign** (`Web3Sign.sol`)
- **Purpose**: Document timestamping and EDI system
- **Features**:
  - Create immutable timestamps for any digital document
  - Proof-of-existence with cryptographic verification
  - Certified copy mechanism with provenance tracking
  - Integration with Web3PGP for identity verification
  - Support for signature workflows and acknowledgments

#### **FlatFee** (`FlatFee.sol`)
- **Purpose**: Fee management and access control
- **Features**:
  - Configurable flat fee for operations
  - Access-managed fee updates and withdrawals
  - Reentrancy protection
  - Integration with OpenZeppelin's AccessManager

### Interfaces

- `IWeb3PGP.sol` - Web3PGP contract interface
- `IWeb3Sign.sol` - Web3Sign contract interface
- `IFlatFee.sol` - FlatFee contract interface

## Development

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) - Ethereum development toolchain
- Solidity ^0.8.24

### Setup

```bash
# Install dependencies
forge install

# Compile contracts
forge build

# Run tests
forge test

# Run specific test file
forge test --match-path test/Web3PGP.t.sol
```

### Testing

The project includes comprehensive test suites:

```bash
# Run all tests
forge test

# Run tests with gas reporting
forge test --gas-report

# Run tests with verbose output
forge test -vv

# Run specific contract tests
forge test --match-contract Web3PGPTest
```

Test files:
- `FlatFee.t.sol` - Fee management and access control tests
- `Web3PGP.t.sol` - Key registration, subkeys, and revocation tests
- `Web3Sign.t.sol` - Document timestamping and verification tests

### Deployment Scripts

The `scripts/` directory contains Foundry scripts for deployment and contract management:

#### Deployment Scripts
- `DeployWeb3PGP.s.sol` - Deploy Web3PGP contract
- `DeployWeb3Sign.s.sol` - Deploy Web3Sign contract
- `DeployAccessManager.s.sol` - Deploy access manager
- `DeployTestEnvironment.s.sol` - Deploy complete test environment

#### Management Scripts
- `GrantAdminRole.s.sol`, `RevokeAdminRole.s.sol` - Admin role management
- `GrantFeeManagerRole.s.sol`, `RevokeFeeManagerRole.s.sol` - Fee management roles
- `GrantFundsManagerRole.s.sol`, `RevokeFundsManagerRole.s.sol` - Funds management roles
- `GrantUpgradeManagerRole.s.sol` - Upgrade management roles
- `UpdateFlatFee.s.sol` - Update contract fees
- `UpgradeWeb3PGP.s.sol`, `UpgradeWeb3Sign.s.sol` - Contract upgrades

### Usage Examples

```bash
# Deploy to local network
forge script script/DeployTestEnvironment.s.sol --fork-url http://localhost:8545 --broadcast

# Deploy to Sepolia testnet
forge script script/DeployWeb3PGP.s.sol --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast --verify

# Grant fee manager role
forge script script/GrantFeeManagerRole.s.sol --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast
```

## Security Considerations

- All contracts use OpenZeppelin's battle-tested upgradeable contracts
- Access control managed through OpenZeppelin's AccessManager
- Reentrancy protection on fee withdrawal operations
- Gas-efficient event-based storage strategy
- UUPS upgrade pattern for future enhancements

## Gas Optimization

The contracts are optimized for gas efficiency:
- Event logs used for data storage (90%+ cost savings vs contract storage)
- Minimal on-chain state storage
- ERC-7201 namespaced storage to prevent collisions
- Batch operations where possible

## License

Business Source License 1.1 - see individual contract headers for details.</content>
<parameter name="filePath">/home/gbdevw/Projects/cryptogram/contracts/README.md