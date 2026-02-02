import { useState, useCallback } from 'react'
import { PublicKey } from 'openpgp'
import * as openpgp from 'openpgp'
import { useWeb3PGPServiceReady } from './useWeb3PGPServiceReady'
import { to0x } from '@jibidieuw/dexes'

type SubkeyStatus = 'valid' | 'revoked' | 'expired'

interface UsePublicKeyRegistrationReturn {
  primaryRegistered: boolean | null
  primaryIsRevoked: boolean | null
  subkeyRegistrationStatus: Map<string, boolean>
  subkeyVerificationStatus: Map<string, SubkeyStatus>
  selectableSubkeys: string[]
  isLoading: boolean
  error: string | null
  isServiceReady: boolean
  serviceError: Error | null
  checkRegistrationStatus: (publicKey: PublicKey) => Promise<void>
  refresh: () => Promise<void>
}

/**
 * Custom hook to check registration status of a public key and its subkeys
 * on the blockchain, following the Find page verification patterns
 */
export function usePublicKeyRegistration(): UsePublicKeyRegistrationReturn {
  const { service: web3pgpService, isReady: isServiceReady, error: serviceError } = useWeb3PGPServiceReady()

  const [primaryRegistered, setPrimaryRegistered] = useState<boolean | null>(
    null
  )
  const [primaryIsRevoked, setPrimaryIsRevoked] = useState<boolean | null>(null)
  const [subkeyRegistrationStatus, setSubkeyRegistrationStatus] = useState<
    Map<string, boolean>
  >(new Map())
  const [subkeyVerificationStatus, setSubkeyVerificationStatus] = useState<
    Map<string, SubkeyStatus>
  >(new Map())
  const [selectableSubkeys, setSelectableSubkeys] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Checks if a subkey is revoked or expired using the verification pattern
   * from the Find page
   */
  const checkSubkeyStatus = useCallback(
    async (subkey: openpgp.Subkey): Promise<SubkeyStatus> => {
      try {
        // Try to verify the subkey - this will throw if revoked or expired
        await subkey.verify()
        return 'valid'
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Subkey is revoked') {
            return 'revoked'
          }
          if (error.message === 'Subkey is expired') {
            return 'expired'
          }
        }
        // Default to valid if we can't determine status
        return 'valid'
      }
    },
    []
  )

  /**
   * Checks the registration status of a public key and all its subkeys
   */
  const checkRegistrationStatus = useCallback(
    async (publicKey: PublicKey) => {
      if (!web3pgpService) {
        setError('Web3PGP service not available')
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        // Step 1: Check primary key revocation status
        let isRevoked = false
        try {
          isRevoked = await publicKey.isRevoked()
        } catch (error) {
          // If error checking revocation, assume not revoked
          isRevoked = false
        }
        setPrimaryIsRevoked(isRevoked)

        // Step 2: Check if primary key is registered on blockchain
        const primaryFingerprint = publicKey.getFingerprint()
        const primaryFingerprintHex = to0x(primaryFingerprint.toUpperCase())
        const primaryExists = await web3pgpService.contract.exists(
          primaryFingerprintHex
        )
        setPrimaryRegistered(primaryExists)

        // Step 3: Get subkeys
        const subkeys = publicKey.getSubkeys()

        // Step 4: Check each subkey (only if primary is not revoked)
        const registrationStatusMap = new Map<string, boolean>()
        const verificationStatusMap = new Map<string, SubkeyStatus>()
        const selectable: string[] = []

        if (isRevoked) {
          // If primary is revoked, all subkeys are considered revoked
          for (const subkey of subkeys) {
            const subkeyFingerprint = subkey.getFingerprint().toUpperCase()
            verificationStatusMap.set(subkeyFingerprint, 'revoked')
            registrationStatusMap.set(subkeyFingerprint, false)
          }
        } else {
          // Primary is not revoked, check each subkey individually
          for (const subkey of subkeys) {
            const subkeyFingerprint = subkey.getFingerprint().toUpperCase()
            const subkeyFingerprintHex = to0x(subkeyFingerprint)

            // Check subkey status (revoked/expired/valid)
            const status = await checkSubkeyStatus(subkey)
            verificationStatusMap.set(subkeyFingerprint, status)

            // Check if subkey is registered
            const isSubkey = await web3pgpService.contract.isSubKey(
              subkeyFingerprintHex
            )
            registrationStatusMap.set(subkeyFingerprint, isSubkey)

            // A subkey is selectable if:
            // - NOT revoked
            // - NOT expired
            // - NOT registered
            if (status === 'valid' && !isSubkey) {
              selectable.push(subkeyFingerprint)
            }
          }
        }

        setSubkeyRegistrationStatus(registrationStatusMap)
        setSubkeyVerificationStatus(verificationStatusMap)
        setSelectableSubkeys(selectable)
        setError(null)
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to check registration status'
        setError(errorMessage)
        console.error('Registration status check failed:', err)
      } finally {
        setIsLoading(false)
      }
    },
    [web3pgpService, checkSubkeyStatus]
  )

  /**
   * Refreshes the registration status
   * Should be called after a successful registration
   */
  const refresh = useCallback(async () => {
    // This is a placeholder for now
    // In practice, you'd need to pass the current publicKey
    // or reset all states
    setPrimaryRegistered(null)
    setPrimaryIsRevoked(null)
    setSubkeyRegistrationStatus(new Map())
    setSubkeyVerificationStatus(new Map())
    setSelectableSubkeys([])
    setError(null)
  }, [])

  return {
    primaryRegistered,
    primaryIsRevoked,
    subkeyRegistrationStatus,
    subkeyVerificationStatus,
    selectableSubkeys,
    isLoading,
    error,
    isServiceReady,
    serviceError,
    checkRegistrationStatus,
    refresh,
  }
}
