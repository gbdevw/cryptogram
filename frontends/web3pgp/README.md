This is a [RainbowKit](https://rainbowkit.com) + [wagmi](https://wagmi.sh) + [Next.js](https://nextjs.org/) project bootstrapped with [`create-rainbowkit`](/packages/create-rainbowkit).

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

## Configuration

### Supported Networks

The Web3PGP frontend supports the following test networks:

- **Sepolia** (Default)
  - Chain ID: 11155111
  - Web3PGP Contract: `0xDa63568866C8eB53627a5CCF27DaB76061538dB1`
  - Environment Variable: `NEXT_PUBLIC_CHAIN=sepolia`

- **Scroll Sepolia**
  - Chain ID: 534351
  - Web3PGP Contract: `0xDa63568866C8eB53627a5CCF27DaB76061538dB1`
  - Environment Variable: `NEXT_PUBLIC_CHAIN=scrollSepolia`

### Environment Variables

Create a `.env.local` file with the following variables (optional, defaults provided):

```bash
# Network selection (default: sepolia)
NEXT_PUBLIC_CHAIN=sepolia

# Contract addresses (optional overrides)
NEXT_PUBLIC_CONTRACT_ADDRESS_SEPOLIA=0xDa63568866C8eB53627a5CCF27DaB76061538dB1
NEXT_PUBLIC_CONTRACT_ADDRESS_SCROLL_SEPOLIA=0xDa63568866C8eB53627a5CCF27DaB76061538dB1
```

### Network Switching

Users can switch between available networks using the network switcher button in the header (next to the wallet connection button). The selected network preference is saved to browser localStorage.

## Learn More

To learn more about this stack, take a look at the following resources:

- [RainbowKit Documentation](https://rainbowkit.com) - Learn how to customize your wallet connection flow.
- [wagmi Documentation](https://wagmi.sh) - Learn how to interact with Ethereum.
- [Next.js Documentation](https://nextjs.org/docs) - Learn how to build a Next.js application.

You can check out [the RainbowKit GitHub repository](https://github.com/rainbow-me/rainbowkit) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
