import { useState, useCallback } from 'react'
import { PublicKey } from 'openpgp'
import { TransactionReceipt } from 'viem'
import { useWeb3PGPService } from './useWeb3PGPService'
import { useAccount } from 'wagmi'
import { to0x } from '@jibidieuw/dexes'

interface UseRevokePublicKeyReturn {
  isLoading: boolean
  error: string | null
  success: boolean
  transactionHash: string | null
  revokePrimaryKey: (publicKey: PublicKey) => Promise<void>
  revokeSubkey: (publicKey: PublicKey, subkeyFingerprint: string) => Promise<void>
  reset: () => void
}

/**
 * Custom hook to handle revocation of public keys and subkeys
 * Manages wallet connection validation, transaction execution, and state
 */
export function useRevokePublicKey(): UseRevokePublicKeyReturn {
  const web3pgpService = useWeb3PGPService()
  const { isConnected } = useAccount()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [transactionHash, setTransactionHash] = useState<string | null>(null)

  /**
   * Revokes a primary key
   */
  const revokePrimaryKey = useCallback(
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
        // Check if wallet is connected
        if (!isConnected) {
          throw new Error(
            'Wallet is not connected. Please connect your wallet to revoke a key.'
          )
        }

        // Get primary key fingerprint
        const primaryFingerprint = publicKey.getFingerprint().toUpperCase()
        const primaryFingerprintHex = to0x(primaryFingerprint)

        // Call the service to revoke the primary key
        const receipt = await web3pgpService.revoke(publicKey, primaryFingerprintHex)

        setTransactionHash(receipt.transactionHash)
        setSuccess(true)
        setError(null)
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to revoke primary key'
        setError(errorMessage)
        setSuccess(false)
        console.error('Primary key revocation failed:', err)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [web3pgpService, isConnected]
  )

  /**
   * Revokes a single subkey
   */
  const revokeSubkey = useCallback(
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
            'Wallet is not connected. Please connect your wallet to revoke a subkey.'
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

        // Normalize fingerprint to 0x format
        const fingerprintHex = to0x(subkeyFingerprint)

        // Call the service to revoke the subkey
        const receipt = await web3pgpService.revoke(publicKey, fingerprintHex)

        setTransactionHash(receipt.transactionHash)
        setSuccess(true)
        setError(null)
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to revoke subkey'
        setError(errorMessage)
        setSuccess(false)
        console.error('Subkey revocation failed:', err)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [web3pgpService, isConnected]
  )

  /**
   * Reset hook state
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
    revokePrimaryKey,
    revokeSubkey,
    reset,
  }
}
