import { createContext, useContext, ReactNode, useEffect, useState } from 'react'
import { usePublicClient, useWalletClient } from 'wagmi'
import { web3pgpServiceManager } from '../services/web3pgpService'

interface Web3PGPContextType {
  isInitialized: boolean
  isLoading: boolean
  isWalletConnected: boolean
  error: Error | null
}

const Web3PGPContext = createContext<Web3PGPContextType | undefined>(undefined)

/**
 * Provider that manages Web3PGP service initialization and wallet updates
 * Automatically sets wallet client when user connects or changes chain
 */
export const Web3PGPProvider = ({ children }: { children: ReactNode }) => {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isWalletConnected, setIsWalletConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Get public client from WAGMI
  const publicClient = usePublicClient()

  // Get wallet client from WAGMI (automatically updates when wallet connects/disconnects)
  const { data: walletClient } = useWalletClient()

  // Initialize service on mount with public client
  useEffect(() => {
    const initializeService = async () => {
      try {
        console.log('Web3PGPProvider: Starting initialization')
        setIsLoading(true)
        setError(null)

        if (!publicClient) {
          throw new Error('Failed to get public client from WAGMI')
        }

        if (!web3pgpServiceManager.isInitialized()) {
          console.log('Web3PGPProvider: Initializing Web3PGP service')
          await web3pgpServiceManager.initialize(publicClient as any)
          console.log('Web3PGPProvider: Initialization completed successfully')
        }

        setIsInitialized(true)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        console.error('Web3PGPProvider: Failed to initialize Web3PGP service:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (publicClient) {
      initializeService()
    }
  }, [publicClient])

  // Update wallet client whenever it changes (user connects/disconnects wallet or switches chain)
  useEffect(() => {
    if (isInitialized) {
      try {
        if (walletClient) {
          console.log('Web3PGPProvider: Wallet connected, updating service with wallet client')
          web3pgpServiceManager.setWalletClient(walletClient as any)
          setIsWalletConnected(true)
        } else {
          console.log('Web3PGPProvider: Wallet disconnected, clearing wallet client from service')
          web3pgpServiceManager.setWalletClient(null)
          setIsWalletConnected(false)
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        console.error('Web3PGPProvider: Failed to update wallet client:', error)
      }
    }
  }, [walletClient, isInitialized])

  return (
    <Web3PGPContext.Provider value={{ isInitialized, isLoading, isWalletConnected, error }}>
      {children}
    </Web3PGPContext.Provider>
  )
}

/**
 * Hook to check Web3PGP service initialization and wallet status
 */
export const useWeb3PGPStatus = () => {
  const context = useContext(Web3PGPContext)
  if (!context) {
    throw new Error('useWeb3PGPStatus must be used within Web3PGPProvider')
  }
  return context
}
