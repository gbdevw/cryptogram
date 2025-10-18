---
applyTo: '**'
---

# Cryptogram Project - AI Coding Assistant Guidelines

## Project Overview
We are creating a PKI (Public Key Infrastructure) and EDI (Electronic Data Interchange) system on Ethereum, utilizing OpenPGP for cryptographic operations. This project enables secure, decentralized document exchange and identity management through blockchain technology.

## Technical Stack
- **Smart Contracts**: Foundry, Solidity
- **Languages/Libraries**: TypeScript, OpenPGP (openpgp.ts), Viem (Web3 integration)
- **Frontend**: WAGMI + Rainbow Kit + Viem + TypeScript
- **CLI/SDK**: TypeScript-based CLI and SDK
- **Testing Frameworks**:
  - Solidity: Foundry Forge
  - TypeScript (SDK/CLI): Jest
  - Frontend: Jest with React Testing Library; Playwright for e2e
- **Package Management**: NPM

## Project Structure
- `.github/instructions/`: Contains this Copilot prompt and other AI guidelines
- `specifications/`: Markdown files with requirements, specifications, and coding plans
- `documentation/`: Project documentation in Markdown format
- `contracts/`: Foundry project containing Solidity smart contracts
- `sdks/`: Directory for SDKs in multiple languages
  - `sdks/typescript/`: TypeScript library used by frontends and CLIs
- `clis/`: Directory containing one or more TypeScript CLIs that utilize the SDK
- `frontends/`: Multiple frontend applications
- `tmp/`: Local temporary folder containing temporary files like summaries, decision logs, reports, etc. (ignored by git)

## Coding Conventions and Guidelines

### Language and Communication
- Always write code and documentation in English
- No emoticons in code comments or commit messages
- Use clear, descriptive variable and function names
- Prefer TypeScript over JavaScript for all new code

### Code Style
- Follow standard TypeScript/JavaScript formatting (use Prettier if configured)
- Use ESLint for linting
- Maintain consistent indentation (2 spaces preferred)
- Add JSDoc comments for public APIs and complex functions

### Solidity Best Practices
- Follow Solidity style guide
- Use NatSpec comments for all public functions
- Implement proper access controls
- Gas optimization considerations
- Comprehensive testing with Foundry

### Security Considerations
- OpenPGP operations must be handled securely
- Ethereum transactions require proper error handling
- Validate all inputs and outputs
- Use established libraries for cryptographic operations

### Development Workflow
- Reference specifications in `specifications/` for requirements
- Update documentation in `documentation/` as needed
- Write tests for all new functionality
- Use meaningful commit messages

When generating code, ensure it aligns with this project's architecture and follows the specified technical stack. Always consider the decentralized, cryptographic nature of the application.
