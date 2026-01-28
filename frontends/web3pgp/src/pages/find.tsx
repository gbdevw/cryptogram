import { useState } from 'react'
import { FingerprintSearchForm } from '../components/FingerprintSearchForm'
import { PublicKeyDisplay } from '../components/PublicKeyDisplay'
import { ErrorMessage } from '../components/ErrorMessage'
import { useFetchPublicKey } from '../hooks/useFetchPublicKey'

function FindPage() {
  const { publicKey, isLoading, error, fetchPublicKey, reset } = useFetchPublicKey()
  const [showError, setShowError] = useState(true)

  const handleSearch = async (fingerprint: string) => {
    setShowError(true)
    await fetchPublicKey(fingerprint)
  }

  const handleDismissError = () => {
    setShowError(false)
  }

  return (
    <div className="find-page">
      <div className="page-header">
        <h1 className="page-title">Find Public Key</h1>
        <p className="page-description">
          Search for public keys in the Web3PGP infrastructure by fingerprint.
        </p>
      </div>

      <div className="page-content">
        <FingerprintSearchForm
          onSearch={handleSearch}
          isLoading={isLoading}
        />

        {isLoading && (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p className="loading-text">Fetching public key...</p>
          </div>
        )}

        {error && showError && !isLoading && (
          <ErrorMessage
            errorType={error as 'not-found' | 'service-error' | 'invalid-input'}
            onDismiss={handleDismissError}
          />
        )}

        {publicKey && !isLoading && (
          <PublicKeyDisplay publicKey={publicKey} />
        )}
      </div>

      <style jsx>{`
        .find-page {
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
          padding: 2rem 1rem;
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .page-header {
          margin-bottom: 2.5rem;
          flex-shrink: 0;
        }

        .page-title {
          margin: 0 0 0.75rem 0;
          font-size: 2rem;
          font-weight: 700;
          color: var(--text-primary, #1f2937);
        }

        .page-description {
          margin: 0;
          font-size: 1rem;
          color: var(--text-secondary, #6b7280);
          line-height: 1.6;
        }

        .page-content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          flex: 1;
          overflow: hidden;
          min-height: 0;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 3rem 1rem;
          text-align: center;
        }

        .loading-spinner {
          width: 2.5rem;
          height: 2.5rem;
          border: 3px solid var(--spinner-bg, #e5e7eb);
          border-top-color: var(--primary-color, #0ea5e9);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loading-text {
          margin: 0;
          font-size: 1rem;
          color: var(--text-secondary, #6b7280);
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .empty-state {
          padding: 3rem 1rem;
          text-align: center;
          background-color: var(--bg-secondary, #f9fafb);
          border: 2px dashed var(--border-color, #d1d5db);
          border-radius: 0.5rem;
        }

        .empty-message {
          margin: 0;
          font-size: 1rem;
          color: var(--text-secondary, #6b7280);
        }

        @media (max-width: 640px) {
          .find-page {
            padding: 1rem 0.5rem;
          }

          .page-header {
            margin-bottom: 1.5rem;
          }

          .page-title {
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
          }

          .page-description {
            font-size: 0.95rem;
          }
        }
      `}</style>
    </div>
  )
}
export default FindPage