export const CHAIN_CONFIG = {
  inkSepolia: {
    id: 'inkSepolia',
    // Web3PGP contract address for key management and verification
    web3pgpContractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_INK_SEPOLIA || '0x72d02B94317ac899B34459a4e6685eFe12Ac17a8',
  },
  ink: {
    id: 'ink',
    web3pgpContractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_INK || '', // TODO: Migrate to scroll + update address
  },
} as const

export type SupportedChain = keyof typeof CHAIN_CONFIG

// Use an environment variable to determine the configured chain
export const getConfiguredChain = (): SupportedChain => {
  const chain = process.env.NEXT_PUBLIC_CHAIN || 'inkSepolia'
  if (chain !== 'inkSepolia' && chain !== 'ink') {
    throw new Error(`Unsupported chain: ${chain}`)
  }
  return chain
}

export const getCurrentChainConfig = () => {
  const chain = getConfiguredChain()
  return CHAIN_CONFIG[chain]
}
