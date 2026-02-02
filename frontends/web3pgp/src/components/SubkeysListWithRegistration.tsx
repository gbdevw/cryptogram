import React, { useEffect, useState, useMemo } from 'react'
import { PublicKey } from 'openpgp'

type SubkeyVerificationStatus = 'valid' | 'revoked' | 'expired'

interface SubkeysListWithRegistrationProps {
  publicKey: PublicKey
  registrationStatus?: Map<string, boolean>
  verificationStatus?: Map<string, SubkeyVerificationStatus>
  selectableSubkeys?: string[]
  selectedSubkeyFingerprint?: string | null
  onSubkeySelect?: (fingerprint: string | null) => void
  primaryKeyRegistered?: boolean
  primaryExpirationDate?: Date | null
}

interface SubkeyDisplayData {
  fingerprint: string
  formattedFingerprint: string
  isRevoked: boolean
  isExpired: boolean
  isRegistered: boolean
  isSelectable: boolean
}

/**
 * Enhanced subkeys list component with registration status and single-selection support
 * Displays REGISTERED badges and allows users to click to select a single subkey
 */
export function SubkeysListWithRegistration({
  publicKey,
  registrationStatus = new Map(),
  verificationStatus = new Map(),
  selectableSubkeys = [],
  selectedSubkeyFingerprint = null,
  onSubkeySelect,
  primaryKeyRegistered = false,
  primaryExpirationDate = null,
}: SubkeysListWithRegistrationProps) {
  // Memoize subkeys to prevent new array references on each render
  const subkeys = useMemo(() => publicKey.getSubkeys(), [publicKey])
  const [subkeyDisplayData, setSubkeyDisplayData] = useState<SubkeyDisplayData[]>([])
  const [isLoading, setIsLoading] = useState(!!verificationStatus && verificationStatus.size === 0)
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

  const handleSubkeyClick = (fingerprint: string, isSelectable: boolean) => {
    // Cannot select subkey if primary key is not registered
    if (!primaryKeyRegistered || !isSelectable || !onSubkeySelect) return

    // Toggle selection: if already selected, deselect; otherwise select
    const newSelection =
      selectedSubkeyFingerprint === fingerprint ? null : fingerprint
    onSubkeySelect(newSelection)
  }

  useEffect(() => {
    const buildDisplayData = async () => {
      try {
        // Check if primary key is revoked
        let primaryKeyRevoked = false
        try {
          primaryKeyRevoked = await publicKey.isRevoked()
        } catch (error) {
          primaryKeyRevoked = false
        }

        const displayData: SubkeyDisplayData[] = []

        for (const subkey of subkeys) {
          const fingerprint = subkey.getFingerprint().toUpperCase()
          const formattedFingerprint =
            fingerprint.match(/.{1,4}/g)?.join(' ').trim() || fingerprint

          // Use provided verification status or check individually
          let isRevoked = primaryKeyRevoked
          let isExpired = primaryKeyExpired // If primary is expired, subkey is also expired

          if (verificationStatus && verificationStatus.has(fingerprint)) {
            const status = verificationStatus.get(fingerprint)
            isRevoked = status === 'revoked' || primaryKeyRevoked
            isExpired = status === 'expired' || primaryKeyExpired
          } else if (!primaryKeyRevoked && !primaryKeyExpired) {
            // Fallback: check individual subkey status
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

          const isRegistered = registrationStatus?.get(fingerprint) ?? false
          const isSelectable = selectableSubkeys.includes(fingerprint)

          displayData.push({
            fingerprint,
            formattedFingerprint,
            isRevoked,
            isExpired,
            isRegistered,
            isSelectable,
          })
        }

        setSubkeyDisplayData(displayData)
      } finally {
        setIsLoading(false)
      }
    }

    buildDisplayData()
  }, [publicKey, subkeys, registrationStatus, verificationStatus, selectableSubkeys, primaryKeyExpired])

  if (!subkeys || subkeys.length === 0) {
    return (
      <div className="subkeys-section">
        <div
          className="section-header"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ cursor: 'pointer' }}
        >
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
          {subkeyDisplayData.map((data, index) => {
            const isSelected = selectedSubkeyFingerprint === data.fingerprint
            // Subkey is selectable only if primary key is registered AND subkey is selectable
            const isClickable = primaryKeyRegistered && data.isSelectable
            const statusClasses = [
              data.isRevoked && 'revoked',
              data.isExpired && 'expired',
              isSelected && 'selected',
              isClickable && 'selectable',
              !isClickable && 'disabled',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <div
                key={index}
                className={`subkey-item ${statusClasses}`}
                onClick={() =>
                  handleSubkeyClick(data.fingerprint, isClickable)
                }
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={(e) => {
                  const isClickable = primaryKeyRegistered && data.isSelectable
                  if (
                    isClickable &&
                    (e.key === 'Enter' || e.key === ' ')
                  ) {
                    handleSubkeyClick(data.fingerprint, isClickable)
                  }
                }}
              >
                <div className="subkey-header">
                  <h4 className="subkey-label">Subkey {index + 1}</h4>
                  <div className="subkey-badges">
                    {data.isRegistered && (
                      <span className="registered-badge">REGISTERED</span>
                    )}
                    {data.isRevoked && (
                      <span className="revoked-badge">REVOKED</span>
                    )}
                    {!data.isRevoked && data.isExpired && (
                      <span className="expired-badge">EXPIRED</span>
                    )}
                  </div>
                </div>

                <div className="subkey-details">
                  <div className="detail-row">
                    <span className="detail-label">Fingerprint:</span>
                    <code className="detail-value">
                      {data.formattedFingerprint}
                    </code>
                    <button
                      className="copy-button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCopyFingerprint(data.fingerprint)
                      }}
                      title="Copy fingerprint"
                    >
                      {copiedFingerprint === data.fingerprint ? (
                        <svg
                          className="copy-icon"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      ) : (
                        <svg
                          className="copy-icon"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                          <rect
                            x="8"
                            y="2"
                            width="8"
                            height="4"
                            rx="1"
                            ry="1"
                          ></rect>
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
          border: 2px solid var(--border-color, #e5e7eb);
          border-radius: 0.375rem;
          transition: all 0.2s;
          cursor: default;
        }

        /* Selectable subkeys should be clickable */
        .subkey-item.selectable {
          cursor: pointer;
        }

        .subkey-item.selectable:hover {
          background-color: var(--bg-hover, #f3f4f6);
          border-color: var(--border-hover, #d1d5db);
        }

        .subkey-item.selectable:focus {
          outline: none;
          border-color: var(--primary-color, #0ea5e9);
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
        }

        /* Disabled (non-selectable) subkeys */
        .subkey-item.disabled {
          opacity: 0.6;
          background-color: var(--bg-secondary, #f9fafb);
        }

        /* Selected subkey highlighting */
        .subkey-item.selected {
          background-color: rgba(14, 165, 233, 0.05);
          border-color: var(--primary-color, #0ea5e9);
          box-shadow: inset 0 0 0 1px var(--primary-color, #0ea5e9);
        }

        .subkey-item.expired {
          border-color: var(--warning-color, #f97316);
        }

        .subkey-item.revoked {
          border-color: var(--error-color, #ef4444);
        }

        .subkey-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 0.75rem;
          flex-wrap: wrap;
        }

        .subkey-label {
          margin: 0;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-primary, #1f2937);
        }

        .subkey-badges {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .registered-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          background-color: #dcfce7;
          color: #166534;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          font-weight: 600;
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

          .subkey-badges {
            gap: 0.25rem;
          }
        }
      `}</style>
    </div>
  )
}
