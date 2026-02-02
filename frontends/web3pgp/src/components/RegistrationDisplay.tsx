import React, { useEffect, useState } from 'react'
import { PublicKey } from 'openpgp'
import { KeyFingerprint } from './KeyFingerprint'
import { UserIDsList } from './UserIDsList'
import { SubkeysListWithRegistration } from './SubkeysListWithRegistration'
import { RegistrationActionButtons } from './RegistrationActionButtons'
import { usePublicKeyRegistration } from '../hooks/usePublicKeyRegistration'
import { useRegisterPublicKey } from '../hooks/useRegisterPublicKey'

interface RegistrationDisplayProps {
  publicKey: PublicKey
}

/**
 * Displays public key information and handles registration workflows
 * Combines key info display with blockchain status checks and registration buttons
 */
export function RegistrationDisplay({
  publicKey,
}: RegistrationDisplayProps) {
  const {
    primaryRegistered,
    primaryIsRevoked,
    subkeyRegistrationStatus,
    subkeyVerificationStatus,
    selectableSubkeys,
    isLoading: isCheckingStatus,
    error: statusError,
    checkRegistrationStatus,
  } = usePublicKeyRegistration()

  const {
    isLoading: isRegistering,
    error: registrationError,
    registerPrimaryKey,
    registerSubkey,
    reset: resetRegistrationState,
  } = useRegisterPublicKey()

  const [selectedSubkeyFingerprint, setSelectedSubkeyFingerprint] = useState<
    string | null
  >(null)
  
  // Local copy of primary key registration status for optimistic UI updates
  const [localPrimaryRegistered, setLocalPrimaryRegistered] = useState<boolean | null>(null)
  
  // Local copy of subkey registration status for optimistic UI updates
  const [localSubkeyRegistrationStatus, setLocalSubkeyRegistrationStatus] = useState<
    Map<string, boolean>
  >(new Map())
  
  // Track invalid subkeys (revoked or expired)
  const [invalidSubkeys, setInvalidSubkeys] = useState<Set<string>>(new Set())

  // Detect invalid subkeys when key or verification status changes
  useEffect(() => {
    const detectInvalidSubkeys = async () => {
      const invalid = new Set<string>()
      for (const [fingerprint, status] of subkeyVerificationStatus) {
        if (status === 'revoked' || status === 'expired') {
          invalid.add(fingerprint)
        }
      }
      setInvalidSubkeys(invalid)
    }
    detectInvalidSubkeys()
  }, [subkeyVerificationStatus])

  // Merge blockchain state with primary key optimistic updates
  // Only update if blockchain confirms registration, never unflag it
  useEffect(() => {
    if (primaryRegistered === true) {
      setLocalPrimaryRegistered(true)
    }
  }, [primaryRegistered])

  // Merge blockchain state with optimistic updates for subkeys
  // Only update if blockchain confirms MORE registrations, never fewer
  useEffect(() => {
    setLocalSubkeyRegistrationStatus((prev) => {
      const merged = new Map(prev)
      // Only add entries that are now confirmed on blockchain
      // Never remove entries (keeps optimistic updates)
      for (const [fingerprint, isRegistered] of subkeyRegistrationStatus) {
        if (isRegistered) {
          merged.set(fingerprint, true)
        }
      }
      return merged
    })
  }, [subkeyRegistrationStatus])

  // Compute selectable subkeys by filtering out registered ones
  const effectiveSelectableSubkeys = selectableSubkeys.filter(
    (fingerprint) => !localSubkeyRegistrationStatus.get(fingerprint)
  )

  // Check registration status on mount
  useEffect(() => {
    checkRegistrationStatus(publicKey)
  }, [publicKey, checkRegistrationStatus])

  /**
   * Handle primary key registration
   * Cleans invalid subkeys and marks primary key and valid subkeys as registered
   */
  const handleRegisterPrimaryKey = async () => {
    try {
      let keyToRegister = publicKey
      
      // If there are invalid subkeys, clone the key and remove them
      if (invalidSubkeys.size > 0) {
        // Import openpgp for key cloning
        const openpgp = await import('openpgp')
        
        // Clone the key to avoid modifying the original
        const clonedKey = await openpgp.readKey({ 
          binaryKey: publicKey.toPublic().write() 
        })
        
        // Remove invalid subkeys from the clone
        clonedKey.subkeys = clonedKey.subkeys.filter(
          (subkey) => !invalidSubkeys.has(subkey.getFingerprint().toUpperCase())
        )
        
        keyToRegister = clonedKey
      }
      
      await registerPrimaryKey(keyToRegister)
      
      // Optimistically mark primary key as registered
      setLocalPrimaryRegistered(true)
      
      // Optimistically mark all VALID subkeys as registered
      const subkeys = publicKey.getSubkeys()
      setLocalSubkeyRegistrationStatus((prev) => {
        const updated = new Map(prev)
        for (const subkey of subkeys) {
          const fingerprint = subkey.getFingerprint().toUpperCase()
          // Only mark valid subkeys as registered (skip invalid ones)
          if (!invalidSubkeys.has(fingerprint)) {
            updated.set(fingerprint, true)
          }
        }
        return updated
      })
    } catch (error) {
      console.error('Error registering primary key:', error)
      throw error
    }
  }

  /**
   * Handle subkey registration
   * Updates UI optimistically and displays badges immediately
   */
  const handleRegisterSubkey = async (fingerprint: string) => {
    try {
      await registerSubkey(publicKey, fingerprint)
      
      // Optimistically update local status immediately for instant UI feedback
      setLocalSubkeyRegistrationStatus((prev) => {
        const updated = new Map(prev)
        updated.set(fingerprint, true)
        return updated
      })
      
      // Clear selection
      setSelectedSubkeyFingerprint(null)
    } catch (error) {
      console.error('Error registering subkey:', error)
      throw error
    }
  }

  const isLoading = isCheckingStatus || isRegistering
  const error = statusError || registrationError
  
  // Show warning if:
  // - Primary key is not registered yet
  // - There are invalid (revoked/expired) subkeys
  // - There are valid subkeys that can be registered
  const hasValidSubkeys = selectableSubkeys.length > 0
  const hasInvalidSubkeys = invalidSubkeys.size > 0
  const shouldShowWarning = !localPrimaryRegistered && !primaryRegistered && hasInvalidSubkeys && hasValidSubkeys

  /**
   * Extract and format expiration date from public key
   */
  const [expirationDate, setExpirationDate] = React.useState<Date | null>(null)

  React.useEffect(() => {
    const extractExpirationDate = async () => {
      try {
        const expirationTime = await publicKey.getExpirationTime()
        if (expirationTime && typeof expirationTime === 'number') {
          setExpirationDate(new Date(expirationTime * 1000))
        } else {
          setExpirationDate(expirationTime as Date | null)
        }
      } catch (err) {
        console.warn('Failed to get key expiration date:', err)
      }
    }
    extractExpirationDate()
  }, [publicKey])

  return (
    <div className="registration-display">
      <div className="key-info-section">
        <h2 className="display-title">Public Key Information</h2>
        <div className="scrollable-content">
          {/* Primary Key Fingerprint with registration status */}
          <KeyFingerprint
            publicKey={publicKey}
            isRegistered={localPrimaryRegistered ?? primaryRegistered ?? undefined}
            expirationDate={expirationDate}
          />

          {/* User IDs */}
          <UserIDsList publicKey={publicKey} />

          {/* Subkeys with registration and selection */}
          {isCheckingStatus ? (
            <div className="loading-state">
              <p className="loading-text">Checking registration status...</p>
            </div>
          ) : (
            <SubkeysListWithRegistration
              publicKey={publicKey}
              registrationStatus={localSubkeyRegistrationStatus}
              verificationStatus={subkeyVerificationStatus}
              selectableSubkeys={effectiveSelectableSubkeys}
              selectedSubkeyFingerprint={selectedSubkeyFingerprint}
              onSubkeySelect={setSelectedSubkeyFingerprint}
              primaryKeyRegistered={localPrimaryRegistered ?? primaryRegistered ?? false}
              primaryExpirationDate={expirationDate}
            />
          )}
        </div>

        {/* Warning message for revoked/expired subkeys */}
        {shouldShowWarning && (
          <div className="warning-message">
            <svg className="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <p>Some subkeys are revoked or expired. Only the primary key and valid subkeys will be registered.</p>
          </div>
        )}

        {/* Identity & Privacy Warning */}
        <div className="identity-privacy-warning">
          <svg className="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div className="warning-content">
            <h3 className="warning-title">Identity & Privacy Warning</h3>
            <p className="warning-text">
              All data in your public key (name, email, comments) will be permanently published on the Web3PGP registry. This information is public, immutable, and cannot be deleted. If you wish to remain anonymous, consider using a pseudonym or a dedicated email address before proceeding.
            </p>
            <h3 className="warning-title warning-title-secondary">User Responsibility</h3>
            <p className="warning-text">
              You are solely responsible for the data you publish. Once confirmed on the blockchain, this information is globally accessible forever and cannot be modified or removed by anyone, including the Web3PGP team.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <RegistrationActionButtons
          publicKey={publicKey}
          primaryKeyRegistered={localPrimaryRegistered ?? primaryRegistered ?? false}
          primaryIsRevoked={primaryIsRevoked ?? false}
          selectedSubkeyFingerprint={selectedSubkeyFingerprint}
          selectableSubkeysAvailable={effectiveSelectableSubkeys.length > 0}
          onRegisterPrimaryKey={handleRegisterPrimaryKey}
          onRegisterSubkey={handleRegisterSubkey}
          isLoading={isRegistering}
          error={registrationError}
        />
      </div>

      <style jsx>{`
        .registration-display {
          animation: fadeIn 0.3s ease-out;
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
        }

        .key-info-section {
          padding: 1.5rem;
          background-color: white;
          border-radius: 0.5rem;
          border: 1px solid var(--border-color, #e5e7eb);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
        }

        .scrollable-content {
          overflow-y: auto;
          flex: 1;
          padding-right: 0.5rem;
        }

        .scrollable-content::-webkit-scrollbar {
          width: 8px;
        }

        .scrollable-content::-webkit-scrollbar-track {
          background: var(--bg-secondary, #f9fafb);
          border-radius: 4px;
        }

        .scrollable-content::-webkit-scrollbar-thumb {
          background: var(--border-color, #d1d5db);
          border-radius: 4px;
        }

        .scrollable-content::-webkit-scrollbar-thumb:hover {
          background: #999;
        }

        .display-title {
          margin: 0 0 1.5rem 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary, #1f2937);
          flex-shrink: 0;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 2rem 1rem;
          text-align: center;
        }

        .loading-spinner {
          width: 2.5rem;
          height: 2.5rem;
          border: 3px solid var(--spinner-bg, #e5e7eb);
          border-top-color: var(--primary-color, #0ea5e9);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loading-text {
          margin: 0;
          font-size: 1rem;
          color: var(--text-secondary, #6b7280);
        }

        .warning-message {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 1rem;
          background-color: #fef3c7;
          border: 1px solid #fcd34d;
          border-radius: 0.375rem;
          margin-bottom: 1rem;
        }

        .warning-icon {
          flex-shrink: 0;
          width: 1.5rem;
          height: 1.5rem;
          color: #d97706;
          margin-top: 0.125rem;
        }

        .warning-message p {
          margin: 0;
          font-size: 0.95rem;
          color: #92400e;
          line-height: 1.5;
        }

        .identity-privacy-warning {
          display: flex;
          gap: 1rem;
          padding: 1.25rem;
          background-color: #fef3c7;
          border: 1px solid #fde68a;
          border-radius: 0.375rem;
          margin-bottom: 1.5rem;
          align-items: flex-start;
        }

        .identity-privacy-warning .warning-icon {
          flex-shrink: 0;
          width: 1.5rem;
          height: 1.5rem;
          color: #d97706;
          margin-top: 0.125rem;
        }

        .warning-content {
          flex: 1;
        }

        .warning-title {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
          font-weight: 700;
          color: #92400e;
        }

        .warning-title-secondary {
          margin-top: 1rem;
          margin-bottom: 0.5rem;
        }

        .warning-text {
          margin: 0;
          font-size: 0.95rem;
          color: #78350f;
          line-height: 1.6;
        }

        .warning-responsibility {
          margin-top: 0.75rem;
        }

        .expiration-field {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background-color: var(--bg-secondary, #f9fafb);
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 0.375rem;
          margin-bottom: 2rem;
        }

        .expiration-label {
          font-weight: 600;
          color: var(--text-secondary, #6b7280);
          font-size: 0.9rem;
          min-width: 90px;
        }

        .expiration-value {
          color: var(--text-primary, #1f2937);
          font-size: 0.9rem;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 640px) {
          .key-info-section {
            padding: 1rem;
          }

          .display-title {
            font-size: 1.1rem;
            margin-bottom: 1.25rem;
          }

          .expiration-field {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }

          .expiration-label {
            min-width: auto;
          }
        }
      `}</style>
    </div>
  )
}
