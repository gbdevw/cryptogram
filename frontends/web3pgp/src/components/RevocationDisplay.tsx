import React, { useEffect, useState } from 'react'
import { PublicKey } from 'openpgp'
import { KeyFingerprint } from './KeyFingerprint'
import { UserIDsList } from './UserIDsList'
import { SubkeysListWithRevocation } from './SubkeysListWithRevocation'
import { RevocationActionButtons } from './RevocationActionButtons'
import { usePublicKeyRevocationStatus } from '../hooks/usePublicKeyRevocationStatus'
import { useRevokePublicKey } from '../hooks/useRevokePublicKey'

interface RevocationDisplayProps {
  publicKey: PublicKey
}

/**
 * Displays public key information and handles revocation workflows
 * Shows revoked keys/subkeys and provides options to publish revocation
 */
export function RevocationDisplay({
  publicKey,
}: RevocationDisplayProps) {
  const {
    revokedPrimaryKey,
    revokedSubkeys,
    isLoading: isCheckingStatus,
    error: statusError,
    checkRevocationStatus,
  } = usePublicKeyRevocationStatus()

  const {
    isLoading: isRevoking,
    error: revocationError,
    revokePrimaryKey,
    revokeSubkey,
    reset: resetRevocationState,
  } = useRevokePublicKey()

  const [selectedSubkeyFingerprint, setSelectedSubkeyFingerprint] = useState<
    string | null
  >(null)

  // Check revocation status on mount
  useEffect(() => {
    checkRevocationStatus(publicKey)
  }, [publicKey, checkRevocationStatus])

  /**
   * Handle primary key revocation
   */
  const handlePublishRevocation = async () => {
    try {
      if (revokedPrimaryKey) {
        // Revoke primary key (and any revoked subkeys)
        await revokePrimaryKey(publicKey)
      } else if (selectedSubkeyFingerprint) {
        // Revoke selected subkey
        await revokeSubkey(publicKey, selectedSubkeyFingerprint)
        // Clear selection after successful revocation
        setSelectedSubkeyFingerprint(null)
      }
    } catch (error) {
      console.error('Error publishing revocation:', error)
      throw error
    }
  }

  const isLoading = isCheckingStatus || isRevoking
  const error = statusError || revocationError

  const hasRevocations =
    (revokedPrimaryKey || revokedSubkeys.length > 0)

  return (
    <div className="revocation-display">
      <div className="key-info-section">
        <h2 className="display-title">Public Key Information</h2>
        <div className="scrollable-content">
          {/* Primary Key Fingerprint */}
          <KeyFingerprint
            publicKey={publicKey}
            isRegistered={revokedPrimaryKey ? undefined : undefined}
          />

          {/* User IDs */}
          <UserIDsList publicKey={publicKey} />

          {/* Subkeys with revocation status */}
          {isCheckingStatus ? (
            <div className="loading-state">
              <p className="loading-text">Checking revocation status...</p>
            </div>
          ) : (
            <SubkeysListWithRevocation
              publicKey={publicKey}
              revokedSubkeys={revokedSubkeys}
              selectedSubkeyFingerprint={selectedSubkeyFingerprint}
              onSubkeySelect={setSelectedSubkeyFingerprint}
            />
          )}
        </div>

        {/* No revoked items message */}
        {!hasRevocations && !isCheckingStatus && (
          <div className="info-message">
            <svg
              className="info-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <p>This key has no revoked items to publish.</p>
          </div>
        )}

        {/* Action buttons */}
        <RevocationActionButtons
          publicKey={publicKey}
          revokedPrimaryKey={revokedPrimaryKey ?? false}
          revokedSubkeys={revokedSubkeys}
          selectedSubkeyFingerprint={selectedSubkeyFingerprint}
          onPublishRevocation={handlePublishRevocation}
          isLoading={isRevoking}
          error={revocationError}
        />
      </div>

      <style jsx>{`
        .revocation-display {
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

        .info-message {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 1rem;
          background-color: #dbeafe;
          border: 1px solid #bfdbfe;
          border-radius: 0.375rem;
          margin-bottom: 1rem;
        }

        .info-icon {
          flex-shrink: 0;
          width: 1.5rem;
          height: 1.5rem;
          color: #0369a1;
          margin-top: 0.125rem;
        }

        .info-message p {
          margin: 0;
          font-size: 0.95rem;
          color: #0c4a6e;
          line-height: 1.5;
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
