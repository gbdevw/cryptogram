import { useState, useCallback } from 'react'
import { PublicKey } from 'openpgp'
import { to0x } from '@jibidieuw/dexes'
import { TransactionReceipt } from 'viem'
import { web3pgpServiceManager } from '../services/web3pgpService'

interface UseUpdatePublicKeyReturn {
  isLoading: boolean
  error: string | null
  updateKey: (mergedKey: PublicKey) => Promise<TransactionReceipt | undefined>
  reset: () => void
}

/**
 * Hook to handle public key update on the blockchain
 * Manages the transaction lifecycle and error handling
 */
export function useUpdatePublicKey(): UseUpdatePublicKeyReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Update the public key on the blockchain
   */
  const updateKey = useCallback(
    async (mergedKey: PublicKey): Promise<TransactionReceipt | undefined> => {
      setIsLoading(true)
      setError(null)

      try {
        // Get the Web3PGP service
        const service = web3pgpServiceManager.getWeb3PGPService()
        if (!service) {
          throw new Error('Web3PGP service not initialized')
        }

        console.debug(
          `[UPDATE PUBLIC KEY] Updating key with fingerprint: ${mergedKey.getFingerprint()}`
        )

        // Call the update method
        const receipt = await service.update(mergedKey)

        console.debug(
          `[UPDATE PUBLIC KEY] Key updated successfully. Transaction hash: ${receipt.transactionHash}`
        )

        return receipt
      } catch (err) {
        let errorMessage = 'Failed to update the OpenPGP key'

        if (err instanceof Error) {
          if (err.message.includes('User rejected')) {
            errorMessage = 'Transaction cancelled by user'
          } else {
            errorMessage = err.message
          }
        }

        console.error(`[UPDATE PUBLIC KEY] Error: ${errorMessage}`)
        setError(errorMessage)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const reset = useCallback(() => {
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    isLoading,
    error,
    updateKey,
    reset,
  }
}
