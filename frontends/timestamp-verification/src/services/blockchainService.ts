import { PublicClient } from 'viem'
import { Web3Sign, Web3PGP, Web3PGPService, Web3SignService } from '@cryptogram/dexes'
import { getCurrentChainConfig } from '../config/chains'

/**
 * Manages the initialization of blockchain clients and services
 */
class BlockchainServiceManager {
  private web3Sign: Web3Sign | null = null
  private web3PGP: Web3PGP | null = null
  private web3PGPService: Web3PGPService | null = null
  private web3SignService: Web3SignService | null = null

  /**
   * Initialize all services based on publicClient
   */
  async initialize(publicClient: PublicClient): Promise<void> {
    try {
      // Step 1: Get contract addresses
      const chainConfig = getCurrentChainConfig()
      const web3SignAddress = chainConfig.web3signContractAddress as `0x${string}`

      // Step 2: Create Web3PGP client first (low level, needed by Web3Sign)
      // Get the Web3PGP address from Web3Sign
      const tempWeb3Sign = new Web3Sign(
        web3SignAddress,
        undefined as any,
        publicClient as any
      )
      const web3PGPAddress = await tempWeb3Sign.getWeb3PGPAddress()

      // Step 3: Create Web3PGP client with correct address
      this.web3PGP = new Web3PGP(
        web3PGPAddress as `0x${string}`,
        publicClient as any
      )

      // Step 4: Create Web3Sign client with both address and Web3PGP
      this.web3Sign = new Web3Sign(
        web3SignAddress,
        this.web3PGP as any,
        publicClient as any
      )

      // Step 5: Create Web3PGP service (high level)
      this.web3PGPService = new Web3PGPService(this.web3PGP as any)

      // Step 6: Create Web3Sign service (high level)
      this.web3SignService = new Web3SignService(
        this.web3Sign as any,
        this.web3PGPService as any
      )

      console.log('Blockchain services initialized successfully')
    } catch (error) {
      console.error('Failed to initialize blockchain services:', error)
      throw error
    }
  }

  /**
   * Get Web3SignService (high level)
   */
  getWeb3SignService(): Web3SignService {
    if (!this.web3SignService) {
      throw new Error('Web3SignService not initialized')
    }
    return this.web3SignService
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
      this.web3SignService !== null &&
      this.web3PGPService !== null
    )
  }

  /**
   * Reset all services (useful for testing)
   */
  reset(): void {
    this.web3Sign = null
    this.web3PGP = null
    this.web3PGPService = null
    this.web3SignService = null
  }
}

export const blockchainServiceManager = new BlockchainServiceManager()
