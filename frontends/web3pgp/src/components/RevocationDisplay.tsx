import React, { useEffect, useState } from 'react'
import { PublicKey } from 'openpgp'
import { KeyFingerprint } from './KeyFingerprint'
import { RevocationUserIDsList } from './RevocationUserIDsList'
import { SubkeysListWithRevocation } from './SubkeysListWithRevocation'
import { RevocationActionButtons } from './RevocationActionButtons'
import { useProcessRevokeKey } from '../hooks/useProcessRevokeKey'
import { useRevokePublicKey } from '../hooks/useRevokePublicKey'
import { KeyMetadata } from '../types/revocation'

interface RevocationDisplayProps {
  publicKey: PublicKey
}

/**
 * Displays public key information and handles revocation workflows
 * Processes key against blockchain version, merges them, and shows revocation status
 */
export function RevocationDisplay({
  publicKey,
}: RevocationDisplayProps) {
  const {
    result: processResult,
    isLoading: isProcessing,
    error: processError,
    processKey,
  } = useProcessRevokeKey()

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
  const [dismissedError, setDismissedError] = useState(false)
  const [localMetadata, setLocalMetadata] = useState<KeyMetadata | null>(null)

  // Use local metadata if available, otherwise use processed metadata
  const displayMetadata = localMetadata || processResult?.metadata

  // Process the key on mount
  useEffect(() => {
    processKey(publicKey)
  }, [publicKey, processKey])

  /**
   * Handle primary key revocation
   */
  const handlePublishRevocation = async () => {
    if (!processResult?.metadata) return

    try {
      const { metadata } = processResult
      if (metadata.primaryKeyRevocationState === 'to-revoke') {
        // Revoke primary key
        await revokePrimaryKey(metadata.mergedKey)
      } else if (selectedSubkeyFingerprint) {
        // Revoke selected subkey
        await revokeSubkey(metadata.mergedKey, selectedSubkeyFingerprint)
        // Clear selection after successful revocation
        setSelectedSubkeyFingerprint(null)
      }
    } catch (error) {
      console.error('Error publishing revocation:', error)
      throw error
    }
  }

  /**
   * Handle successful revocation - update metadata locally
   */
  const handleRevocationSuccess = () => {
    const metadata = displayMetadata
    if (!metadata) return

    // If primary key was revoked, update all to already-revoked
    if (metadata.primaryKeyRevocationState === 'to-revoke') {
      const updatedMetadata: KeyMetadata = {
        ...metadata,
        primaryKeyRevocationState: 'already-revoked',
        subkeys: metadata.subkeys.map(sk => ({
          ...sk,
          revocationState: 'already-revoked' as const,
        })),
      }
      setLocalMetadata(updatedMetadata)
    } else if (selectedSubkeyFingerprint) {
      // If subkey was revoked, update only that subkey
      const updatedMetadata: KeyMetadata = {
        ...metadata,
        subkeys: metadata.subkeys.map(sk =>
          sk.fingerprint === selectedSubkeyFingerprint
            ? { ...sk, revocationState: 'already-revoked' as const }
            : sk
        ),
      }
      setLocalMetadata(updatedMetadata)
    }
  }

  const isLoading = isProcessing || isRevoking
  const error = processError || revocationError
  
  // Parse revocation error message
  const getErrorMessage = (errorText: string | null): string | null => {
    if (!errorText) return null
    
    if (errorText.includes('User rejected the request')) {
      return 'Transaction cancelled by user'
    }
    
    // Generic error message for other errors
    return 'Failed to publish revocation. Please try again.'
  }

  // Check if the key is expired
  const isKeyExpired = displayMetadata?.expirationDate ? new Date() > displayMetadata.expirationDate : false
  
  const displayError = getErrorMessage(error)
  const hasAllRevokedOnBlockchain = processResult?.hasAllRevokedOnBlockchain ?? false

  // Log actual error to console for debugging
  if (error && !isLoading) {
    console.error('Revocation error:', error)
  }

  // Reset dismissed state when error changes
  React.useEffect(() => {
    setDismissedError(false)
  }, [error])

  // Show loading state while processing
  if (!displayMetadata || isProcessing) {
    return (
      <div className="revocation-display">
        <div className="key-info-section">
          <p className="loading-text">Processing the key...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="revocation-display">
      <div className="key-info-section">
        <h2 className="display-title">Public Key Information</h2>
        <div className="scrollable-content">
          {/* Primary Key Fingerprint */}
          <KeyFingerprint
            publicKey={displayMetadata?.mergedKey ?? publicKey}
            isRegistered={displayMetadata?.primaryKeyRegistered}
            primaryKeyRevocationState={displayMetadata?.primaryKeyRevocationState}
            expirationDate={displayMetadata?.expirationDate}
          />

          {/* User IDs */}
          {displayMetadata?.users && (
            <RevocationUserIDsList users={displayMetadata.users} />
          )}

          {/* Subkeys with revocation status */}
          <SubkeysListWithRevocation
            keyMetadata={displayMetadata}
            selectedSubkeyFingerprint={selectedSubkeyFingerprint}
            onSubkeySelect={setSelectedSubkeyFingerprint}
          />
        </div>

        {/* All revoked on blockchain message */}
        {hasAllRevokedOnBlockchain && !isLoading && (
          <div className="info-message success-message">
            <svg
              className="info-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="16 12 12 8 8 12"></polyline>
            </svg>
            <p>This key is already revoked on the blockchain. No action needed.</p>
          </div>
        )}

        {/* No revoked items message */}
        {displayMetadata &&
          !hasAllRevokedOnBlockchain &&
          displayMetadata.primaryKeyRevocationState === 'valid' &&
          displayMetadata.subkeys.every((sk) => sk.revocationState === 'valid') &&
          !isLoading && (
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

        {/* Error message - shown above action buttons */}
        {displayError && !isLoading && !dismissedError && (
          <div className="error-banner">
            <div className="error-content">
              <svg
                className="error-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p>{displayError}</p>
            </div>
            <button
              className="error-dismiss-btn"
              onClick={() => setDismissedError(true)}
              aria-label="Dismiss error"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Action buttons */}
        <RevocationActionButtons
          keyMetadata={displayMetadata ?? null}
          selectedSubkeyFingerprint={selectedSubkeyFingerprint}
          onPublishRevocation={handlePublishRevocation}
          onSuccessComplete={handleRevocationSuccess}
          isLoading={isRevoking}
          error={revocationError}
          hasAllRevokedOnBlockchain={hasAllRevokedOnBlockchain}
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

        .info-message.success-message {
          background-color: #dcfce7;
          border-color: #bbf7d0;
        }

        .info-message.success-message .info-icon {
          color: #166534;
        }

        .info-message.success-message p {
          color: #15803d;
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

        .error-banner {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          padding: 1rem;
          background-color: #fee2e2;
          border: 1px solid #fca5a5;
          border-radius: 0.375rem;
          margin-bottom: 1rem;
        }

        .error-content {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          flex: 1;
        }

        .error-banner .error-icon {
          flex-shrink: 0;
          width: 1.5rem;
          height: 1.5rem;
          color: #991b1b;
          margin-top: 0.125rem;
        }

        .error-banner p {
          margin: 0;
          font-size: 0.95rem;
          color: #7f1d1d;
          line-height: 1.5;
        }

        .error-dismiss-btn {
          flex-shrink: 0;
          background: none;
          border: none;
          color: #991b1b;
          cursor: pointer;
          padding: 0.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1.5rem;
          height: 1.5rem;
        }

        .error-dismiss-btn svg {
          width: 1.25rem;
          height: 1.25rem;
        }

        .error-dismiss-btn:hover {
          color: #7f1d1d;
          background-color: rgba(155, 27, 27, 0.1);
          border-radius: 0.25rem;
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
