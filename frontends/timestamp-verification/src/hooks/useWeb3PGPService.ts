import { Web3PGPService } from '@cryptogram/dexes'
import { blockchainServiceManager } from '../services/blockchainService'
import { useBlockchainServiceStatus } from '../contexts/BlockchainServiceContext'

/**
 * Hook to access Web3PGPService
 * Ensures services are initialized before use
 */
export const useWeb3PGPService = (): Web3PGPService | null => {
  const { isInitialized, error } = useBlockchainServiceStatus()

  if (error) {
    throw error
  }

  if (!isInitialized) {
    return null
  }

  return blockchainServiceManager.getWeb3PGPService()
}
