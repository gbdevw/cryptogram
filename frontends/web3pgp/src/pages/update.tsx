import { useState } from 'react'
import { PublicKey } from 'openpgp'
import { UpdateKeyInput } from '../components/UpdateKeyInput'
import { UpdateDisplay } from '../components/UpdateDisplay'
import { useProcessUpdateKey } from '../hooks/useProcessUpdateKey'
import { useWeb3PGPStatus } from '../contexts/Web3PGPContext'

type UpdateScreen = 'provide-input' | 'review'

/**
 * Update page - orchestrates the workflow for updating registered keys
 * Screen 1: Import public key
 * Screen 2: Display merged key info and handle update publication
 */
function UpdatePage() {
  const [currentScreen, setCurrentScreen] = useState<UpdateScreen>('provide-input')
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const { isLoading: isServiceLoading, error: serviceError } = useWeb3PGPStatus()

  const {
    result: processResult,
    isLoading: isProcessing,
    error: processError,
    isServiceReady: isProcessServiceReady,
    processKey,
  } = useProcessUpdateKey()

  /**
   * Handle successful public key import
   */
  const handlePublicKeyLoaded = (key: PublicKey) => {
    setPublicKey(key)
    setImportError(null)
    // Process the key immediately
    processKey(key)
    setCurrentScreen('review')
  }

  /**
   * Handle import error
   */
  const handleImportError = (error: string) => {
    setImportError(error)
  }

  /**
   * Reset to first screen
   */
  const handleBackToImport = () => {
    setCurrentScreen('provide-input')
    setPublicKey(null)
    setImportError(null)
  }

  return (
    <div className="update-page">
      {currentScreen === 'provide-input' ? (
        // Screen 1: Import public key
        <UpdateKeyInput
          onKeySubmit={handlePublicKeyLoaded}
          onError={handleImportError}
          isLoading={isProcessing}
        />
      ) : isServiceLoading && !isProcessServiceReady ? (
        // Show loading state while service initializes
        <div className="update-screen-wrapper">
          <button className="back-button" onClick={handleBackToImport}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Back</span>
          </button>
          <div className="loading-container">
            <div className="spinner"></div>
            <p className="loading-text">Initializing Web3PGP service...</p>
          </div>
        </div>
      ) : serviceError ? (
        // Show error state if service initialization failed
        <div className="update-screen-wrapper">
          <button className="back-button" onClick={handleBackToImport}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Back</span>
          </button>
          <div className="error-container">
            <h2>Error</h2>
            <p>Failed to initialize Web3PGP service. Please refresh the page.</p>
          </div>
        </div>
      ) : processResult ? (
        // Screen 2: Review and update
        <div className="update-screen-wrapper">
          <button className="back-button" onClick={handleBackToImport}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Back</span>
          </button>
          <UpdateDisplay metadata={processResult} />
        </div>
      ) : isProcessing ? (
        // Loading state
        <div className="update-screen-wrapper">
          <button className="back-button" onClick={handleBackToImport}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Back</span>
          </button>
          <div className="loading-container">
            <div className="spinner"></div>
            <p className="loading-text">Processing key...</p>
            {processError && (
              <p className="error-text">{processError}</p>
            )}
          </div>
        </div>
      ) : processError ? (
        // Error state (when processing fails)
        <div className="update-screen-wrapper">
          <button className="back-button" onClick={handleBackToImport}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Back</span>
          </button>
          <div className="error-screen">
            <svg
              className="error-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <p className="error-message">{processError}</p>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .update-page {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .update-screen-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .back-button {
          position: absolute;
          top: 1rem;
          right: 1rem;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background-color: white;
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 0.5rem;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-primary, #1f2937);
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-button:hover {
          background-color: var(--bg-secondary, #f9fafb);
          border-color: var(--border-hover, #d1d5db);
        }

        .back-button:active {
          transform: scale(0.95);
        }

        .back-button svg {
          width: 1.25rem;
          height: 1.25rem;
        }

        .loading-container,
        .error-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          padding: 2rem;
          text-align: center;
        }

        .error-container {
          background-color: var(--bg-secondary, #f9fafb);
          border: 2px solid #ef4444;
          border-radius: 0.5rem;
        }

        .error-container h2 {
          color: #dc2626;
          margin: 0;
        }

        .error-container p {
          color: var(--text-secondary, #6b7280);
          margin: 0.5rem 0 0;
        }

        .spinner {
          width: 2rem;
          height: 2rem;
          border: 3px solid var(--spinner-bg, #e5e7eb);
          border-top-color: var(--primary-color, #0ea5e9);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .loading-text {
          margin: 0;
          color: var(--text-secondary, #6b7280);
        }

        .error-text {
          margin: 0.5rem 0 0;
          color: #dc2626;
          font-size: 0.9rem;
        }
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          padding: 2rem;
        }

        .spinner {
          width: 2.5rem;
          height: 2.5rem;
          border: 3px solid #e5e7eb;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loading-text {
          margin: 0;
          font-size: 1rem;
          color: var(--text-secondary, #6b7280);
          font-weight: 500;
        }

        .error-text {
          margin: 0;
          font-size: 0.95rem;
          color: var(--error-text, #991b1b);
          background-color: var(--error-bg, #fee2e2);
          padding: 0.75rem 1rem;
          border-radius: 0.375rem;
          max-width: 500px;
          text-align: center;
        }

        .error-screen {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          padding: 2rem;
          max-width: 900px;
          margin: 0 auto;
          width: 100%;
        }

        .error-icon {
          width: 3.5rem;
          height: 3.5rem;
          color: var(--warning-color, #d97706);
          flex-shrink: 0;
        }

        .error-message {
          margin: 0;
          font-size: 1rem;
          color: var(--text-primary, #1f2937);
          line-height: 1.6;
          text-align: left;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 640px) {
          .back-button {
            padding: 0.5rem;
            font-size: 0.9rem;
          }

          .back-button span {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}

export default UpdatePage
