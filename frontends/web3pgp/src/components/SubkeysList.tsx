import React, { useEffect, useState, useMemo } from 'react'
import { PublicKey } from 'openpgp'

interface SubkeysListProps {
  publicKey: PublicKey
  primaryExpirationDate?: Date | null
}

interface SubkeyStatus {
  fingerprint: string
  formattedFingerprint: string
  isRevoked: boolean
  isExpired: boolean
}

/**
 * Displays all subkeys associated with the public key
 * Shows fingerprint and revocation/expiration status
 */
export function SubkeysList({ publicKey, primaryExpirationDate }: SubkeysListProps) {
  // Memoize subkeys to prevent new array references on each render
  const subkeys = useMemo(() => publicKey.getSubkeys(), [publicKey])
  const [subkeyStatuses, setSubkeyStatuses] = useState<SubkeyStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [copiedFingerprint, setCopiedFingerprint] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  // Check if primary key is expired
  const primaryKeyExpired = primaryExpirationDate ? new Date() > primaryExpirationDate : false

  const handleCopyFingerprint = async (fingerprint: string) => {
    try {
      await navigator.clipboard.writeText(fingerprint)
      setCopiedFingerprint(fingerprint)
      setTimeout(() => {
        setCopiedFingerprint(null)
      }, 2000)
    } catch (error) {
      console.error('Failed to copy fingerprint:', error)
    }
  }

  useEffect(() => {
    const checkKeyStatus = async () => {
      try {
        // Check if primary key is revoked
        let primaryKeyRevoked = false
        try {
          primaryKeyRevoked = await publicKey.isRevoked()
        } catch (error) {
          // If error checking primary key revocation, assume not revoked
          primaryKeyRevoked = false
        }

        // Check each subkey
        const statuses: SubkeyStatus[] = []
        for (const subkey of subkeys) {
          const fingerprint = subkey.getFingerprint().toUpperCase()
          const formattedFingerprint =
            fingerprint.match(/.{1,4}/g)?.join(' ').trim() || fingerprint

          let isRevoked = primaryKeyRevoked
          let isExpired = primaryKeyExpired // If primary is expired, subkey is also expired

          // If primary key is not revoked and not expired, check individual subkey status
          if (!primaryKeyRevoked && !primaryKeyExpired) {
            try {
              await subkey.verify()
            } catch (error) {
              if (error instanceof Error) {
                if (error.message === 'Subkey is revoked') {
                  isRevoked = true
                } else if (error.message === 'Subkey is expired') {
                  isExpired = true
                }
              }
            }
          }

          statuses.push({
            fingerprint,
            formattedFingerprint,
            isRevoked,
            isExpired,
          })
        }

        setSubkeyStatuses(statuses)
      } finally {
        setIsLoading(false)
      }
    }

    checkKeyStatus()
  }, [publicKey, subkeys, primaryKeyExpired])

  if (!subkeys || subkeys.length === 0) {
    return (
      <div className="subkeys-section">
        <div className="section-header" onClick={() => setIsExpanded(!isExpanded)} style={{ cursor: 'pointer' }}>
          <span className="section-title">Subkeys (0)</span>
          <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
        </div>
        {isExpanded && (
          <p className="no-data">No subkeys associated with this key.</p>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="subkeys-section">
        <div
          className="section-header"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ cursor: 'pointer' }}
        >
          <span className="section-title">Subkeys ({subkeys.length})</span>
          <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
        </div>
        {isExpanded && (
          <p className="no-data">Loading subkey status...</p>
        )}
      </div>
    )
  }

  return (
    <div className="subkeys-section">
      <div
        className="section-header"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer' }}
      >
        <span className="section-title">Subkeys ({subkeys.length})</span>
        <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
      </div>
      {isExpanded && (
        <div className="subkeys-list">
          {subkeyStatuses.map((status, index) => {
            const statusClass = status.isRevoked ? 'revoked' : status.isExpired ? 'expired' : ''

            return (
              <div key={index} className={`subkey-item ${statusClass}`}>
              <div className="subkey-header">
                <h4 className="subkey-label">Subkey {index + 1}</h4>
                {status.isRevoked && <span className="revoked-badge">REVOKED</span>}
                {!status.isRevoked && status.isExpired && <span className="expired-badge">EXPIRED</span>}
              </div>

              <div className="subkey-details">
                <div className="detail-row">
                  <span className="detail-label">Fingerprint:</span>
                  <code className="detail-value">{status.formattedFingerprint}</code>
                  <button
                    className="copy-button"
                    onClick={() => handleCopyFingerprint(status.fingerprint)}
                    title="Copy fingerprint"
                  >
                    {copiedFingerprint === status.fingerprint ? (
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
              </div>
            </div>
          )
        })}
        </div>
      )}

      <style jsx>{`
        .subkeys-section {
          margin-bottom: 1.5rem;
        }

        .section-header {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          width: 100%;
          margin-bottom: 0.75rem;
          transition: all 0.2s ease;
          font-size: inherit;
          font-family: inherit;
        }

        .section-header:hover {
          opacity: 0.7;
        }

        .expand-icon {
          flex-shrink: 0;
          transition: transform 0.2s ease;
          color: var(--text-secondary, #6b7280);
          font-size: 0.75rem;
        }

        .expand-icon.expanded {
          transform: rotate(90deg);
        }

        .section-title {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-primary, #1f2937);
        }

        .no-data {
          margin: 0;
          padding: 0.75rem;
          font-size: 0.9rem;
          color: var(--text-secondary, #6b7280);
          font-style: italic;
        }

        .subkeys-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .subkey-item {
          padding: 1rem;
          background-color: var(--bg-secondary, #f9fafb);
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 0.375rem;
          transition: all 0.2s;
        }

        .subkey-item:hover {
          background-color: var(--bg-hover, #f3f4f6);
          border-color: var(--border-hover, #d1d5db);
        }

        .subkey-item.expired {
          opacity: 0.7;
          border-color: var(--warning-color, #f97316);
        }

        .subkey-item.revoked {
          opacity: 0.6;
          border-color: var(--error-color, #ef4444);
        }

        .subkey-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .subkey-label {
          margin: 0;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-primary, #1f2937);
        }

        .expired-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          background-color: var(--warning-bg, #fef3c7);
          color: var(--warning-text, #92400e);
          border-radius: 0.25rem;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .revoked-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          background-color: var(--error-bg, #fee2e2);
          color: var(--error-text, #991b1b);
          border-radius: 0.25rem;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .subkey-details {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .detail-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
          font-size: 0.9rem;
        }

        .detail-label {
          font-weight: 600;
          color: var(--text-secondary, #6b7280);
          min-width: 80px;
        }

        .detail-value {
          flex: 1;
          margin: 0;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          color: var(--text-primary, #1f2937);
          font-size: 0.85rem;
          word-break: break-all;
        }

        .copy-button {
          flex-shrink: 0;
          background: none;
          border: 1px solid var(--border-color, #d1d5db);
          border-radius: 0.25rem;
          padding: 0.4rem;
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 2.25rem;
          height: 2.25rem;
          color: var(--text-primary, #1f2937);
        }

        .copy-icon {
          width: 1.125rem;
          height: 1.125rem;
        }

        .copy-button:hover {
          background-color: var(--bg-hover, #f3f4f6);
          border-color: var(--border-hover, #9ca3af);
        }

        .copy-button:active {
          transform: scale(0.95);
        }

        @media (max-width: 640px) {
          .detail-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.25rem;
          }

          .detail-label {
            min-width: unset;
          }

          .detail-value {
            font-size: 0.8rem;
          }

          .subkey-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }

          .primary-key-status {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  )
}
