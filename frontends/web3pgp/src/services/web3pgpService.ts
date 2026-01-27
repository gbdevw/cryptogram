import { PublicClient, WalletClient } from 'viem'
import { Web3PGP, Web3PGPService } from '@jibidieuw/dexes'
import { getCurrentChainConfig } from '../config/chains'

/**
 * Manages the initialization of Web3PGP client and service
 * Supports wallet client for signing transactions
 */
class Web3PGPServiceManager {
  private web3PGP: Web3PGP | null = null
  private web3PGPService: Web3PGPService | null = null
  private publicClient: PublicClient | null = null
  private walletClient: WalletClient | null = null

  /**
   * Initialize Web3PGP service based on publicClient
   */
  async initialize(publicClient: PublicClient): Promise<void> {
    try {
      // Step 1: Get contract address
      const chainConfig = getCurrentChainConfig()
      const web3pgpAddress = chainConfig.web3pgpContractAddress as `0x${string}`

      if (!web3pgpAddress || web3pgpAddress === '') {
        throw new Error(`Web3PGP contract address not configured for this chain`)
      }

      // Step 2: Create Web3PGP client
      this.web3PGP = new Web3PGP(web3pgpAddress, publicClient as any)

      // Step 3: Create Web3PGP service
      this.web3PGPService = new Web3PGPService(this.web3PGP as any)

      // Store public client
      this.publicClient = publicClient

      console.log('Web3PGP service initialized successfully')
    } catch (error) {
      console.error('Failed to initialize Web3PGP service:', error)
      throw error
    }
  }

  /**
   * Set or update the wallet client for signing transactions
   * Call this when user connects a wallet or changes the connected chain
   */
  setWalletClient(walletClient: WalletClient | null): void {
    try {
      this.walletClient = walletClient

      if (walletClient && this.web3PGP) {
        // Update the Web3PGP instance with the wallet client
        this.web3PGP.walletClient = walletClient
        console.log('Web3PGP wallet client updated successfully')
      } else if (!walletClient && this.web3PGP) {
        // Clear the wallet client
        this.web3PGP.walletClient = undefined
        console.log('Web3PGP wallet client cleared')
      }
    } catch (error) {
      console.error('Failed to set wallet client:', error)
      throw error
    }
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
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.web3PGPService !== null
  }

  /**
   * Check if wallet client is connected
   */
  isWalletConnected(): boolean {
    return this.walletClient !== null
  }

  /**
   * Reset all services (useful for testing or chain switches)
   */
  reset(): void {
    this.web3PGP = null
    this.web3PGPService = null
    this.publicClient = null
    this.walletClient = null
  }
}

export const web3pgpServiceManager = new Web3PGPServiceManager()
