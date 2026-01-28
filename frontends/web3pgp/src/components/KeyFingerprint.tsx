import React, { useEffect, useState } from 'react'
import { PublicKey } from 'openpgp'

interface KeyFingerprintProps {
  publicKey: PublicKey
  isRegistered?: boolean
}

type KeyStatus = 'valid' | 'revoked' | 'expired'

/**
 * Displays the primary key fingerprint in a formatted, readable way
 * Formats as uppercase hex with spaces every 4 characters
 * Also displays the key status (valid, revoked, or expired)
 * Optionally displays REGISTERED badge if the key is registered on blockchain
 */
export function KeyFingerprint({ publicKey, isRegistered }: KeyFingerprintProps) {
  // Get the fingerprint from the key
  const fingerprint = publicKey.getFingerprint().toUpperCase()

  // Format fingerprint with spaces every 4 characters for readability
  const formattedFingerprint = fingerprint
    .match(/.{1,4}/g)
    ?.join(' ')
    .trim() || fingerprint

  const [status, setStatus] = useState<KeyStatus>('valid')
  const [isLoadingStatus, setIsLoadingStatus] = useState(true)
  const [isCopyingFingerprint, setIsCopyingFingerprint] = useState(false)

  const handleCopyFingerprint = async () => {
    try {
      await navigator.clipboard.writeText(fingerprint)
      setIsCopyingFingerprint(true)
      setTimeout(() => {
        setIsCopyingFingerprint(false)
      }, 2000)
    } catch (error) {
      console.error('Failed to copy fingerprint:', error)
    }
  }

  useEffect(() => {
    const checkKeyStatus = async () => {
      try {
        const isRevoked = await publicKey.isRevoked()
        if (isRevoked) {
          setStatus('revoked')
        } else {
          setStatus('valid')
        }
      } catch (error) {
        setStatus('valid')
      } finally {
        setIsLoadingStatus(false)
      }
    }

    checkKeyStatus()
  }, [publicKey])

  return (
    <div className="key-fingerprint">
      <h3 className="fingerprint-label">Primary Key Fingerprint</h3>
      <div className="fingerprint-display">
        <code className="fingerprint-value">{formattedFingerprint}</code>
        <button
          className="copy-fingerprint-button"
          onClick={handleCopyFingerprint}
          title="Copy fingerprint"
        >
          {isCopyingFingerprint ? (
            <svg className="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ) : (
            <svg className="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
          )}
        </button>
      </div>

      <div className="status-field">
        <span className="status-label">Status:</span>
        <div className="status-badges">
          {isRegistered && (
            <span className="status-value status-registered">REGISTERED</span>
          )}
          {isLoadingStatus ? (
            <span className="status-value loading">Loading...</span>
          ) : (
            <span className={`status-value status-${status}`}>
              {status.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      <style jsx>{`
        .key-fingerprint {
          margin-bottom: 2rem;
        }

        .fingerprint-label {
          margin: 0 0 0.75rem 0;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-primary, #1f2937);
        }

        .fingerprint-display {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background-color: var(--bg-secondary, #f9fafb);
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 0.375rem;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          margin-bottom: 1rem;
        }

        .fingerprint-value {
          flex: 1;
          margin: 0;
          font-size: 0.85rem;
          color: var(--text-primary, #1f2937);
          word-break: break-all;
          line-height: 1.5;
        }

        .copy-fingerprint-button {
          flex-shrink: 0;
          background: none;
          border: 1px solid var(--border-color, #d1d5db);
          border-radius: 0.25rem;
          padding: 0.5rem;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 2.5rem;
          height: 2.5rem;
          color: var(--text-primary, #1f2937);
        }

        .copy-icon {
          width: 1.25rem;
          height: 1.25rem;
        }

        .copy-fingerprint-button:hover {
          background-color: var(--bg-hover, #f3f4f6);
          border-color: var(--border-hover, #9ca3af);
        }

        .copy-fingerprint-button:active {
          transform: scale(0.95);
        }

        .status-field {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background-color: var(--bg-secondary, #f9fafb);
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 0.375rem;
        }

        .status-label {
          font-weight: 600;
          color: var(--text-secondary, #6b7280);
          font-size: 0.9rem;
          min-width: 50px;
        }

        .status-badges {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .status-value {
          font-weight: 600;
          font-size: 0.9rem;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          display: inline-block;
        }

        .status-value.status-valid {
          background-color: #dcfce7;
          color: #166534;
        }

        .status-value.status-registered {
          background-color: #dcfce7;
          color: #166534;
        }

        .status-value.status-revoked {
          background-color: var(--error-bg, #fee2e2);
          color: var(--error-text, #991b1b);
        }

        .status-value.status-expired {
          background-color: var(--warning-bg, #fef3c7);
          color: var(--warning-text, #92400e);
        }

        .status-value.loading {
          background-color: transparent;
          color: var(--text-secondary, #6b7280);
          font-style: italic;
          padding: 0;
        }

        @media (max-width: 640px) {
          .fingerprint-display {
            flex-direction: column;
            gap: 0.5rem;
          }

          .copy-fingerprint-button {
            align-self: flex-start;
          }

          .fingerprint-value {
            font-size: 0.8rem;
          }

          .status-field {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  )
}
