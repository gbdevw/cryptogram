import { PublicKey } from 'openpgp'

/**
 * Revocation state of a key/subkey
 */
export type RevocationState = 
  | 'to-revoke'        // Revoked in merged, not in downloaded
  | 'already-revoked'   // Revoked in downloaded key
  | 'valid'             // Not revoked anywhere

/**
 * Registration status - whether a key/subkey exists on blockchain
 */
export type RegistrationState = 
  | 'registered'        // Present in both merged & downloaded
  | 'unregistered'      // Not present in downloaded

/**
 * Metadata for a subkey
 */
export interface SubkeyMetadata {
  fingerprint: string
  registrationState: RegistrationState
  revocationState: RevocationState
}

/**
 * Metadata for the entire processed key
 */
export interface KeyMetadata {
  primaryKeyFingerprint: string
  primaryKeyRegistered: boolean
  primaryKeyRevocationState: RevocationState
  subkeys: SubkeyMetadata[]
  mergedKey: PublicKey
  downloadedKey: PublicKey | null
}

/**
 * Result of key processing operation
 */
export interface ProcessRevokeKeyResult {
  metadata: KeyMetadata
  hasAllRevokedOnBlockchain: boolean
  error?: string
}
