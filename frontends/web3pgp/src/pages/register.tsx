import { useState } from 'react'
import { PublicKey } from 'openpgp'
import { PublicKeyImportForm } from '../components/PublicKeyImportForm'
import { RegistrationDisplay } from '../components/RegistrationDisplay'
import { useWeb3PGPStatus } from '../contexts/Web3PGPContext'

type RegisterScreen = 'provide-key' | 'register'

/**
 * Register page - orchestrates the two-screen workflow for key registration
 * Screen 1: Import public key (paste or file upload)
 * Screen 2: Display key info and handle registration
 */
function RegisterPage() {
  const [currentScreen, setCurrentScreen] = useState<RegisterScreen>('provide-key')
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const { isLoading: isServiceLoading, error: serviceError } = useWeb3PGPStatus()

  /**
   * Handle successful public key import from Screen 1
   */
  const handlePublicKeyLoaded = (key: PublicKey) => {
    setPublicKey(key)
    setImportError(null)
    setCurrentScreen('register')
  }

  /**
   * Handle import error from Screen 1
   */
  const handleImportError = (error: string) => {
    setImportError(error)
  }

  /**
   * Reset to first screen
   */
  const handleBackToImport = () => {
    setCurrentScreen('provide-key')
    setPublicKey(null)
    setImportError(null)
  }

  return (
    <div className="register-page">
      {currentScreen === 'provide-key' ? (
        // Screen 1: Import Public Key
        <PublicKeyImportForm
          onPublicKeyLoaded={handlePublicKeyLoaded}
          onError={handleImportError}
        />
      ) : isServiceLoading ? (
        // Show loading state while service initializes
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Initializing Web3PGP service...</p>
        </div>
      ) : serviceError ? (
        // Show error state if service initialization failed
        <div className="error-container">
          <h2>Error</h2>
          <p>Failed to initialize Web3PGP service. Please refresh the page.</p>
        </div>
      ) : publicKey ? (
        // Screen 2: Registration Display
        <div className="register-screen-wrapper">
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
          <RegistrationDisplay publicKey={publicKey} />
        </div>
      ) : null}

      <style jsx>{`
        .register-page {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
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
          margin: 2rem;
        }

        .error-container h2 {
          color: #dc2626;
          margin: 0;
        }

        .error-container p {
          color: var(--text-secondary, #6b7280);
          margin: 0.5rem 0 0;
        }

        .loading-spinner {
          width: 2.5rem;
          height: 2.5rem;
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

        .register-screen-wrapper {
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

export default RegisterPage
