import { PublicClient } from 'viem'
import { Web3Doc, Web3PGP, Web3PGPService, Web3DocService } from '@cryptogram/dexes'
import { getCurrentChainConfig } from '../config/chains'

/**
 * Manages the cascade initialization of blockchain clients and services
 * Handles updates when publicClient changes
 */
class BlockchainServiceManager {
  private web3Doc: Web3Doc | null = null
  private web3PGP: Web3PGP | null = null
  private web3PGPService: Web3PGPService | null = null
  private web3DocService: Web3DocService | null = null

  /**
   * Initialize all services based on publicClient
   * Call this when publicClient is available or changes
   */
  async initialize(publicClient: PublicClient): Promise<void> {
    try {
      // Step 1: Get contract addresses
      const chainConfig = getCurrentChainConfig()
      const web3DocAddress = chainConfig.web3docContractAddress as `0x${string}`

      // Step 2: Create Web3PGP client first (low level, needed by Web3Doc)
      // Note: We'll get the Web3PGP address from Web3Doc after creating it
      // For now, create a temporary Web3Doc to get the Web3PGP address
      const tempWeb3Doc = new Web3Doc(
        web3DocAddress,
        undefined as any, // Temporary, will be replaced
        publicClient as any
      )
      const web3PGPAddress = await tempWeb3Doc.getWeb3PGPAddress()

      // Step 3: Create Web3PGP client with correct address
      this.web3PGP = new Web3PGP(
        web3PGPAddress as `0x${string}`,
        publicClient as any
      )

      // Step 4: Create Web3Doc client with both address and Web3PGP
      this.web3Doc = new Web3Doc(
        web3DocAddress,
        this.web3PGP as any,
        publicClient as any
      )

      // Step 5: Create Web3PGP service (high level)
      this.web3PGPService = new Web3PGPService(this.web3PGP as any)

      // Step 6: Create Web3Doc service (high level)
      this.web3DocService = new Web3DocService(
        this.web3Doc as any,
        this.web3PGPService as any
      )

      console.log('Blockchain services initialized successfully')
    } catch (error) {
      console.error('Failed to initialize blockchain services:', error)
      throw error
    }
  }

  /**
   * Update publicClient in all clients (when WAGMI client changes)
   */
  updatePublicClient(publicClient: PublicClient): void {
    if (!this.web3Doc || !this.web3PGP || !this.web3DocService) {
      throw new Error('Services not initialized. Call initialize() first.')
    }

    this.web3Doc.client = publicClient as any
    this.web3PGP.client = publicClient as any

    console.log('Public client updated in all services')
  }

  /**
   * Get Web3DocService (high level)
   */
  getWeb3DocService(): Web3DocService {
    if (!this.web3DocService) {
      throw new Error('Web3DocService not initialized')
    }
    return this.web3DocService
  }

  /**
   * Get Web3PGPService (high level)
   */
  getWeb3PGPService(): Web3PGPService {
    if (!this.web3PGPService) {
      throw new Error('Web3PGPService not initialized')
    }
    return this.web3PGPService
  }

  /**
   * Check if services are initialized
   */
  isInitialized(): boolean {
    return (
      this.web3DocService !== null &&
      this.web3PGPService !== null
    )
  }

  /**
   * Reset all services (useful for testing or chain switching)
   */
  reset(): void {
    this.web3Doc = null
    this.web3PGP = null
    this.web3PGPService = null
    this.web3DocService = null
  }
}

export const blockchainServiceManager = new BlockchainServiceManager()
