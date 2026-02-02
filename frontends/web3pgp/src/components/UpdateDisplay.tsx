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
