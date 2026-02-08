import { createConfig, http } from 'wagmi'
import { sepolia as sepoliaChain } from 'wagmi/chains'
import { defineChain } from 'viem'
import { fallback } from 'viem'

// Customize Sepolia with [DEMO] prefix
const sepolia = {
  ...sepoliaChain,
  name: '[DEMO] Sepolia',
}

// Define Scroll Sepolia chain with [DEMO] prefix
const scrollSepolia = defineChain({
  id: 534351,
  name: '[DEMO] Scroll Sepolia',
  network: 'scroll-sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'ETH',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://sepolia-rpc.scroll.io'],
    },
    public: {
      http: ['https://sepolia-rpc.scroll.io'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Scroll Sepolia Blockscout',
      url: 'https://sepolia-blockscout.scroll.io',
    },
  },
  testnet: true,
})

// Support both chains so wallet can switch between them
const chains = [sepolia, scrollSepolia] as const

const batchConfig = { batchSize: 20, wait: 150 }

const createSepoliaTransport = () =>
  fallback(
    [
      http('https://ethereum-sepolia-rpc.publicnode.com', { batch: batchConfig }),
      http('https://rpc2.sepolia.org', { batch: batchConfig }),
      http('https://gateway.tenderly.co/public/sepolia', { batch: batchConfig }),
    ],
    {
      retryCount: 3,
      retryDelay: 500,
    }
  )

const createScrollSepoliaTransport = () =>
  fallback(
    [
      http('https://scroll-sepolia-rpc.publicnode.com', { batch: batchConfig }),
      http('https://sepolia-rpc.scroll.io/', { batch: batchConfig }),
      http('https://scroll-sepolia.drpc.org', { batch: batchConfig }),
    ],
    {
      retryCount: 3,
      retryDelay: 500,
    }
  )

export const config = createConfig({
  chains,
  transports: {
    [sepolia.id]: createSepoliaTransport(),
    [scrollSepolia.id]: createScrollSepoliaTransport(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
