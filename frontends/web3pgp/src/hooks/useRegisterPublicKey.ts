import { useState, useCallback } from 'react'
import { PublicKey } from 'openpgp'
import { TransactionReceipt } from 'viem'
import { useWeb3PGPService } from './useWeb3PGPService'
import { useAccount } from 'wagmi'
import { to0x } from '@jibidieuw/dexes'

interface UseRegisterPublicKeyReturn {
  isLoading: boolean
  error: string | null
  success: boolean
  transactionHash: string | null
  registerPrimaryKey: (publicKey: PublicKey) => Promise<void>
  registerSubkey: (publicKey: PublicKey, subkeyFingerprint: string) => Promise<void>
  reset: () => void
}

/**
 * Custom hook to handle registration of public keys and subkeys
 * Manages wallet connection validation, transaction execution, and state
 */
export function useRegisterPublicKey(): UseRegisterPublicKeyReturn {
  const web3pgpService = useWeb3PGPService()
  const { isConnected } = useAccount()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [transactionHash, setTransactionHash] = useState<string | null>(null)

  /**
   * Registers a primary key and all its non-revoked, non-expired subkeys
   */
  const registerPrimaryKey = useCallback(
    async (publicKey: PublicKey) => {
      if (!web3pgpService) {
        setError('Web3PGP service not available')
        return
      }

      setIsLoading(true)
      setError(null)
      setSuccess(false)
      setTransactionHash(null)

      try {
        // The service automatically extracts and registers all valid subkeys
        // from the public key object, so we just pass the key
        const receipt = await web3pgpService.register(publicKey)

        setTransactionHash(receipt.transactionHash)
        setSuccess(true)
        setError(null)
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to register public key'
        setError(errorMessage)
        setSuccess(false)
        console.error('Primary key registration failed:', err)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [web3pgpService, isConnected]
  )

  /**
   * Registers a single subkey to an already-registered primary key
   */
  const registerSubkey = useCallback(
    async (publicKey: PublicKey, subkeyFingerprint: string) => {
      if (!web3pgpService) {
        setError('Web3PGP service not available')
        return
      }

      setIsLoading(true)
      setError(null)
      setSuccess(false)
      setTransactionHash(null)

      try {
        // Check if wallet is connected
        if (!isConnected) {
          throw new Error(
            'Wallet is not connected. Please connect your wallet to register a subkey.'
          )
        }

        // Find the subkey object by fingerprint
        const subkeys = publicKey.getSubkeys()
        let targetSubkey = null

        for (const subkey of subkeys) {
          const fp = subkey.getFingerprint().toUpperCase()
          if (fp === subkeyFingerprint.toUpperCase()) {
            targetSubkey = subkey
            break
          }
        }

        if (!targetSubkey) {
          throw new Error(`Subkey with fingerprint ${subkeyFingerprint} not found`)
        }

        // Verify the subkey is valid before registering
        try {
          await targetSubkey.verify()
        } catch (error) {
          if (error instanceof Error) {
            if (error.message === 'Subkey is revoked') {
              throw new Error('Cannot register a revoked subkey')
            }
            if (error.message === 'Subkey is expired') {
              throw new Error('Cannot register an expired subkey')
            }
          }
          throw error
        }

        // Call the service to register the subkey
        // The addSubkey method requires the subkey fingerprint in 0x-prefixed format
        const receipt = await web3pgpService.addSubkey(
          publicKey,
          to0x(subkeyFingerprint)
        )

        setTransactionHash(receipt.transactionHash)
        setSuccess(true)
        setError(null)
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to register subkey'
        setError(errorMessage)
        setSuccess(false)
        console.error('Subkey registration failed:', err)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [web3pgpService, isConnected]
  )

  /**
   * Resets all state to initial values
   */
  const reset = useCallback(() => {
    setIsLoading(false)
    setError(null)
    setSuccess(false)
    setTransactionHash(null)
  }, [])

  return {
    isLoading,
    error,
    success,
    transactionHash,
    registerPrimaryKey,
    registerSubkey,
    reset,
  }
}
