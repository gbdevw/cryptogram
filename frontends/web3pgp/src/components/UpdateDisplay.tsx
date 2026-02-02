import React, { useEffect, useState } from 'react'
import { PublicKey } from 'openpgp'
import { KeyFingerprint } from './KeyFingerprint'
import { UpdateUserIDsList } from './UpdateUserIDsList'
import { UpdateActionButtons } from './UpdateActionButtons'
import { useUpdatePublicKey } from '../hooks/useUpdatePublicKey'
import { UpdateKeyMetadata } from '../hooks/useProcessUpdateKey'

interface UpdateDisplayProps {
  metadata: UpdateKeyMetadata
}

/**
 * Displays the merged key information from update workflow
 * Shows primary key fingerprint, status, expiration date, and user IDs
 * Handles the update transaction
 */
export function UpdateDisplay({ metadata }: UpdateDisplayProps) {
  const {
    isLoading: isUpdating,
    error: updateError,
    updateKey,
    reset: resetUpdateState,
  } = useUpdatePublicKey()

  const [dismissedError, setDismissedError] = useState(false)

  /**
   * Handle key update
   */
  const handlePublishUpdate = async () => {
    try {
      await updateKey(metadata.mergedKey)
    } catch (error) {
      console.error('Error publishing update:', error)
      throw error
    }
  }

  // Reset dismissed state when error changes
  React.useEffect(() => {
    setDismissedError(false)
  }, [updateError])

  // Check if the key is expired
  const isKeyExpired = metadata.expirationDate ? new Date() > metadata.expirationDate : false

  return (
    <div className="update-display">
      <div className="key-info-section">
        <h2 className="display-title">Updated Key Information</h2>
        <div className="scrollable-content">
          {/* Primary Key Fingerprint */}
          <KeyFingerprint
            publicKey={metadata.mergedKey}
            isRegistered={metadata.primaryKeyRegistered}
            primaryKeyRevocationState={metadata.primaryKeyRevocationState}
            expirationDate={metadata.expirationDate}
          />

          {/* User IDs */}
          <UpdateUserIDsList users={metadata.users} />
        </div>

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

        {/* Action Buttons */}
        <UpdateActionButtons
          onUpdate={handlePublishUpdate}
          onBack={() => {
            // Reset state for potential new update
            resetUpdateState()
          }}
          isLoading={isUpdating}
          error={
            dismissedError || !updateError ? null : updateError
          }
          isKeyRevoked={metadata.primaryKeyRevocationState === 'already-revoked'}
          isKeyExpired={isKeyExpired}
        />
      </div>

      <style jsx>{`
        .update-display {
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
