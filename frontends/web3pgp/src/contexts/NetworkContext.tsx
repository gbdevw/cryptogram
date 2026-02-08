import { ReactNode, createContext, useContext, useState, useEffect } from 'react'
import { useChainModal } from '@rainbow-me/rainbowkit'
import { useChainId } from 'wagmi'
import { SupportedChain, CHAIN_CONFIG } from '../config/chains'

interface NetworkContextType {
  currentChain: SupportedChain
  switchChain: (chain: SupportedChain) => Promise<void>
  availableChains: Array<{ id: SupportedChain; displayName: string }>
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined)

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [currentChain, setCurrentChain] = useState<SupportedChain>('sepolia')
  const [isClient, setIsClient] = useState(false)
  const { openChainModal } = useChainModal()
  const chainId = useChainId()

  useEffect(() => {
    setIsClient(true)
    // Load from localStorage if available
    const saved = localStorage.getItem('web3pgp-chain')
    if (saved && (saved === 'sepolia' || saved === 'scrollSepolia')) {
      setCurrentChain(saved as SupportedChain)
    }
  }, [])

  // Sync currentChain with the wallet's active chain when it changes
  useEffect(() => {
    if (chainId && isClient) {
      if (chainId === 11155111) {
        setCurrentChain('sepolia')
      } else if (chainId === 534351) {
        setCurrentChain('scrollSepolia')
      }
    }
  }, [chainId, isClient])

  const switchChain = async (chain: SupportedChain) => {
    try {
      setCurrentChain(chain)
      if (isClient) {
        localStorage.setItem('web3pgp-chain', chain)
      }
      
      // Open the chain modal to let the user switch networks
      if (openChainModal) {
        openChainModal()
      }
    } catch (error) {
      console.error('Failed to switch chain:', error)
      throw error
    }
  }

  const availableChains = Object.entries(CHAIN_CONFIG).map(([id, config]) => ({
    id: id as SupportedChain,
    displayName: config.displayName,
  }))

  return (
    <NetworkContext.Provider value={{ currentChain, switchChain, availableChains }}>
      {children}
    </NetworkContext.Provider>
  )
}

export function useNetwork() {
  const context = useContext(NetworkContext)
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider')
  }
  return context
}
