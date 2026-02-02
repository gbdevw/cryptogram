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

  /**
   * Format expiration date
   */
  const getFormattedExpiration = (): string => {
    if (!metadata.expirationDate) {
      return 'Does not expire'
    }

    // Check if the date is valid
    if (isNaN(metadata.expirationDate.getTime())) {
      return 'Does not expire'
    }

    const now = new Date()
    if (metadata.expirationDate < now) {
      return `Expired on ${metadata.expirationDate.toISOString()}`
    }

    return metadata.expirationDate.toISOString()
  }

  // Reset dismissed state when error changes
  React.useEffect(() => {
    setDismissedError(false)
  }, [updateError])

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
          />

          {/* Expiration Date */}
          <div className="expiration-field">
            <span className="expiration-label">Expiration:</span>
            <span className="expiration-value">
              {getFormattedExpiration()}
            </span>
          </div>

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
        />
      </div>

      <style jsx>{`
        .update-display {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background-color: var(--bg-primary, #ffffff);
        }

        .key-info-section {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 2rem;
          padding-top: 1rem;
        }

        .display-title {
          margin: 0 0 1.5rem 0;
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary, #1f2937);
        }

        .scrollable-content {
          flex: 1;
          overflow-y: auto;
          padding-right: 0.5rem;
          margin-right: -0.5rem;
        }

        .scrollable-content::-webkit-scrollbar {
          width: 0.5rem;
        }

        .scrollable-content::-webkit-scrollbar-track {
          background: transparent;
        }

        .scrollable-content::-webkit-scrollbar-thumb {
          background: var(--border-color, #e5e7eb);
          border-radius: 0.25rem;
        }

        .scrollable-content::-webkit-scrollbar-thumb:hover {
          background: var(--border-hover, #d1d5db);
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

        @media (max-width: 640px) {
          .key-info-section {
            padding: 1rem;
          }

          .display-title {
            font-size: 1.25rem;
            margin-bottom: 1rem;
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
