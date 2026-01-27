import { useState, useCallback } from 'react'
import { PublicKey } from 'openpgp'
import { useWeb3PGPService } from './useWeb3PGPService'
import { to0x } from '@jibidieuw/dexes'

interface UseFetchPublicKeyReturn {
  publicKey: PublicKey | null
  isLoading: boolean
  error: string | null
  fetchPublicKey: (fingerprint: string) => Promise<void>
  reset: () => void
}

/**
 * Custom hook to fetch public keys from Web3PGP service
 * Handles fingerprint validation, loading states, and error management
 */
export function useFetchPublicKey(): UseFetchPublicKeyReturn {
  const web3pgpService = useWeb3PGPService()
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Validates fingerprint format (40 hex chars for short form)
   */
  const validateFingerprint = (fingerprint: string): boolean => {
    // Remove spaces and normalize
    const cleaned = fingerprint.trim().replace(/\s/g, '')
    // Accept both 40 (short) and 64 (long) character fingerprints
    return /^[0-9a-fA-F]{40}$/.test(cleaned) || /^[0-9a-fA-F]{64}$/.test(cleaned)
  }

  /**
   * Normalizes fingerprint to remove spaces and convert to uppercase
   */
  const normalizeFingerprint = (fingerprint: string): `0x${string}` => {
    return to0x(fingerprint.trim().replace(/\s/g, '').toUpperCase())
  }

  /**
   * Fetches a public key by fingerprint from the Web3PGP service
   */
  const fetchPublicKey = useCallback(
    async (fingerprint: string) => {
      // Reset state before fetching
      setPublicKey(null)
      setError(null)
      setIsLoading(true)

      try {
        // Validate fingerprint format
        if (!validateFingerprint(fingerprint)) {
          throw new Error('invalid-input')
        }

        // Normalize fingerprint
        const normalizedFingerprint = normalizeFingerprint(fingerprint)

        // Call the Web3PGP service to fetch the public key
        const result = await web3pgpService.getPublicKey(to0x(normalizedFingerprint))

        // Check if key was found
        if (!result) {
          setError('not-found')
          setPublicKey(null)
        } else {
          setPublicKey(result)
          setError(null)
        }
      } catch (err) {
        // Determine error type
        if (err instanceof Error && err.message === 'invalid-input') {
          setError('invalid-input')
        } else {
          // Log the actual error for debugging
          console.error('Failed to fetch public key:', err)
          setError('service-error')
        }
        setPublicKey(null)
      } finally {
        setIsLoading(false)
      }
    },
    [web3pgpService]
  )

  /**
   * Resets all state to initial values
   */
  const reset = useCallback(() => {
    setPublicKey(null)
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    publicKey,
    isLoading,
    error,
    fetchPublicKey,
    reset,
  }
}
