import React, { useState } from 'react'
import { PublicKey } from 'openpgp'

interface KeyActionButtonsProps {
  publicKey: PublicKey
  onSuccess?: (action: 'copy' | 'download') => void
}

interface FeedbackMessage {
  type: 'success' | 'error'
  message: string
}

/**
 * Component providing copy to clipboard and download functionality for public keys
 * Shows visual feedback for successful actions
 */
export function KeyActionButtons({ publicKey, onSuccess }: KeyActionButtonsProps) {
  const [copyButtonText, setCopyButtonText] = useState<'Copy to Clipboard' | 'Copied ✓'>('Copy to Clipboard')
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null)

  /**
   * Show error feedback message temporarily
   */
  const showErrorFeedback = (message: string) => {
    setFeedback({
      type: 'error',
      message,
    })
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setFeedback(null)
    }, 3000)
  }

  /**
   * Copy armored public key to clipboard
   */
  const handleCopyToClipboard = async () => {
    try {
      const armoredKey = publicKey.armor()
      await navigator.clipboard.writeText(armoredKey)
      // Update button text temporarily
      setCopyButtonText('Copied ✓')
      setTimeout(() => {
        setCopyButtonText('Copy to Clipboard')
      }, 2000)
      onSuccess?.('copy')
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      showErrorFeedback('Failed to copy to clipboard. Please try again.')
    }
  }

  /**
   * Download armored public key as .asc file
   */
  const handleDownloadKey = () => {
    try {
      const armoredKey = publicKey.armor()
      const fingerprint = publicKey.getFingerprint().toUpperCase().substring(0, 16)
      const filename = `public-key-${fingerprint}.asc`

      // Create blob from armored key
      const blob = new Blob([armoredKey], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)

      // Create and trigger download
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up
      URL.revokeObjectURL(url)

      onSuccess?.('download')
    } catch (error) {
      console.error('Failed to download key:', error)
      showErrorFeedback('Failed to download key. Please try again.')
    }
  }

  return (
    <div className="key-action-buttons">
      <div className="buttons-container">
        <button
          className="action-button copy-button"
          onClick={handleCopyToClipboard}
          title="Copy armored public key to clipboard"
        >
          <svg className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
          </svg>
          <span className="button-text">{copyButtonText}</span>
        </button>

        <button
          className="action-button download-button"
          onClick={handleDownloadKey}
          title="Download armored public key as .asc file"
        >
          <svg className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span className="button-text">Download .asc</span>
        </button>
      </div>

      {feedback && (
        <div className={`feedback-message ${feedback.type}`}>
          <span className="feedback-icon">
            {feedback.type === 'success' ? '✓' : '✕'}
          </span>
          <span className="feedback-text">{feedback.message}</span>
        </div>
      )}

      <style jsx>{`
        .key-action-buttons {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid var(--border-color, #e5e7eb);
        }

        .buttons-container {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .action-button {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1.5rem;
          border: 2px solid transparent;
          border-radius: 0.375rem;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .copy-button {
          background-color: #667eea;
          color: white;
          width: 190px;
          justify-content: center;
        }

        .copy-button:hover {
          background-color: #5568d3;
          transform: translateY(-2px);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .copy-button:active {
          transform: translateY(0);
        }

        .download-button {
          background-color: #667eea;
          color: white;
        }

        .download-button:hover {
          background-color: #5568d3;
          transform: translateY(-2px);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        }

        .download-button:active {
          transform: translateY(0);
        }

        .button-icon {
          font-size: 1.1rem;
          width: 1.25rem;
          height: 1.25rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .button-icon svg {
          width: 100%;
          height: 100%;
        }

        .button-text {
          font-weight: 600;
        }

        .feedback-message {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: 0.375rem;
          font-size: 0.9rem;
          animation: slideIn 0.3s ease-out;
        }

        .feedback-message.success {
          background-color: var(--success-bg, #ecfdf5);
          color: var(--success-text, #047857);
          border: 1px solid var(--success-border, #86efac);
        }

        .feedback-message.error {
          background-color: var(--error-bg, #fef2f2);
          color: var(--error-text, #991b1b);
          border: 1px solid var(--error-border, #fca5a5);
        }

        .feedback-icon {
          font-size: 1.1rem;
          font-weight: 600;
          flex-shrink: 0;
        }

        .feedback-text {
          flex: 1;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 640px) {
          .buttons-container {
            flex-direction: column;
            gap: 0.75rem;
          }

          .action-button {
            width: 100%;
            justify-content: center;
            padding: 0.75rem 1rem;
          }

          .button-text {
            font-size: 0.9rem;
          }
        }
      `}</style>
    </div>
  )
}
