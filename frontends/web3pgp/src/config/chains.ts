export const CHAIN_CONFIG = {
  sepolia: {
    id: 'sepolia',
    chainId: 11155111,
    displayName: '[DEMO] Sepolia',
    // Web3PGP contract address for key management and verification
    web3pgpContractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_SEPOLIA || '0x82733B49e65A2FE6B611e5CE454AC21237071638',
  },
  scrollSepolia: {
    id: 'scrollSepolia',
    chainId: 534351,
    displayName: '[DEMO] Scroll Sepolia',
    web3pgpContractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_SCROLL_SEPOLIA || '0xDa63568866C8eB53627a5CCF27DaB76061538dB1',
  },
} as const

export type SupportedChain = keyof typeof CHAIN_CONFIG

// Use an environment variable to determine the configured chain
export const getConfiguredChain = (): SupportedChain => {
  const chain = process.env.NEXT_PUBLIC_CHAIN || 'sepolia'
  if (chain !== 'sepolia' && chain !== 'scrollSepolia') {
    throw new Error(`Unsupported chain: ${chain}`)
  }
  return chain
}

export const getCurrentChainConfig = () => {
  const chain = getConfiguredChain()
  return CHAIN_CONFIG[chain]
}
