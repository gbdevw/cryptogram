# Cryptogram — Setup & Verification

This document explains how to verify a development environment for the Cryptogram project (PKI + EDI on Ethereum using OpenPGP).

This file intentionally does not modify or add a `package.json` — it provides verification steps, recommended version managers, and sample commands to validate an installation.

---

## Scope
- Verify developer toolchain: Node, Node version manager, Foundry, Rust, TypeScript toolchain, test runners, and browser automation.
- Provide reproducible checks to validate that the system is ready for development, local testing, and CI.

## Prerequisites
- Operating system: Linux (recommended), macOS or Windows WSL supported.
- Git installed and configured.
- Recommended Node: LTS (>= 18).
- Foundry toolchain (forge, cast, anvil) for Solidity development.
- Rust toolchain (rustup) for Foundry.
- TypeScript toolchain (tsc) and Node-based test runners (Jest).
- Playwright for e2e tests (optional but recommended).
- WebCrypto availability in Node (required for openpgp.js).


## Node version management (recommended)
Node should be managed with a per-user version manager so project contributors can run the same Node LTS version.

We standardize on nvm (Node Version Manager) for this project.

- Install nvm:
  - Run: `curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.4/install.sh | bash`
  - After install, either open a new shell or activate in the current shell:
    - `export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"`

- Verify nvm: `nvm --version`

- Install and use the Node LTS for development:
  - `nvm install --lts`
  - `nvm use --lts`

- Pin the project Node version for contributors using an `.nvmrc` file in the repository root:
  - Example: create `.nvmrc` containing the exact version string, e.g. `v18.20.0` or `lts` after you've installed it: `node -v > .nvmrc` (edit to keep only the version)
  - Contributors can run `nvm use` in the repo to automatically switch to the pinned version.

- Auto-load nvm in interactive shells (recommended): add the activation line to your shell profile (`~/.bashrc`, `~/.profile`, or `~/.zshrc`), for example:
  - `export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"`

Note: If you earlier wrote "LVM", that likely referred to Linux Logical Volume Manager — use nvm for Node version management.


## Foundry (Solidity)
Install and verify Foundry:
- Install: `curl -L https://foundry.paradigm.xyz | bash` then restart shell or source `~/.bashrc` and run `foundryup` to update.
- Verify: `forge --version` and `anvil --version`.
- Run contract tests: `cd contracts && forge test` (acceptance: tests pass).

Notes:
- Foundry requires Rust; if `forge` complains, run `rustup install stable` and retry.


## TypeScript SDK & CLI verification
For each TypeScript package (sdk, cli):
- Install dependencies: `cd sdk && npm ci` (or `npm install` if not using lockfile).
- Type-check: `cd sdk && npx tsc --noEmit` (acceptance: zero type errors).
- Run unit tests: `cd sdk && npx jest --runInBand` (acceptance: test suite passes).

For the CLI, after building the TS code (`npx tsc -p tsconfig.json`) verify the binary/help output: `node dist/cli.js --help`.


## OpenPGP (openpgp.ts) validation
Create and run a small verification script that:
- Generates an ephemeral keypair.
- Encrypts and decrypts a short message.
- Signs and verifies the message signature.

This proves that WebCrypto is available and openpgp.ts works in your Node environment.

Example workflow (manual steps):
1. `mkdir -p tmp && cd tmp`
2. `npm init -y && npm install openpgp` (local temporary install)
3. Create `openpgp-check.js` (use the sample in this repo's documentation or the official openpgp docs).
4. Run: `node openpgp-check.js` — acceptance: prints "round-trip success" and "signature verified".


## Viem & Web3 sanity checks
- Connect to a local node (anvil) or public testnet using Viem and verify basic RPC calls.
- Minimal checks: read `chainId` and `blockNumber`, create and sign a simple transaction to `anvil` and wait for receipt.

Suggested quick test (create a short script in `tmp/viem-check.js` and run after installing `viem`):
- `npm install viem @wagmi/core` (local temporary install)
- Run the script and confirm a numeric chainId and blockNumber are returned.


## Frontends (WAGMI + RainbowKit + Viem)
- For each frontend app: `cd frontends/<app> && npm ci` then `npm run dev`.
- Acceptance: dev server starts and UI loads at http://localhost:PORT.
- Wallet integration: confirm a demo wallet connection (manual or Playwright automation).


## End-to-end testing (Playwright)
- Install browsers: `npx playwright install`.
- Run e2e: `npx playwright test --config=playwright.config.ts` (acceptance: basic flows pass).


## CI checklist
CI pipelines should run the following as gating checks:
- `forge test` (contracts)
- `npx tsc --noEmit` (type-check)
- `npx jest` (unit tests)
- `npx playwright install && npx playwright test` (optional e2e)


## Quick verification checklist (single-line commands you can run now)
- Node and npm: `node -v && npm -v`
- Node version manager (locally): `command -v nvm || command -v volta`
- Foundry: `forge --version` and `anvil --version`
- Rust: `rustc --version`
- TypeScript: `tsc --version`
- Git: `git --version`


## Acceptance criteria summary
- `forge test` passes for the `contracts/` suite.
- `npx tsc --noEmit` returns no errors for `sdk/` and `cli/`.
- `npx jest` passes for all TS unit tests.
- OpenPGP sample script encrypts/decrypts and signs/verifies successfully.
- Viem test script can read chain info from the local node and send a tx.


---

If you want I can now run the quick verification commands in this environment to report which components are already installed. Confirm whether you meant `nvm`/`volta` (recommended) or truly meant `LVM` (logical volume manager).