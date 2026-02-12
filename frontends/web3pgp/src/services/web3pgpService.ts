import { PublicClient, WalletClient } from 'viem'
import { Web3PGP, Web3PGPService } from '@jibidieuw/dexes'
import { CHAIN_CONFIG } from '../config/chains'

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
   * Get Web3PGP contract address based on chain ID from public client
   */
  private getContractAddressForChain(chainId: number): string {
    // Find the chain config by chainId
    const chainEntry = Object.entries(CHAIN_CONFIG).find(
      ([_, config]) => config.chainId === chainId
    )

    if (!chainEntry) {
      throw new Error(`No configuration found for chain ID: ${chainId}`)
    }

    const contractAddress = chainEntry[1].web3pgpContractAddress
    if (!contractAddress || contractAddress.length === 0) {
      throw new Error(`Web3PGP contract address not configured for chain ID: ${chainId}`)
    }

    return contractAddress
  }

  /**
   * Initialize Web3PGP service based on publicClient
   */
  async initialize(publicClient: PublicClient): Promise<void> {
    try {
      // Get contract address based on the actual chain ID from public client
      const chainId = publicClient.chain?.id
      if (!chainId) {
        throw new Error('Unable to determine chain ID from public client')
      }

      const web3pgpAddress = this.getContractAddressForChain(chainId) as `0x${string}`

      // Step 2: Create Web3PGP client
      this.web3PGP = new Web3PGP(web3pgpAddress, publicClient as any)

      // Step 3: Create Web3PGP service
      this.web3PGPService = new Web3PGPService(this.web3PGP as any)

      // Store public client
      this.publicClient = publicClient

      console.log(`Web3PGP service initialized for chain ${chainId} with contract ${web3pgpAddress}`)
    } catch (error) {
      console.error('Failed to initialize Web3PGP service:', error)
      throw error
    }
  }

  /**
   * Update the contract address based on the current public client's chain
   * Call this when the network is switched
   */
  setContractAddress(publicClient: PublicClient): void {
    try {
      if (!this.web3PGP) {
        throw new Error('Web3PGP not initialized')
      }

      const chainId = publicClient.chain?.id
      if (!chainId) {
        throw new Error('Unable to determine chain ID from public client')
      }

      const newContractAddress = this.getContractAddressForChain(chainId) as `0x${string}`

      // Update the contract address on the Web3PGP instance
      this.web3PGP.address = newContractAddress
      this.publicClient = publicClient

      console.log(`Web3PGP contract address updated to ${newContractAddress} for chain ${chainId}`)
    } catch (error) {
      console.error('Failed to update contract address:', error)
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
