import { useWeb3PGPStatus } from '../contexts/Web3PGPContext'
import { web3pgpServiceManager } from '../services/web3pgpService'
import { Web3PGPService } from '@jibidieuw/dexes'

interface UseWeb3PGPServiceReadyReturn {
  service: Web3PGPService | null
  isReady: boolean
  isLoading: boolean
  error: Error | null
}

/**
 * Hook to safely access Web3PGPService with automatic initialization handling
 * Unlike useWeb3PGPService, this returns null if service is not ready instead of throwing
 * This prevents runtime errors when navigating directly to routes or refreshing pages
 *
 * @returns Object with service (or null), readiness state, loading state, and any errors
 */
export const useWeb3PGPServiceReady = (): UseWeb3PGPServiceReadyReturn => {
  const { isInitialized, isLoading, error } = useWeb3PGPStatus()

  const service = isInitialized ? web3pgpServiceManager.getWeb3PGPService() : null

  return {
    service,
    isReady: isInitialized,
    isLoading,
    error,
  }
}
