import { web3pgpServiceManager } from '../services/web3pgpService'

/**
 * Hook to access the Web3PGPService instance
 * Can be used in components to interact with Web3PGP
 * Must be used within a component wrapped by Web3PGPProvider
 */
export const useWeb3PGPService = () => {
  if (!web3pgpServiceManager.isInitialized()) {
    throw new Error('Web3PGPService not initialized. Make sure you are using useWeb3PGPService within Web3PGPProvider')
  }

  return web3pgpServiceManager.getWeb3PGPService()
}
