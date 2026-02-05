export const CHAIN_CONFIG = {
  inkSepolia: {
    id: 'inkSepolia',
    // We only need Web3Sign contract address for timestamp verification
    // Web3Sign contract has a "getWeb3PGPAddress" method to get the address of the Web3PGP contract the Web3Sign contract interacts with
    // to verify key existence.
    web3signContractAddress: import.meta.env.REACT_APP_CONTRACT_ADDRESS_INK_SEPOLIA || '0x5C09E831276ADCec4D5C94645F34500D3deA8E8A',
  },
  ink: {
    id: 'ink',
    web3signContractAddress: import.meta.env.REACT_APP_CONTRACT_ADDRESS_INK || '',
  },
} as const

export type SupportedChain = keyof typeof CHAIN_CONFIG

// Use an environment variable to determine the configured chain
export const getConfiguredChain = (): SupportedChain => {
  const chain = import.meta.env.REACT_APP_CHAIN || 'inkSepolia'
  if (chain !== 'inkSepolia' && chain !== 'ink') {
    throw new Error(`Unsupported chain: ${chain}`)
  }
  return chain
}

export const getCurrentChainConfig = () => {
  const chain = getConfiguredChain()
  return CHAIN_CONFIG[chain]
}