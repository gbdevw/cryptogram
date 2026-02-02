import { useState, useCallback } from 'react'
import { PublicKey } from 'openpgp'
import { to0x } from '@jibidieuw/dexes'
import { web3pgpServiceManager } from '../services/web3pgpService'
import { RevocationState } from '../types/revocation'

export interface UpdateUserMetadata {
  userID: string
  name: string
  email: string
  comment: string
  status: 'valid' | 'revoked'
}

export interface UpdateKeyMetadata {
  primaryKeyFingerprint: string
  primaryKeyRegistered: boolean
  primaryKeyRevocationState: RevocationState
  expirationDate: Date | null
  users: UpdateUserMetadata[]
  mergedKey: PublicKey
  downloadedKey: PublicKey
}

interface UseProcessUpdateKeyReturn {
  result: UpdateKeyMetadata | null
  isLoading: boolean
  error: string | null
  processKey: (providedKey: PublicKey) => Promise<void>
  reset: () => void
}

/**
 * Hook to process and merge an update key with the blockchain version
 * Fetches the registered key from blockchain and merges it with the provided key
 */
export function useProcessUpdateKey(): UseProcessUpdateKeyReturn {
  const [result, setResult] = useState<UpdateKeyMetadata | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Parse OpenPGP user ID format: "Name (Comment) <email@example.com>"
   * Extracts name, email, and comment components
   */
  const parseUserID = (userID: string) => {
    let name = userID
    let email: string | undefined
    let comment: string | undefined

    // Extract email (text within angle brackets)
    const emailMatch = userID.match(/<([^>]+)>/)
    if (emailMatch) {
      email = emailMatch[1]
      name = userID.replace(emailMatch[0], '').trim()
    }

    // Extract comment (text within parentheses)
    const commentMatch = name.match(/\(([^)]+)\)/)
    if (commentMatch) {
      comment = commentMatch[1]
      name = name.replace(commentMatch[0], '').trim()
    }

    return { name, email, comment }
  }

  /**
   * Extract user metadata from a public key
   */
  const extractUserMetadata = async (
    key: PublicKey
  ): Promise<UpdateUserMetadata[]> => {
    const users: UpdateUserMetadata[] = []
    const userIDStrings = key.getUserIDs()

    for (let i = 0; i < userIDStrings.length; i++) {
      const userID = userIDStrings[i]
      const userObject = key.users[i]

      if (!userID || !userObject) continue

      // Try to verify the user ID
      let status: 'valid' | 'revoked' = 'valid'
      try {
        // Call verify without arguments for user ID verification
        await userObject.verify()
      } catch (err) {
        status = 'revoked'
      }

      // Parse user ID components using same logic as Find page
      const parsed = parseUserID(userID)

      users.push({
        userID: userID.trim(),
        name: parsed.name,
        email: parsed.email || '',
        comment: parsed.comment || '',
        status,
      })
    }

    return users
  }

  /**
   * Process the provided key by fetching the registered version and merging
   */
  const processKey = useCallback(
    async (providedKey: PublicKey) => {
      setIsLoading(true)
      setError(null)
      setResult(null)

      try {
        // Get the Web3PGP service
        const service = web3pgpServiceManager.getWeb3PGPService()
        if (!service) {
          throw new Error('Web3PGP service not initialized')
        }

        // Extract fingerprint from provided key
        const fingerprint = `0x${providedKey.getFingerprint()}` as `0x${string}`

        console.debug(
          `[UPDATE KEY PROCESSING] Processing key with fingerprint: ${fingerprint}`
        )

        // Fetch the registered key from blockchain
        let downloadedKey: PublicKey
        try {
          downloadedKey = await service.getPublicKey(fingerprint)
        } catch (err) {
          throw new Error(
            `Key with fingerprint ${fingerprint} not found on blockchain. Please register the key first.`
          )
        }

        if (!downloadedKey) {
          throw new Error(
            `Key with fingerprint ${fingerprint} not found on blockchain. Please register the key first.`
          )
        }

        // Merge the keys: apply updates from providedKey to downloadedKey
        const mergedKey = await downloadedKey.update(providedKey)

        // Check if primary key is revoked
        const primaryKeyRevoked = await mergedKey.isRevoked()
        const primaryKeyRevocationState: RevocationState = primaryKeyRevoked ? 'already-revoked' : 'valid'

        // Check if primary key is registered (it should be since we just downloaded it)
        const primaryKeyRegistered = true // We confirmed it's registered by successfully downloading it

        // Get expiration date from the user signature (not the key packet)
        // In OpenPGP, key expiration is stored in the primary user's certification signature subpacket
        let expirationDate: Date | null
        let expirationTime = await mergedKey.getExpirationTime()
        if (expirationTime && typeof expirationTime === 'number') {
          expirationDate = new Date(expirationTime * 1000)
        } else {
          expirationDate = expirationTime as Date | null
        }
    
        // Extract user metadata
        const users = await extractUserMetadata(mergedKey)

        console.debug(
          `[UPDATE KEY PROCESSING] Successfully processed key with ${users.length} users`
        )

        setResult({
          primaryKeyFingerprint: mergedKey.getFingerprint().toUpperCase(),
          primaryKeyRegistered,
          primaryKeyRevocationState,
          expirationDate,
          users,
          mergedKey: mergedKey.toPublic(),
          downloadedKey: downloadedKey.toPublic(),
        })
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to process the update key'
        console.error(`[UPDATE KEY PROCESSING] Error: ${errorMessage}`)
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    result,
    isLoading,
    error,
    processKey,
    reset,
  }
}
