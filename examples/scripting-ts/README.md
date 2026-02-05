# Cryptogram Scripting Example (TypeScript)

This example demonstrates the complete PKI and document timestamping workflow using the Cryptogram system on Ink Sepolia testnet.

## What It Does

1. **Loads a certification key** - Decrypts a pre-generated PGP key used to certify other keys and recognized by the verification front-end
2. **Creates a customer key** - Generates a new RSA-4096 PGP key
3. **Registers the customer key** - Publishes the key on-chain via Web3PGP contract
4. **Certifies the key** - Signs the customer key with the certification key
5. **Creates and signs a document** - Creates a sample document, hashes it, and signs with the customer key
6. **Timestamps the document** - Stores the document hash and signature on-chain via Web3Sign contract
7. **Verifies the timestamp** - Retrieves and validates the stored document from the blockchain

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Environment Variables
```bash
export PRIVATE_KEY=<your-wallet-private-key>
```

### 3. Run the Example
```bash
npm run start
```

The script will output a document ID and verification details. Generated documents are saved locally.

## Outputs

- **Local file**: Sample document created in the working directory
- **On-chain**: Document hash and signature stored in Web3Sign contract
- **Verification**: Proof available at [Cryptogram Verifier](https://dexes-verify.vercel.app/#/timestamp)

## Test Credentials

The example includes a test certification key (`certifier.asc`) encrypted with password `123456789` for demonstration purposes only.