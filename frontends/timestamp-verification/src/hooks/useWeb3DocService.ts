import { Web3DocService } from '@cryptogram/dexes'
import { blockchainServiceManager } from '../services/blockchainService'
import { useBlockchainServiceStatus } from '../contexts/BlockchainServiceContext'

/**
 * Hook to access Web3DocService
 * Ensures services are initialized before use
 */
export const useWeb3DocService = (): Web3DocService | null => {
  const { isInitialized, error } = useBlockchainServiceStatus()

  if (error) {
    throw error
  }

  if (!isInitialized) {
    return null
  }

  return blockchainServiceManager.getWeb3DocService()
}
