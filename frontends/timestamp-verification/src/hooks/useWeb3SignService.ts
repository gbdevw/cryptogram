import { Web3SignService } from '@cryptogram/dexes'
import { blockchainServiceManager } from '../services/blockchainService'
import { useBlockchainServiceStatus } from '../contexts/BlockchainServiceContext'

/**
 * Hook to access Web3SignService
 * Ensures services are initialized before use
 */
export const useWeb3SignService = (): Web3SignService | null => {
  const { isInitialized, error } = useBlockchainServiceStatus()

  if (error) {
    throw error
  }

  if (!isInitialized) {
    return null
  }

  return blockchainServiceManager.getWeb3SignService()
}
