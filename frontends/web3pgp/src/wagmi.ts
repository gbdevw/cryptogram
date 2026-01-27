import { createConfig, http } from 'wagmi'
import { ink, inkSepolia } from 'wagmi/chains'
import { fallback } from 'viem'
import { getConfiguredChain } from './config/chains'

const configuredChain = getConfiguredChain()
const chains = configuredChain === 'ink' ? [ink] as const : [inkSepolia] as const

const batchConfig = { batchSize: 100, wait: 50 }

const createFallbackTransport = (isMainnet: boolean) =>
  fallback(
    [
      // 1. Gelato (Primary)
      http(
        isMainnet
          ? 'https://rpc-gel.inkonchain.com'
          : 'https://rpc-gel-sepolia.inkonchain.com',
        { batch: batchConfig }
      ),

      // 2. Tenderly (Backup 1)
      http(
        isMainnet
          ? 'https://rpc-ten.inkonchain.com'
          : 'https://rpc-ten-sepolia.inkonchain.com',
        { batch: batchConfig }
      ),

      // 3. QuickNode (Backup 2)
      http(
        isMainnet
          ? 'https://rpc-qnd.inkonchain.com'
          : 'https://rpc-qnd-sepolia.inkonchain.com',
        { batch: batchConfig }
      ),

      // 4. dRPC (Backup 3 - with stricter batch settings for safety)
      http(
        isMainnet ? 'https://ink.drpc.org' : 'https://ink-sepolia.drpc.org',
        { batch: { batchSize: 50, wait: 50 } }
      ),
    ],
    {
      // rank: false (default) - Use simple round-robin without continuous health checks
      // This prevents unnecessary net_listening calls
      retryCount: 3,
      retryDelay: 500,
    }
  )

export const config = createConfig({
  chains,
  transports: {
    [ink.id]: createFallbackTransport(true),
    [inkSepolia.id]: createFallbackTransport(false),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
