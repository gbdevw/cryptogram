import { createContext, useContext, ReactNode, useEffect, useState } from 'react'
import { getPublicClient } from 'wagmi/actions'
import { config } from '../wagmi'
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
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const initializeServices = async () => {
      try {
        console.log('BlockchainServiceProvider: Starting initialization')
        setIsLoading(true)
        setError(null)

        // Get public client from WAGMI config
        const publicClient = getPublicClient(config)
        console.log('BlockchainServiceProvider: Public client obtained from WAGMI:', publicClient)

        if (!publicClient) {
          throw new Error('Failed to get public client from WAGMI config')
        }

        if (!blockchainServiceManager.isInitialized()) {
          // First initialization
          console.log('BlockchainServiceProvider: First initialization, calling blockchainServiceManager.initialize()')
          await blockchainServiceManager.initialize(publicClient as any)
          console.log('BlockchainServiceProvider: Initialization completed successfully')
        }

        setIsInitialized(true)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        console.error('BlockchainServiceProvider: Failed to initialize blockchain services:', error)
        console.error('BlockchainServiceProvider: Error stack:', error.stack)
      } finally {
        setIsLoading(false)
      }
    }

    initializeServices()
  }, [])

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
