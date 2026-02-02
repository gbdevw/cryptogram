import React, { useState } from 'react'
import { UserIDMetadata } from '../types/revocation'

interface RegistrationUserIDsListProps {
  users: UserIDMetadata[]
}

/**
 * Displays the list of user IDs for the registration workflow with their statuses
 * Shows name, email, and comment for each user ID (if present)
 * Displays verification status: VALID or REVOKED
 */
export function RegistrationUserIDsList({ users }: RegistrationUserIDsListProps) {
  const [copiedUserID, setCopiedUserID] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(true)

  const handleCopyUserID = async (userID: string) => {
    try {
      await navigator.clipboard.writeText(userID)
      setCopiedUserID(userID)
      setTimeout(() => {
        setCopiedUserID(null)
      }, 2000)
    } catch (error) {
      console.error('Failed to copy user ID:', error)
    }
  }

  if (users.length === 0) {
    return (
      <div className="user-ids-section">
        <button
          className="section-header"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="section-title">User IDs</span>
          <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
        </button>
        {isExpanded && (
          <p className="no-data">No user IDs associated with this key.</p>
        )}
      </div>
    )
  }

  return (
    <div className="user-ids-section">
      <button
        className="section-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="section-title">User IDs ({users.length})</span>
        <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
      </button>
      {isExpanded && (
        <div className="user-ids-list">
          {users.map((user, index) => (
            <div key={index} className="user-id-item">
              <div className="user-id-content">
                {user.name && (
                  <div className="user-id-field">
                    <span className="field-label">Name:</span>
                    <span className="field-value">{user.name}</span>
                  </div>
                )}
                {user.email && (
                  <div className="user-id-field">
                    <span className="field-label">Email:</span>
                    <span className="field-value">{user.email}</span>
                  </div>
                )}
                {user.comment && (
                  <div className="user-id-field">
                    <span className="field-label">Comment:</span>
                    <span className="field-value">{user.comment}</span>
                  </div>
                )}
                {!user.name && !user.email && !user.comment && (
                  <div className="user-id-field">
                    <span className="field-value">{user.userID}</span>
                  </div>
                )}
              </div>
              <div className="user-id-actions">
                <span className={`status-badge status-${user.status}`}>
                  {user.status.toUpperCase()}
                </span>
                <button
                  className="copy-user-id-button"
                  onClick={() => handleCopyUserID(user.userID)}
                  title="Copy user ID"
                >
                  {copiedUserID === user.userID ? (
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
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .user-ids-section {
          margin-bottom: 2rem;
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

        .user-ids-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .user-id-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background-color: var(--bg-secondary, #f9fafb);
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 0.375rem;
          transition: background-color 0.2s;
        }

        .user-id-item:hover {
          background-color: var(--bg-hover, #f3f4f6);
        }

        .user-id-content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .user-id-field {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
          font-size: 0.9rem;
        }

        .field-label {
          font-weight: 600;
          color: var(--text-secondary, #6b7280);
          min-width: 60px;
          flex-shrink: 0;
        }

        .field-value {
          color: var(--text-primary, #1f2937);
          word-break: break-word;
        }

        .user-id-actions {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .status-badge {
          font-weight: 600;
          font-size: 0.8rem;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          display: inline-block;
          white-space: nowrap;
        }

        .status-badge.status-valid {
          background-color: #dcfce7;
          color: #166534;
        }

        .status-badge.status-revoked {
          background-color: var(--error-bg, #fee2e2);
          color: var(--error-text, #991b1b);
        }

        .copy-user-id-button {
          flex-shrink: 0;
          background: none;
          border: 1px solid var(--border-color, #d1d5db);
          border-radius: 0.25rem;
          padding: 0.5rem;
          cursor: pointer;
          font-size: 0.9rem;
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

        .copy-user-id-button:hover {
          background-color: var(--bg-hover, #f3f4f6);
          border-color: var(--border-hover, #9ca3af);
        }

        .copy-user-id-button:active {
          transform: scale(0.95);
        }

        @media (max-width: 640px) {
          .user-id-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }

          .user-id-actions {
            width: 100%;
            justify-content: space-between;
          }

          .copy-user-id-button {
            align-self: flex-end;
          }
        }
      `}</style>
    </div>
  )
}
