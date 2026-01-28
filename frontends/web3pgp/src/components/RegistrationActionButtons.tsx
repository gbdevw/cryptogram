import React, { useState, useEffect, useRef } from 'react'
import { PublicKey } from 'openpgp'

interface RegistrationActionButtonsProps {
  publicKey: PublicKey
  primaryKeyRegistered: boolean
  selectedSubkeyFingerprint: string | null
  selectableSubkeysAvailable: boolean
  onRegisterPrimaryKey: () => Promise<void>
  onRegisterSubkey: (fingerprint: string) => Promise<void>
  isLoading?: boolean
  error?: string | null
}

/**
 * Displays action buttons for registering primary keys or subkeys
 * Handles wallet connection validation and transaction feedback
 */
export function RegistrationActionButtons({
  publicKey,
  primaryKeyRegistered,
  selectedSubkeyFingerprint,
  selectableSubkeysAvailable,
  onRegisterPrimaryKey,
  onRegisterSubkey,
  isLoading = false,
  error = null,
}: RegistrationActionButtonsProps) {
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

  const handleRegisterPrimaryKey = async () => {
    setIsProcessing(true)
    setLocalError(null)
    setLocalSuccess(false)
    // Clear any pending success timeout
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current)
      successTimeoutRef.current = null
    }

    try {
      await onRegisterPrimaryKey()
      setLocalSuccess(true)
      // Clear success message after 3 seconds
      successTimeoutRef.current = setTimeout(() => setLocalSuccess(false), 3000)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to register primary key'
      setLocalError(errorMessage)
      setLocalSuccess(false)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRegisterSubkey = async () => {
    if (!selectedSubkeyFingerprint) return

    setIsProcessing(true)
    setLocalError(null)
    setLocalSuccess(false)
    // Clear any pending success timeout
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current)
      successTimeoutRef.current = null
    }

    try {
      await onRegisterSubkey(selectedSubkeyFingerprint)
      setLocalSuccess(true)
      // Clear success message after 3 seconds
      successTimeoutRef.current = setTimeout(() => setLocalSuccess(false), 3000)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to register subkey'
      setLocalError(errorMessage)
      setLocalSuccess(false)
    } finally {
      setIsProcessing(false)
    }
  }

  const isButtonLoading = isLoading || isProcessing

  return (
    <div className="registration-action-buttons">
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

      {/* Buttons */}
      <div className="buttons-container">
        {!primaryKeyRegistered ? (
          // Primary key not registered - show register primary button
          <button
            className={`action-button primary ${localSuccess ? 'success' : ''}`}
            onClick={handleRegisterPrimaryKey}
            disabled={isButtonLoading || localSuccess}
          >
            {isButtonLoading ? (
              <>
                <span className="spinner"></span>
                <span>Registering...</span>
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
                <span>Public Key Registered!</span>
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
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span>Register the public key and its subkeys</span>
              </>
            )}
          </button>
        ) : (
          // Primary key registered - show subkey registration if available
          <>
            {selectableSubkeysAvailable ? (
              <div className="subkey-registration">
                <button
                  className={`action-button ${
                    selectedSubkeyFingerprint ? 'primary' : 'secondary'
                  } ${localSuccess ? 'success' : ''}`}
                  onClick={handleRegisterSubkey}
                  disabled={isButtonLoading || !selectedSubkeyFingerprint || localSuccess}
                >
                  {isButtonLoading ? (
                    <>
                      <span className="spinner"></span>
                      <span>Registering...</span>
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
                      <span>Subkey Registered!</span>
                    </>
                  ) : selectedSubkeyFingerprint ? (
                    <>
                      <svg
                        className="button-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      <span>Register the selected subkey</span>
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
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      <span>Select a subkey to register</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <p className="info-message">
                All subkeys are already registered or unavailable
              </p>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        .registration-action-buttons {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-top: auto;
          padding-top: 1.5rem;
          flex-shrink: 0;
        }

        .error-message {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 1rem;
          background-color: var(--error-bg, #fef2f2);
          border: 1px solid var(--error-color, #ef4444);
          border-radius: 0.5rem;
          color: var(--error-text, #991b1b);
        }

        .error-icon {
          flex-shrink: 0;
          width: 1.25rem;
          height: 1.25rem;
          color: var(--error-color, #ef4444);
          margin-top: 0.125rem;
        }

        .error-message p {
          margin: 0;
          font-size: 0.9rem;
          flex: 1;
        }

        .error-dismiss-button {
          flex-shrink: 0;
          margin-left: auto;
          background: none;
          border: none;
          color: var(--error-color, #ef4444);
          cursor: pointer;
          padding: 0.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          transition: all 0.2s;
        }

        .error-dismiss-button:hover {
          opacity: 0.7;
          transform: scale(1.1);
        }

        .error-dismiss-button svg {
          width: 1rem;
          height: 1rem;
        }

        .buttons-container {
          display: flex;
          gap: 1rem;
          flex-direction: column;
        }

        .action-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 0.875rem 1.5rem;
          border: none;
          border-radius: 0.5rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
        }

        .action-button.primary {
          background-color: #667eea;
          color: white;
        }

        .action-button.primary:hover:not(:disabled) {
          background-color: #5568d3;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .action-button.secondary {
          background-color: var(--bg-secondary, #f3f4f6);
          color: var(--text-primary, #1f2937);
          border: 2px solid var(--border-color, #e5e7eb);
        }

        .action-button.secondary:hover:not(:disabled) {
          background-color: var(--bg-hover, #e5e7eb);
          border-color: var(--border-hover, #d1d5db);
        }

        .action-button.secondary.active {
          background-color: rgba(102, 126, 234, 0.1);
          border-color: #667eea;
          color: #667eea;
        }

        .action-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .action-button:active:not(:disabled) {
          transform: translateY(0);
        }
        .action-button.success {
          background-color: #10b981 !important;
          border-color: #10b981 !important;
          color: white !important;
          cursor: default;
        }

        .action-button.success:hover {
          background-color: #10b981 !important;
          transform: none !important;
          box-shadow: none !important;
        }
        .button-icon {
          width: 1.25rem;
          height: 1.25rem;
          flex-shrink: 0;
        }

        .spinner {
          display: inline-block;
          width: 1.25rem;
          height: 1.25rem;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          opacity: 0.6;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .subkey-registration {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          flex: 1;
        }

        .help-text {
          margin: 0;
          font-size: 0.85rem;
          color: var(--text-secondary, #6b7280);
          font-style: italic;
          text-align: center;
        }

        .info-message {
          margin: 0;
          padding: 1rem;
          background-color: var(--bg-secondary, #f9fafb);
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 0.5rem;
          font-size: 0.95rem;
          color: var(--text-secondary, #6b7280);
          text-align: center;
        }

        @media (max-width: 640px) {
          .action-button {
            width: 100%;
            padding: 0.75rem 1.25rem;
            font-size: 0.95rem;
          }

          .button-icon {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
