import { useState, useCallback } from 'react'
import { PublicKey } from 'openpgp'
import * as openpgp from 'openpgp'

interface UsePublicKeyRevocationStatusReturn {
  revokedPrimaryKey: boolean | null
  revokedSubkeys: string[]
  isLoading: boolean
  error: string | null
  checkRevocationStatus: (publicKey: PublicKey) => Promise<void>
}

/**
 * Custom hook to check revocation status of a public key and its subkeys
 */
export function usePublicKeyRevocationStatus(): UsePublicKeyRevocationStatusReturn {
  const [revokedPrimaryKey, setRevokedPrimaryKey] = useState<boolean | null>(null)
  const [revokedSubkeys, setRevokedSubkeys] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Checks the revocation status of a public key and all its subkeys
   */
  const checkRevocationStatus = useCallback(
    async (publicKey: PublicKey) => {
      setIsLoading(true)
      setError(null)

      try {
        // Check primary key revocation status
        let primaryIsRevoked = false
        try {
          primaryIsRevoked = await publicKey.isRevoked()
        } catch (error) {
          // If error checking revocation, assume not revoked
          primaryIsRevoked = false
        }
        setRevokedPrimaryKey(primaryIsRevoked)

        // Check each subkey for revocation
        const subkeys = publicKey.getSubkeys()
        const revoked: string[] = []

        for (const subkey of subkeys) {
          try {
            // Try to verify the subkey - if it throws 'revoked', the subkey is revoked
            await subkey.verify()
            // If verify succeeds, subkey is not revoked
          } catch (error) {
            if (error instanceof Error && error.message === 'Subkey is revoked') {
              revoked.push(subkey.getFingerprint().toUpperCase())
            }
            // Ignore other errors
          }
        }

        setRevokedSubkeys(revoked)
        setError(null)
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to check revocation status'
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  return {
    revokedPrimaryKey,
    revokedSubkeys,
    isLoading,
    error,
    checkRevocationStatus,
  }
}
