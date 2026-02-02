import React, { useState } from 'react'
import { KeyMetadata } from '../types/revocation'

interface SubkeysListWithRevocationProps {
  keyMetadata: KeyMetadata
  selectedSubkeyFingerprint: string | null
  onSubkeySelect: (fingerprint: string | null) => void
}

/**
 * Displays a list of subkeys with revocation status
 * Shows: To Revoke, Already Revoked, Unregistered, Valid states
 * Users can select "To Revoke" subkeys for revocation
 */
export function SubkeysListWithRevocation({
  keyMetadata,
  selectedSubkeyFingerprint,
  onSubkeySelect,
}: SubkeysListWithRevocationProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const { subkeys, expirationDate } = keyMetadata

  // Check if primary key is expired
  const primaryKeyExpired = expirationDate ? new Date() > expirationDate : false

  if (subkeys.length === 0) {
    return (
      <div className="subkeys-list">
        <div className="empty-state">
          <p>No subkeys found</p>
        </div>
      </div>
    )
  }

  // Count subkeys by revocation state
  const toRevokeCount = subkeys.filter(
    (sk) => sk.revocationState === 'to-revoke'
  ).length
  const alreadyRevokedCount = subkeys.filter(
    (sk) => sk.revocationState === 'already-revoked'
  ).length
  const unregisteredCount = subkeys.filter(
    (sk) => sk.registrationState === 'unregistered'
  ).length

  return (
    <div className="subkeys-list">
      <button
        className="subkeys-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="subkeys-header-content">
          <svg
            className={`collapse-icon ${!isExpanded ? 'collapsed' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          <h3 className="subkeys-title">Subkeys ({subkeys.length})</h3>
          <p className="subkeys-hint">
            {toRevokeCount > 0 && `${toRevokeCount} to revoke`}
            {alreadyRevokedCount > 0 &&
              `${toRevokeCount > 0 ? ', ' : ''}${alreadyRevokedCount} already revoked`}
            {unregisteredCount > 0 &&
              `${toRevokeCount > 0 || alreadyRevokedCount > 0 ? ', ' : ''}${unregisteredCount} unregistered`}
            {toRevokeCount === 0 &&
              alreadyRevokedCount === 0 &&
              unregisteredCount === 0 &&
              'All valid'}
          </p>
        </div>
      </button>

      {isExpanded && (
      <div className="subkeys-container">
        {subkeys.map((subkey) => {
          const fingerprint = subkey.fingerprint
          const isSelected = selectedSubkeyFingerprint === fingerprint
          const isSelectable = subkey.revocationState === 'to-revoke'

          return (
            <div
              key={fingerprint}
              className={`subkey-item 
                ${subkey.revocationState === 'to-revoke' ? 'to-revoke' : ''} 
                ${subkey.revocationState === 'already-revoked' ? 'already-revoked' : ''} 
                ${subkey.registrationState === 'unregistered' ? 'unregistered' : ''} 
                ${subkey.revocationState === 'valid' && subkey.registrationState === 'registered' ? 'valid-registered' : ''}
                ${isSelectable ? '' : 'disabled'} 
                ${isSelected ? 'selected' : ''}
              `}
              onClick={() => {
                if (isSelectable) {
                  onSubkeySelect(isSelected ? null : fingerprint)
                }
              }}
              role={isSelectable ? 'button' : 'presentation'}
              tabIndex={isSelectable ? 0 : -1}
              onKeyPress={(e) => {
                if (
                  isSelectable &&
                  (e.key === 'Enter' || e.key === ' ')
                ) {
                  onSubkeySelect(isSelected ? null : fingerprint)
                }
              }}
            >
              <div className="subkey-content">
                <div className="subkey-info">
                  <p className="subkey-fingerprint">{fingerprint}</p>
                  <div className="subkey-meta">
                    {subkey.registrationState === 'registered' && (
                      <span className="subkey-status registered-badge">
                        REGISTERED
                      </span>
                    )}
                    {(subkey.revocationState === 'to-revoke' || primaryKeyExpired) && (
                      <span className="subkey-status to-revoke-badge">
                        {primaryKeyExpired ? 'EXPIRED' : 'TO REVOKE'}
                      </span>
                    )}
                    {subkey.revocationState === 'already-revoked' && (
                      <span className="subkey-status already-revoked-badge">
                        ALREADY REVOKED
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      )}

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
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          display: flex;
          align-items: flex-start;
          width: 100%;
          color: inherit;
          font-family: inherit;
          transition: opacity 0.2s;
          margin-bottom: 0.5rem;
        }

        .subkeys-header:hover {
          opacity: 0.7;
        }

        .subkeys-header-content {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          width: 100%;
        }

        .collapse-icon {
          flex-shrink: 0;
          width: 1.25rem;
          height: 1.25rem;
          color: var(--text-secondary, #6b7280);
          transition: transform 0.2s;
          margin-top: 0.1rem;
        }

        .collapse-icon.collapsed {
          transform: rotate(180deg);
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

        .subkey-item.to-revoke {
          cursor: pointer;
          border-color: #fed7aa;
          background-color: #fffbf0;
        }

        .subkey-item.to-revoke:hover {
          background-color: #fef3c7;
          border-color: #f59e0b;
        }

        .subkey-item.to-revoke.selected {
          background-color: #fef3c7;
          border-color: #d97706;
          box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.1);
        }

        .subkey-item.already-revoked {
          opacity: 0.7;
          cursor: not-allowed;
          border-color: #fca5a5;
          background-color: #fffbfb;
        }

        .subkey-item.valid-registered {
          opacity: 0.6;
          cursor: not-allowed;
          border-color: var(--border-color, #e5e7eb);
          background-color: var(--bg-secondary, #f9fafb);
        }

        .subkey-item.unregistered {
          opacity: 0.6;
          cursor: not-allowed;
          border-color: var(--border-color, #e5e7eb);
          background-color: var(--bg-secondary, #f9fafb);
        }

        .subkey-item.disabled {
          cursor: not-allowed;
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

        .subkey-status {
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.25rem 0.75rem;
          border-radius: 0.25rem;
        }

        .to-revoke-badge {
          background-color: #fef3c7;
          color: #92400e;
        }

        .already-revoked-badge {
          background-color: #fee2e2;
          color: #991b1b;
        }

        .registered-badge {
          background-color: #dcfce7;
          color: #166534;
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
