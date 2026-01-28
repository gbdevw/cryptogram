import { useState } from 'react'
import { PublicKey } from 'openpgp'
import { PublicKeyImportForm } from '../components/PublicKeyImportForm'
import { RegistrationDisplay } from '../components/RegistrationDisplay'

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
