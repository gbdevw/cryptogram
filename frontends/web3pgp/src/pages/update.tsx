import { useState } from 'react'
import { PublicKey } from 'openpgp'
import { UpdateKeyInput } from '../components/UpdateKeyInput'
import { UpdateDisplay } from '../components/UpdateDisplay'
import { useProcessUpdateKey } from '../hooks/useProcessUpdateKey'

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

  const {
    result: processResult,
    isLoading: isProcessing,
    error: processError,
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
          padding-top: 4rem;
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
          font-weight: 500;
          color: var(--text-primary, #1f2937);
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-button:hover {
          background-color: var(--bg-secondary, #f9fafb);
          border-color: var(--border-hover, #d1d5db);
        }

        .back-button:active {
          transform: scale(0.98);
        }

        .back-button svg {
          width: 1.25rem;
          height: 1.25rem;
        }

        .loading-container {
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

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 640px) {
          .back-button {
            top: 0.75rem;
            right: 0.75rem;
            padding: 0.5rem 0.75rem;
            font-size: 0.85rem;
          }

          .loading-container {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  )
}

export default UpdatePage
