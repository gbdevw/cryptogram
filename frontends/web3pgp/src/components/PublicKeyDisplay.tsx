import React from 'react'
import { PublicKey } from 'openpgp'
import { KeyFingerprint } from './KeyFingerprint'
import { UserIDsList } from './UserIDsList'
import { SubkeysList } from './SubkeysList'
import { KeyActionButtons } from './KeyActionButtons'

interface PublicKeyDisplayProps {
  publicKey: PublicKey
  onCopySuccess?: () => void
  onDownloadSuccess?: () => void
}

/**
 * Wrapper component that displays all public key information
 * Combines fingerprint, user IDs, subkeys, and action buttons
 */
export function PublicKeyDisplay({
  publicKey,
  onCopySuccess,
  onDownloadSuccess,
}: PublicKeyDisplayProps) {
  const [expirationDate, setExpirationDate] = React.useState<Date | null>(null)

  // Extract expiration date on mount
  React.useEffect(() => {
    const extractExpirationDate = async () => {
      try {
        const expirationTime = await publicKey.getExpirationTime()
        if (expirationTime && typeof expirationTime === 'number') {
          setExpirationDate(new Date(expirationTime * 1000))
        } else {
          setExpirationDate(expirationTime as Date | null)
        }
      } catch (err) {
        console.warn('Failed to get key expiration date:', err)
      }
    }
    extractExpirationDate()
  }, [publicKey])

  const handleActionSuccess = (action: 'copy' | 'download') => {
    if (action === 'copy') {
      onCopySuccess?.()
    } else if (action === 'download') {
      onDownloadSuccess?.()
    }
  }

  return (
    <div className="public-key-display">
      <div className="key-info-section">
        <h2 className="display-title">Public Key Information</h2>
        <div className="scrollable-content">
          <KeyFingerprint publicKey={publicKey} expirationDate={expirationDate} />
          <UserIDsList publicKey={publicKey} />
          <SubkeysList publicKey={publicKey} primaryExpirationDate={expirationDate} />
        </div>
        <div className="action-buttons-container">
          <KeyActionButtons
            publicKey={publicKey}
            onSuccess={handleActionSuccess}
          />
        </div>
      </div>

      <style jsx>{`
        .public-key-display {
          animation: fadeIn 0.3s ease-out;
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
        }

        .key-info-section {
          padding: 1.5rem;
          background-color: white;
          border-radius: 0.5rem;
          border: 1px solid var(--border-color, #e5e7eb);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
        }

        .scrollable-content {
          overflow-y: auto;
          flex: 1;
          padding-right: 0.5rem;
        }

        .scrollable-content::-webkit-scrollbar {
          width: 8px;
        }

        .scrollable-content::-webkit-scrollbar-track {
          background: var(--bg-secondary, #f9fafb);
          border-radius: 4px;
        }

        .scrollable-content::-webkit-scrollbar-thumb {
          background: var(--border-color, #d1d5db);
          border-radius: 4px;
        }

        .scrollable-content::-webkit-scrollbar-thumb:hover {
          background: #999;
        }

        .display-title {
          margin: 0 0 1.5rem 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary, #1f2937);
          flex-shrink: 0;
        }

        .action-buttons-container {
          display: flex;
          gap: 1rem;
          margin-top: auto;
          padding-top: 1.5rem;
          flex-shrink: 0;
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

        @keyframes fadeIn {
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
          .key-info-section {
            padding: 1rem;
          }

          .display-title {
            font-size: 1.1rem;
            margin-bottom: 1.25rem;
          }
        }
      `}</style>
    </div>
  )
}
