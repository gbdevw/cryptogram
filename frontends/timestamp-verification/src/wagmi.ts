import { createConfig, http } from 'wagmi'
import { ink, inkSepolia } from 'wagmi/chains'
import { getConfiguredChain } from './config/chains'

const configuredChain = getConfiguredChain()
const chains = configuredChain === 'ink' ? [ink] as const : [inkSepolia] as const

export const config = createConfig({
  chains,
  transports: {
    [ink.id]: http(),
    [inkSepolia.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}