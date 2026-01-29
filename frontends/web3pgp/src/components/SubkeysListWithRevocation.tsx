import React from 'react'
import { PublicKey } from 'openpgp'

interface SubkeysListWithRevocationProps {
  publicKey: PublicKey
  revokedSubkeys: string[]
  selectedSubkeyFingerprint: string | null
  onSubkeySelect: (fingerprint: string | null) => void
}

/**
 * Displays a list of subkeys with revocation status
 * Users can select revoked subkeys for revocation
 */
export function SubkeysListWithRevocation({
  publicKey,
  revokedSubkeys,
  selectedSubkeyFingerprint,
  onSubkeySelect,
}: SubkeysListWithRevocationProps) {
  const subkeys = publicKey.getSubkeys()

  if (subkeys.length === 0) {
    return (
      <div className="subkeys-list">
        <div className="empty-state">
          <p>No subkeys found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="subkeys-list">
      <div className="subkeys-header">
        <h3 className="subkeys-title">Subkeys</h3>
        <p className="subkeys-hint">
          {revokedSubkeys.length === 0
            ? 'No revoked subkeys'
            : `${revokedSubkeys.length} revoked subkey${revokedSubkeys.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      <div className="subkeys-container">
        {subkeys.map((subkey) => {
          const fingerprint = subkey.getFingerprint().toUpperCase()
          const isRevoked = revokedSubkeys.includes(fingerprint)
          const isSelected = selectedSubkeyFingerprint === fingerprint

          return (
            <div
              key={fingerprint}
              className={`subkey-item ${isRevoked ? 'revoked' : 'valid'} ${
                isSelected ? 'selected' : ''
              }`}
              onClick={() => {
                if (isRevoked) {
                  onSubkeySelect(isSelected ? null : fingerprint)
                }
              }}
              role={isRevoked ? 'button' : 'presentation'}
              tabIndex={isRevoked ? 0 : -1}
              onKeyPress={(e) => {
                if (isRevoked && (e.key === 'Enter' || e.key === ' ')) {
                  onSubkeySelect(isSelected ? null : fingerprint)
                }
              }}
            >
              <div className="subkey-content">
                <div className="subkey-info">
                  <p className="subkey-fingerprint">{fingerprint}</p>
                  <div className="subkey-meta">
                    <span className="subkey-type">
                      SUBKEY
                    </span>
                    {isRevoked && (
                      <span className="subkey-status revoked-badge">
                        Revoked
                      </span>
                    )}
                  </div>
                </div>
                {isRevoked && (
                  <div className="subkey-checkbox">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      disabled={false}
                      className="checkbox-input"
                      aria-label={`Select subkey ${fingerprint}`}
                    />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <style jsx>{`
        .subkeys-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1.5rem;
          background-color: var(--bg-secondary, #f9fafb);
          border-radius: 0.5rem;
          border: 1px solid var(--border-color, #e5e7eb);
        }

        .subkeys-header {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          margin-bottom: 0.5rem;
        }

        .subkeys-title {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary, #1f2937);
        }

        .subkeys-hint {
          margin: 0;
          font-size: 0.875rem;
          color: var(--text-secondary, #6b7280);
        }

        .subkeys-container {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .subkey-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          background-color: white;
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 0.375rem;
          transition: all 0.2s;
        }

        .subkey-item.valid {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .subkey-item.revoked {
          cursor: pointer;
          border-color: #fca5a5;
          background-color: #fffbfb;
        }

        .subkey-item.revoked:hover {
          background-color: #fef2f2;
          border-color: #f87171;
        }

        .subkey-item.revoked.selected {
          background-color: #fef2f2;
          border-color: #dc2626;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
        }

        .subkey-item:focus-within {
          outline: 2px solid var(--primary-color, #0ea5e9);
          outline-offset: 2px;
        }

        .subkey-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          gap: 1rem;
        }

        .subkey-info {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          flex: 1;
          min-width: 0;
        }

        .subkey-fingerprint {
          margin: 0;
          font-family: 'Courier New', monospace;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary, #1f2937);
          word-break: break-all;
        }

        .subkey-meta {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .subkey-type {
          font-size: 0.75rem;
          font-weight: 500;
          padding: 0.25rem 0.5rem;
          background-color: var(--border-color, #e5e7eb);
          color: var(--text-secondary, #6b7280);
          border-radius: 0.25rem;
          text-transform: uppercase;
        }

        .revoked-badge {
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.25rem 0.75rem;
          background-color: #fee2e2;
          color: #991b1b;
          border-radius: 0.25rem;
        }

        .subkey-checkbox {
          flex-shrink: 0;
        }

        .checkbox-input {
          width: 1.25rem;
          height: 1.25rem;
          cursor: pointer;
          accent-color: #dc2626;
        }

        .empty-state {
          text-align: center;
          padding: 2rem 1rem;
          color: var(--text-secondary, #6b7280);
        }

        .empty-state p {
          margin: 0;
          font-size: 0.95rem;
        }

        @media (max-width: 640px) {
          .subkeys-list {
            padding: 1rem;
          }

          .subkey-item {
            padding: 0.75rem;
          }

          .subkey-fingerprint {
            font-size: 0.8rem;
          }
        }
      `}</style>
    </div>
  )
}
