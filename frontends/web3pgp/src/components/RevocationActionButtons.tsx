import React, { useState, useEffect, useRef } from 'react'
import { KeyMetadata } from '../types/revocation'

interface RevocationActionButtonsProps {
  keyMetadata: KeyMetadata | null
  selectedSubkeyFingerprint: string | null
  onPublishRevocation: () => Promise<void>
  onSuccessComplete?: () => void
  isLoading?: boolean
  error?: string | null
  hasAllRevokedOnBlockchain?: boolean
}

/**
 * Displays action buttons for revoking primary keys or subkeys
 * Handles transaction feedback and state management
 */
export function RevocationActionButtons({
  keyMetadata,
  selectedSubkeyFingerprint,
  onPublishRevocation,
  onSuccessComplete,
  isLoading = false,
  error = null,
  hasAllRevokedOnBlockchain = false,
}: RevocationActionButtonsProps) {
  const [localError, setLocalError] = useState<string | null>(null)
  const [localSuccess, setLocalSuccess] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setLocalError(error || null)
    // Clear success message when error is set from parent
    if (error) {
      setLocalSuccess(false)
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current)
        successTimeoutRef.current = null
      }
    }
  }, [error])

  const handlePublishRevocation = async () => {
    setIsProcessing(true)
    setLocalError(null)
    setLocalSuccess(false)
    // Clear any pending success timeout
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current)
      successTimeoutRef.current = null
    }

    try {
      await onPublishRevocation()
      setLocalSuccess(true)
      // Clear success message after 3 seconds and call success callback
      successTimeoutRef.current = setTimeout(() => {
        setLocalSuccess(false)
        onSuccessComplete?.()
      }, 3000)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to publish revocation'
      setLocalError(errorMessage)
      setLocalSuccess(false)
    } finally {
      setIsProcessing(false)
    }
  }

  if (!keyMetadata) {
    return null
  }

  const isButtonLoading = isLoading || isProcessing

  // Determine button state and text based on revocation state
  let buttonLabel = ''
  let isDisabled = false
  let buttonVariant: 'primary' | 'disabled' = 'primary'

  if (hasAllRevokedOnBlockchain) {
    // Already revoked on blockchain
    buttonLabel = 'Already revoked on blockchain'
    isDisabled = true
    buttonVariant = 'disabled'
  } else if (keyMetadata.primaryKeyRevocationState === 'to-revoke') {
    // Primary key is marked for revocation
    const toRevokeSubkeys = keyMetadata.subkeys.filter(
      (sk) => sk.revocationState === 'to-revoke'
    )
    buttonLabel =
      toRevokeSubkeys.length > 0
        ? 'Publish revocation for key and its subkeys'
        : 'Publish revocation for key'
    isDisabled = false
  } else {
    // No primary key revocation, check subkeys
    const toRevokeSubkeys = keyMetadata.subkeys.filter(
      (sk) =>
        sk.revocationState === 'to-revoke' &&
        sk.registrationState === 'registered'
    )

    if (toRevokeSubkeys.length === 0) {
      // No revokable items
      buttonLabel = 'No items to revoke'
      isDisabled = true
      buttonVariant = 'disabled'
    } else if (selectedSubkeyFingerprint) {
      // Subkey selected
      buttonLabel = 'Publish revocation for this subkey'
      isDisabled = false
    } else {
      // Subkeys available but not selected
      buttonLabel = 'Select a subkey to revoke'
      isDisabled = true
      buttonVariant = 'disabled'
    }
  }

  const hasError = !!localError
  const showSuccess = localSuccess && !hasError

  return (
    <div className="revocation-action-buttons">
      {/* Success message */}
      {showSuccess }

      {/* Action button */}
      <button
        className={`action-button ${buttonVariant} ${localSuccess ? 'success' : ''}`}
        onClick={handlePublishRevocation}
        disabled={isDisabled || isButtonLoading}
      >
        {isButtonLoading ? (
          <>
            <span className="spinner"></span>
            <span>Publishing revocation...</span>
          </>
        ) : localSuccess ? (
          <>
            <svg
              className="button-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Revocation published</span>
          </>
        ) : (
          <>
            <svg
              className="button-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5m5 0v5m-5-5v5" />
              <path d="M9 14v2" />
              <path d="M9 9v2" />
            </svg>
            <span>{buttonLabel}</span>
          </>
        )}
      </button>

      <style jsx>{`
        .revocation-action-buttons {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          flex-shrink: 0;
          margin-top: auto;
        }

        .success-container {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background-color: #dcfce7;
          border: 1px solid #86efac;
          border-radius: 0.375rem;
          animation: slideUp 0.3s ease-out;
        }

        .success-icon {
          flex-shrink: 0;
          width: 1.25rem;
          height: 1.25rem;
          color: #16a34a;
        }

        .success-message {
          margin: 0;
          font-size: 0.95rem;
          color: #166534;
          font-weight: 500;
          line-height: 1.5;
        }

        .error-container {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 1rem;
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 0.375rem;
          animation: slideUp 0.3s ease-out;
        }

        .error-icon {
          flex-shrink: 0;
          width: 1.25rem;
          height: 1.25rem;
          color: #dc2626;
          margin-top: 0.125rem;
        }

        .error-message {
          margin: 0;
          font-size: 0.95rem;
          color: #991b1b;
          line-height: 1.5;
        }

        .action-button {
          padding: 1rem;
          border: none;
          border-radius: 0.5rem;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          transition: all 0.2s;
        }

        .action-button.primary {
          background-color: #dc2626;
          color: white;
        }

        .action-button.primary:hover:not(:disabled) {
          background-color: #b91c1c;
          transform: translateY(-1px);
          box-shadow: 0 4px 6px rgba(220, 38, 38, 0.2);
        }

        .action-button.primary:active:not(:disabled) {
          transform: translateY(0);
        }

        .action-button.disabled {
          background-color: var(--border-color, #e5e7eb);
          color: var(--text-disabled, #9ca3af);
          cursor: not-allowed;
        }

        .action-button.success {
          background-color: #22c55e;
          border-color: #16a34a;
          color: white;
        }

        .action-button.success:hover {
          background-color: #16a34a;
        }

        .button-icon {
          width: 1.25rem;
          height: 1.25rem;
          flex-shrink: 0;
        }

        .spinner {
          display: inline-block;
          width: 1rem;
          height: 1rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes slideUp {
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
          .action-button {
            padding: 0.875rem;
            font-size: 0.95rem;
          }

          .button-icon {
            width: 1.125rem;
            height: 1.125rem;
          }
        }
      `}</style>
    </div>
  )
}
