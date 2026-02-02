import React, { useState, useEffect, useRef } from 'react'

interface UpdateActionButtonsProps {
  onUpdate: () => Promise<void>
  onBack: () => void
  isLoading?: boolean
  error?: string | null
  isKeyRevoked?: boolean
}

/**
 * Displays action buttons for updating key on blockchain
 * Handles transaction feedback and error states
 */
export function UpdateActionButtons({
  onUpdate,
  onBack,
  isLoading = false,
  error = null,
  isKeyRevoked = false,
}: UpdateActionButtonsProps) {
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

  const handleUpdate = async () => {
    setIsProcessing(true)
    setLocalError(null)
    setLocalSuccess(false)
    // Clear any pending success timeout
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current)
      successTimeoutRef.current = null
    }

    try {
      await onUpdate()
      setLocalSuccess(true)
      // Clear success message after 3 seconds, then go back
      successTimeoutRef.current = setTimeout(() => {
        setLocalSuccess(false)
        onBack()
      }, 2000)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to update key'
      setLocalError(errorMessage)
      setLocalSuccess(false)
    } finally {
      setIsProcessing(false)
    }
  }

  const isButtonLoading = isLoading || isProcessing

  return (
    <div className="update-action-buttons">
      {/* Error message */}
      {localError && (
        <div className="error-message">
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
          <p>{localError}</p>
          <button
            className="error-dismiss-button"
            onClick={() => setLocalError(null)}
            title="Dismiss error"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      )}

      {/* Success message */}
      {localSuccess && (
        <div className="success-message">
          <svg
            className="success-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <p>Key updated successfully!</p>
        </div>
      )}

      {/* Buttons */}
      <div className="buttons-container">
        <button
          className={`action-button primary ${localSuccess ? 'success' : ''} ${isKeyRevoked ? 'disabled' : ''}`}
          onClick={handleUpdate}
          disabled={isButtonLoading || localSuccess || isKeyRevoked}
          title={isKeyRevoked ? 'Cannot update a revoked key' : 'Update key on blockchain'}
        >
          {isButtonLoading ? (
            <>
              <span className="spinner"></span>
              <span>Updating...</span>
            </>
          ) : localSuccess ? (
            <>
              <svg
                className="success-checkmark"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Updated</span>
            </>
          ) : (
            <>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 2.2" />
              </svg>
              <span>Update Key</span>
            </>
          )}
        </button>
      </div>

      <style jsx>{`
        .update-action-buttons {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border-color, #e5e7eb);
        }

        .error-message {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 1rem;
          background-color: var(--error-bg, #fee2e2);
          border: 1px solid #fecaca;
          border-radius: 0.5rem;
          color: var(--error-text, #991b1b);
          position: relative;
        }

        .error-icon {
          width: 1.25rem;
          height: 1.25rem;
          flex-shrink: 0;
          margin-top: 0.125rem;
        }

        .error-message p {
          margin: 0;
          flex: 1;
          font-size: 0.9rem;
        }

        .error-dismiss-button {
          flex-shrink: 0;
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.2s;
        }

        .error-dismiss-button:hover {
          opacity: 0.7;
        }

        .error-dismiss-button svg {
          width: 1.25rem;
          height: 1.25rem;
        }

        .success-message {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background-color: #dcfce7;
          border: 1px solid #86efac;
          border-radius: 0.5rem;
          color: #166534;
        }

        .success-icon {
          width: 1.25rem;
          height: 1.25rem;
          flex-shrink: 0;
        }

        .success-message p {
          margin: 0;
          font-size: 0.9rem;
          font-weight: 500;
        }

        .buttons-container {
          display: flex;
          gap: 0.75rem;
        }

        .action-button {
          flex: 1;
          padding: 0.75rem 1.5rem;
          font-size: 0.95rem;
          font-weight: 600;
          border-radius: 0.375rem;
          border: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: all 0.2s;
        }

        .action-button.primary {
          background-color: #3b82f6;
          color: white;
        }

        .action-button.primary:hover:not(:disabled) {
          background-color: #2563eb;
        }

        .action-button.primary:active:not(:disabled) {
          transform: scale(0.98);
        }

        .action-button.primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .action-button.primary.success {
          background-color: #10b981;
        }

        .action-button.secondary {
          background-color: var(--bg-secondary, #f3f4f6);
          color: var(--text-primary, #1f2937);
          border: 1px solid var(--border-color, #d1d5db);
        }

        .action-button.secondary:hover:not(:disabled) {
          background-color: var(--bg-hover, #e5e7eb);
        }

        .action-button.secondary:active:not(:disabled) {
          transform: scale(0.98);
        }

        .action-button.secondary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spinner {
          width: 1rem;
          height: 1rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        .success-checkmark {
          width: 1.25rem;
          height: 1.25rem;
        }

        .action-button svg {
          width: 1.25rem;
          height: 1.25rem;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 640px) {
          .buttons-container {
            flex-direction: column;
          }

          .action-button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
