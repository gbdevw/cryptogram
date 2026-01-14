import { Web3DocService } from '@cryptogram/dexes'
import { blockchainServiceManager } from '../services/blockchainService'
import { useBlockchainServiceStatus } from '../contexts/BlockchainServiceContext'

/**
 * Hook to access Web3DocService
 * Ensures services are initialized before use
 */
export const useWeb3DocService = (): Web3DocService => {
  const { isInitialized, isLoading, error } = useBlockchainServiceStatus()

  if (isLoading) {
    throw new Promise(() => {}) // Suspend rendering while loading
  }

  if (error) {
    throw error
  }

  if (!isInitialized) {
    throw new Error('Blockchain services not initialized')
  }

  return blockchainServiceManager.getWeb3DocService()
}
