import { useState, useCallback } from 'react'
import { PublicKey } from 'openpgp'
import { to0x } from '@jibidieuw/dexes'
import {
  KeyMetadata,
  SubkeyMetadata,
  RevocationState,
  ProcessRevokeKeyResult,
} from '../types/revocation'
import { web3pgpServiceManager } from '../services/web3pgpService'

interface UseProcessRevokeKeyReturn {
  result: ProcessRevokeKeyResult | null
  isLoading: boolean
  error: string | null
  processKey: (providedKey: PublicKey) => Promise<void>
  processKeyWithCertificate: (
    certificate: string,
    fingerprint: string
  ) => Promise<void>
  reset: () => void
}

/**
 * Hook to process and analyze a revoke key with blockchain verification
 * Handles both direct key import and standalone certificate workflows
 */
export function useProcessRevokeKey(): UseProcessRevokeKeyReturn {
  const [result, setResult] = useState<ProcessRevokeKeyResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Determine revocation state of a subkey
   * @param subkeyFingerprint - Fingerprint of subkey to check
   * @param mergedKey - The merged key (provided + downloaded)
   * @param downloadedKey - The downloaded key from blockchain
   * @returns RevocationState
   */
  const getSubkeyRevocationState = async (
    subkeyFingerprint: string,
    mergedKey: PublicKey,
    downloadedKey: PublicKey
  ): Promise<RevocationState> => {
    try {
      // Get the subkey from merged key
      const mergedSubkey = mergedKey
        .getSubkeys()
        .find(
          (sk) => sk.getFingerprint().toUpperCase() === subkeyFingerprint
        )

      if (!mergedSubkey) {
        return 'valid'
      }

      // Check if subkey is revoked in downloaded key
      let revokedInDownloaded = false
      const downloadedSubkey = downloadedKey
        .getSubkeys()
        .find(
          (sk) => sk.getFingerprint().toUpperCase() === subkeyFingerprint
        )

      if (downloadedSubkey) {
        try {
          await downloadedSubkey.verify()
        } catch (err) {
          if (err instanceof Error && err.message === 'Subkey is revoked') {
            revokedInDownloaded = true
          }
        }
      }

      // Check if subkey is revoked in merged key
      let revokedInMerged = false
      try {
        await mergedSubkey.verify()
      } catch (err) {
        if (err instanceof Error && err.message === 'Subkey is revoked') {
          revokedInMerged = true
        }
      }

      // Determine state
      if (revokedInDownloaded) {
        return 'already-revoked'
      } else if (revokedInMerged) {
        return 'to-revoke'
      } else {
        return 'valid'
      }
    } catch (err) {
      console.error('Error determining subkey revocation state:', err)
      return 'valid'
    }
  }

  /**
   * Process a public key provided by user with blockchain download
   */
  const processKey = useCallback(
    async (providedKey: PublicKey) => {
      setIsLoading(true)
      setError(null)

      try {
        const service = web3pgpServiceManager.getWeb3PGPService()

        // Step 1: Get primary key fingerprint
        const primaryFingerprint = providedKey
          .getFingerprint()
          .toUpperCase()
        const hexFingerprint = to0x(primaryFingerprint)

        // Step 2: Download key from blockchain
        let downloadedKey: PublicKey | null = null
        try {
          downloadedKey = await service.getPublicKey(hexFingerprint)
        } catch (err) {
          // Key not found on blockchain - still process but mark as unregistered
          console.warn('Key not found on blockchain:', err)
        }

        // Step 3: Merge keys
        let mergedKey: PublicKey = providedKey
        if (downloadedKey) {
          mergedKey = await providedKey.update(downloadedKey)
        }

        // Step 4: Check primary key registration and revocation
        const primaryKeyRegistered = downloadedKey !== null

        let primaryKeyRevocationState: RevocationState = 'valid'
        let primaryKeyIsRevokedInDownloaded = false
        let primaryKeyIsRevokedInMerged = false

        // Check primary key revocation in downloaded key
        if (downloadedKey) {
          try {
            primaryKeyIsRevokedInDownloaded =
              await downloadedKey.isRevoked()
          } catch (err) {
            primaryKeyIsRevokedInDownloaded = false
          }
        }

        // Check primary key revocation in merged key
        try {
          primaryKeyIsRevokedInMerged = await mergedKey.isRevoked()
        } catch (err) {
          primaryKeyIsRevokedInMerged = false
        }

        // Determine primary key state
        if (primaryKeyIsRevokedInDownloaded) {
          primaryKeyRevocationState = 'already-revoked'
        } else if (primaryKeyIsRevokedInMerged) {
          primaryKeyRevocationState = 'to-revoke'
        }

        // Step 5: Process subkeys
        const subkeys: SubkeyMetadata[] = []
        const mergedSubkeys = mergedKey.getSubkeys()

        for (const subkey of mergedSubkeys) {
          const subkeyFingerprint = subkey
            .getFingerprint()
            .toUpperCase()

          // Determine if subkey is registered (exists in both keys)
          const isRegistered =
            primaryKeyRegistered &&
            downloadedKey!.getSubkeys().some(
              (sk) =>
                sk.getFingerprint().toUpperCase() === subkeyFingerprint
            )

          // Determine revocation state
          let revocationState: RevocationState = 'valid'
          if (isRegistered && downloadedKey) {
            revocationState = await getSubkeyRevocationState(
              subkeyFingerprint,
              mergedKey,
              downloadedKey
            )
          }

          // If primary key is "to-revoke", all subkeys are also "to-revoke"
          if (primaryKeyRevocationState === 'to-revoke') {
            revocationState = 'to-revoke'
          }

          subkeys.push({
            fingerprint: subkeyFingerprint,
            registrationState: isRegistered ? 'registered' : 'unregistered',
            revocationState,
          })
        }

        // Step 6: Determine if all items are already revoked on blockchain
        const hasAllRevokedOnBlockchain =
          primaryKeyRevocationState === 'already-revoked'

        // Create metadata
        const metadata: KeyMetadata = {
          primaryKeyFingerprint: primaryFingerprint,
          primaryKeyRegistered,
          primaryKeyRevocationState,
          subkeys,
          mergedKey,
          downloadedKey,
        }

        setResult({
          metadata,
          hasAllRevokedOnBlockchain,
        })
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Failed to process key'
        setError(errorMsg)
        setResult(null)
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  /**
   * Process a key from a standalone revocation certificate
   */
  const processKeyWithCertificate = useCallback(
    async (certificate: string, fingerprint: string) => {
      setIsLoading(true)
      setError(null)

      try {
        const service = web3pgpServiceManager.getWeb3PGPService()

        // Step 1: Download key from blockchain using provided fingerprint
        const hexFingerprint = to0x(fingerprint)
        let downloadedKey: PublicKey
        try {
          downloadedKey = await service.getPublicKey(hexFingerprint)
        } catch (err) {
          throw new Error(
            `Failed to download key with fingerprint ${fingerprint}: ${err instanceof Error ? err.message : 'Unknown error'}`
          )
        }

        // Step 2: Apply revocation certificate to downloaded key
        // Note: Using openpgp's readCleartextMessage or similar to parse and apply cert
        // This assumes the certificate can be applied via OpenPGP library
        const mergedKey = await (downloadedKey as any).update(
          certificate
        ) as PublicKey

        // Step 3: Use same processing logic
        const primaryFingerprint = mergedKey
          .getFingerprint()
          .toUpperCase()

        // Primary key is always registered (we downloaded it)
        const primaryKeyRegistered = true

        let primaryKeyRevocationState: RevocationState = 'valid'
        let primaryKeyIsRevokedInDownloaded = false
        let primaryKeyIsRevokedInMerged = false

        // Check primary key revocation
        try {
          primaryKeyIsRevokedInDownloaded =
            await downloadedKey.isRevoked()
        } catch (err) {
          primaryKeyIsRevokedInDownloaded = false
        }

        try {
          primaryKeyIsRevokedInMerged = await mergedKey.isRevoked()
        } catch (err) {
          primaryKeyIsRevokedInMerged = false
        }

        if (primaryKeyIsRevokedInDownloaded) {
          primaryKeyRevocationState = 'already-revoked'
        } else if (primaryKeyIsRevokedInMerged) {
          primaryKeyRevocationState = 'to-revoke'
        }

        // Process subkeys
        const subkeys: SubkeyMetadata[] = []
        const mergedSubkeys = mergedKey.getSubkeys()

        for (const subkey of mergedSubkeys) {
          const subkeyFingerprint = subkey
            .getFingerprint()
            .toUpperCase()

          // Determine if subkey is registered
          const isRegistered = downloadedKey
            .getSubkeys()
            .some(
              (sk) =>
                sk.getFingerprint().toUpperCase() === subkeyFingerprint
            )

          // Determine revocation state
          let revocationState: RevocationState = 'valid'
          if (isRegistered) {
            revocationState = await getSubkeyRevocationState(
              subkeyFingerprint,
              mergedKey,
              downloadedKey
            )
          }

          // If primary key is "to-revoke", all subkeys are also "to-revoke"
          if (primaryKeyRevocationState === 'to-revoke') {
            revocationState = 'to-revoke'
          }

          subkeys.push({
            fingerprint: subkeyFingerprint,
            registrationState: isRegistered ? 'registered' : 'unregistered',
            revocationState,
          })
        }

        const hasAllRevokedOnBlockchain =
          primaryKeyRevocationState === 'already-revoked'

        const metadata: KeyMetadata = {
          primaryKeyFingerprint: primaryFingerprint,
          primaryKeyRegistered,
          primaryKeyRevocationState,
          subkeys,
          mergedKey,
          downloadedKey,
        }

        setResult({
          metadata,
          hasAllRevokedOnBlockchain,
        })
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Failed to process certificate'
        setError(errorMsg)
        setResult(null)
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
    processKeyWithCertificate,
    reset,
  }
}
