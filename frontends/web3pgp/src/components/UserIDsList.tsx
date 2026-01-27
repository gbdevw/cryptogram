import React, { useState } from 'react'
import { PublicKey } from 'openpgp'

interface UserIDsListProps {
  publicKey: PublicKey
}

interface ParsedUserID {
  name: string
  email?: string
  comment?: string
  full: string
}

/**
 * Parse OpenPGP user ID format: "Name (Comment) <email@example.com>"
 */
function parseUserID(userID: string): ParsedUserID {
  let name = userID
  let email: string | undefined
  let comment: string | undefined

  // Extract email (text within angle brackets)
  const emailMatch = userID.match(/<([^>]+)>/)
  if (emailMatch) {
    email = emailMatch[1]
    name = userID.replace(emailMatch[0], '').trim()
  }

  // Extract comment (text within parentheses)
  const commentMatch = name.match(/\(([^)]+)\)/)
  if (commentMatch) {
    comment = commentMatch[1]
    name = name.replace(commentMatch[0], '').trim()
  }

  return { name, email, comment, full: userID }
}

/**
 * Displays all user IDs associated with the public key
 * Each user ID typically contains name, email, and optional comment
 */
export function UserIDsList({ publicKey }: UserIDsListProps) {
  const userIDs = publicKey.getUserIDs()
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

  if (!userIDs || userIDs.length === 0) {
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
        <span className="section-title">User IDs ({userIDs.length})</span>
        <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
      </button>
      {isExpanded && (
        <div className="user-ids-list">
          {userIDs.map((userID, index) => {
            const parsed = parseUserID(userID)
            return (
              <div key={index} className="user-id-item">
              <div className="user-id-content">
                {parsed.name && (
                  <div className="user-id-field">
                    <span className="field-label">Name:</span>
                    <span className="field-value">{parsed.name}</span>
                  </div>
                )}
                {parsed.email && (
                  <div className="user-id-field">
                    <span className="field-label">Email:</span>
                    <span className="field-value">{parsed.email}</span>
                  </div>
                )}
                {parsed.comment && (
                  <div className="user-id-field">
                    <span className="field-label">Comment:</span>
                    <span className="field-value">{parsed.comment}</span>
                  </div>
                )}
              </div>
              <button
                className="copy-user-id-button"
                onClick={() => handleCopyUserID(parsed.full)}
                title="Copy user ID"
              >
                {copiedUserID === parsed.full ? (
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
          )
        })}
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

        .copy-user-id-button {
          flex-shrink: 0;
          background: none;
          border: 1px solid var(--border-color, #d1d5db);
          border-radius: 0.25rem;
          padding: 0.5rem;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 2.25rem;
          height: 2.25rem;
          color: var(--text-primary, #1f2937);
        }

        .copy-icon {
          width: 1.125rem;
          height: 1.125rem;        }

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

          .copy-user-id-button {
            align-self: flex-start;
          }

          .user-id-text {
            font-size: 0.85rem;
          }
        }
      `}</style>
    </div>
  )
}
