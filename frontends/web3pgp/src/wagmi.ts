import { createConfig, http } from 'wagmi'
import { sepolia as sepoliaChain } from 'wagmi/chains'
import { defineChain } from 'viem'
import { fallback } from 'viem'

// Customize Sepolia with [DEMO] prefix
const sepolia = {
  ...sepoliaChain,
  name: '[DEMO] Sepolia',
}

// Define Scroll Mainnet chain
const scroll = defineChain({
  id: 534352,
  name: 'Scroll',
  network: 'scroll',
  nativeCurrency: {
    decimals: 18,
    name: 'ETH',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.scroll.io'],
    },
    public: {
      http: ['https://rpc.scroll.io'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Scrollscan',
      url: 'https://scrollscan.com',
    },
  },
  testnet: false,
})

// Support both chains so wallet can switch between them
const chains = [sepolia, scroll] as const

const sepoliaBatchConfig = { batchSize: 20, wait: 100 }
const scrollBatchConfig = { batchSize: 20, wait: 150 }

const createSepoliaTransport = () =>
  fallback(
    [
      http('https://ethereum-sepolia-rpc.publicnode.com', { batch: sepoliaBatchConfig }),
      http('https://sepolia.gateway.tenderly.co', { batch: sepoliaBatchConfig }),
      http('https://sepolia.drpc.org', { batch: sepoliaBatchConfig }),
      http('https://1rpc.io/sepolia', { batch: sepoliaBatchConfig }),
    ],
    {
      retryCount: 3,
      retryDelay: 500,
    }
  )

const createScrollTransport = () =>
  fallback(
    [
      http('https://rpc.scroll.io', { batch: scrollBatchConfig }),
      http('https://1rpc.io/scroll', { batch: scrollBatchConfig }),
      http('https://scroll-rpc.publicnode.com', { batch: scrollBatchConfig }),
      http('https://scroll.drpc.org', { batch: scrollBatchConfig }),
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
    [scroll.id]: createScrollTransport(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
