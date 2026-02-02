import { useState } from 'react'
import { PublicKey } from 'openpgp'
import { RevokeCertificateInput } from '../components/RevokeCertificateInput'
import { FingerPrintVerificationInput } from '../components/FingerPrintVerificationInput'
import { RevocationDisplay } from '../components/RevocationDisplay'

type RevokeScreen = 'provide-input' | 'verify-certificate' | 'review'

/**
 * Revoke page - orchestrates the multi-screen workflow for key revocation
 * Screen 1: Import revocation certificate or public key with revoked items
 * Screen 1b: Verify standalone revocation certificate with fingerprint
 * Screen 2: Display key info and handle revocation publication
 */
function RevokePage() {
  const [currentScreen, setCurrentScreen] = useState<RevokeScreen>('provide-input')
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null)
  const [certificate, setCertificate] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  /**
   * Handle successful public key import (key with revoked items)
   */
  const handlePublicKeyLoaded = (key: PublicKey) => {
    setPublicKey(key)
    setCertificate(null)
    setImportError(null)
    setCurrentScreen('review')
  }

  /**
   * Handle standalone revocation certificate import
   */
  const handleCertificateLoaded = (cert: string) => {
    setCertificate(cert)
    setImportError(null)
    setCurrentScreen('verify-certificate')
  }

  /**
   * Handle successful revocation verification
   */
  const handleRevocationVerified = (key: PublicKey) => {
    setPublicKey(key)
    setImportError(null)
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
    setCertificate(null)
    setImportError(null)
  }

  return (
    <div className="revoke-page">
      {currentScreen === 'provide-input' ? (
        // Screen 1: Import revocation certificate or public key
        <RevokeCertificateInput
          onPublicKeySubmit={handlePublicKeyLoaded}
          onCertificateSubmit={handleCertificateLoaded}
          onError={handleImportError}
        />
      ) : currentScreen === 'verify-certificate' && certificate ? (
        // Screen 1b: Verify standalone revocation certificate
        <div className="revoke-screen-wrapper">
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
          <FingerPrintVerificationInput
            certificate={certificate}
            onVerify={handleRevocationVerified}
            onError={handleImportError}
          />
        </div>
      ) : publicKey ? (
        // Screen 2: Review and revoke
        <div className="revoke-screen-wrapper">
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
          <RevocationDisplay publicKey={publicKey} />
        </div>
      ) : null}

      <style jsx>{`
        .revoke-page {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .revoke-screen-wrapper {
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

export default RevokePage
