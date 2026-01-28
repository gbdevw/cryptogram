import React, { useEffect } from 'react'
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

  const [selectedSubkeyFingerprint, setSelectedSubkeyFingerprint] = React.useState<
    string | null
  >(null)

  // Check registration status on mount
  useEffect(() => {
    checkRegistrationStatus(publicKey)
  }, [publicKey, checkRegistrationStatus])

  /**
   * Handle primary key registration
   */
  const handleRegisterPrimaryKey = async () => {
    try {
      await registerPrimaryKey(publicKey)
      // Re-check registration status after successful registration
      setTimeout(() => {
        checkRegistrationStatus(publicKey)
      }, 1000)
    } catch (error) {
      console.error('Error registering primary key:', error)
      throw error
    }
  }

  /**
   * Handle subkey registration
   */
  const handleRegisterSubkey = async (fingerprint: string) => {
    try {
      await registerSubkey(publicKey, fingerprint)
      // Clear selection and re-check status
      setSelectedSubkeyFingerprint(null)
      setTimeout(() => {
        checkRegistrationStatus(publicKey)
      }, 1000)
    } catch (error) {
      console.error('Error registering subkey:', error)
      throw error
    }
  }

  const isLoading = isCheckingStatus || isRegistering
  const error = statusError || registrationError

  return (
    <div className="registration-display">
      <div className="key-info-section">
        <h2 className="display-title">Public Key Information</h2>
        <div className="scrollable-content">
          {/* Primary Key Fingerprint with registration status */}
          <KeyFingerprint
            publicKey={publicKey}
            isRegistered={primaryRegistered ?? undefined}
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
              registrationStatus={subkeyRegistrationStatus}
              verificationStatus={subkeyVerificationStatus}
              selectableSubkeys={selectableSubkeys}
              selectedSubkeyFingerprint={selectedSubkeyFingerprint}
              onSubkeySelect={setSelectedSubkeyFingerprint}
              primaryKeyRegistered={primaryRegistered ?? false}
            />
          )}
        </div>

        {/* Action buttons */}
        <RegistrationActionButtons
          publicKey={publicKey}
          primaryKeyRegistered={primaryRegistered ?? false}
          selectedSubkeyFingerprint={selectedSubkeyFingerprint}
          selectableSubkeysAvailable={selectableSubkeys.length > 0}
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
        }
      `}</style>
    </div>
  )
}
