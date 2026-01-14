import { createContext, useContext, ReactNode, useEffect, useState } from 'react'
import { usePublicClient } from 'wagmi'
import { blockchainServiceManager } from '../services/blockchainService'

interface BlockchainServiceContextType {
  isInitialized: boolean
  isLoading: boolean
  error: Error | null
}

const BlockchainServiceContext = createContext<BlockchainServiceContextType | undefined>(undefined)

/**
 * Provider that manages blockchain service initialization and updates
 */
export const BlockchainServiceProvider = ({ children }: { children: ReactNode }) => {
  const publicClientWagmi = usePublicClient()
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const initializeServices = async () => {
      if (!publicClientWagmi) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        if (!blockchainServiceManager.isInitialized()) {
          // First initialization
          await blockchainServiceManager.initialize(publicClientWagmi as any)
        } else {
          // Update existing services
          blockchainServiceManager.updatePublicClient(publicClientWagmi as any)
        }

        setIsInitialized(true)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        console.error('Failed to initialize blockchain services:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeServices()
  }, [publicClientWagmi])

  return (
    <BlockchainServiceContext.Provider value={{ isInitialized, isLoading, error }}>
      {children}
    </BlockchainServiceContext.Provider>
  )
}

/**
 * Hook to check blockchain service initialization status
 */
export const useBlockchainServiceStatus = () => {
  const context = useContext(BlockchainServiceContext)
  if (!context) {
    throw new Error('useBlockchainServiceStatus must be used within BlockchainServiceProvider')
  }
  return context
}
