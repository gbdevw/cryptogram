import React from 'react'

type ErrorType = 'not-found' | 'service-error' | 'invalid-input'

interface ErrorMessageProps {
  errorType: ErrorType
  onDismiss?: () => void
}

const errorMessages: Record<ErrorType, { title: string; message: string }> = {
  'not-found': {
    title: 'Key Not Found',
    message: 'No public key found for this fingerprint. Please check and try again.',
  },
  'service-error': {
    title: 'Service Error',
    message: 'Unable to fetch the public key. Please try again later.',
  },
  'invalid-input': {
    title: 'Invalid Fingerprint',
    message: 'Please enter a valid fingerprint (40 or 64 hexadecimal characters).',
  },
}

/**
 * Component to display error messages with consistent styling
 * Shows user-friendly messages for different error scenarios
 */
export function ErrorMessage({ errorType, onDismiss }: ErrorMessageProps) {
  const { title, message } = errorMessages[errorType]

  return (
    <div className={`error-message error-${errorType}`}>
      <div className="error-content">
        <div className="error-header">
          <span className="error-icon">⚠️</span>
          <h3 className="error-title">{title}</h3>
        </div>
        <p className="error-text">{message}</p>
      </div>
      {onDismiss && (
        <button className="error-dismiss" onClick={onDismiss} title="Dismiss">
          ✕
        </button>
      )}

      <style jsx>{`
        .error-message {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 1rem;
          border-radius: 0.5rem;
          margin-bottom: 1.5rem;
          border-left: 4px solid var(--error-color, #ef4444);
          background-color: var(--error-bg, #fef2f2);
        }

        .error-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .error-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .error-icon {
          font-size: 1.25rem;
          flex-shrink: 0;
        }

        .error-title {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--error-dark, #7f1d1d);
        }

        .error-text {
          margin: 0;
          font-size: 0.9rem;
          color: var(--error-text, #991b1b);
          line-height: 1.5;
        }

        .error-dismiss {
          flex-shrink: 0;
          background: none;
          border: none;
          color: var(--error-color, #ef4444);
          cursor: pointer;
          padding: 0.25rem;
          font-size: 1.25rem;
          transition: opacity 0.2s;
          opacity: 0.7;
        }

        .error-dismiss:hover {
          opacity: 1;
        }

        @media (max-width: 640px) {
          .error-message {
            gap: 0.75rem;
          }

          .error-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .error-icon {
            margin-top: 0.25rem;
          }

          .error-title {
            font-size: 0.9rem;
          }

          .error-text {
            font-size: 0.85rem;
          }
        }
      `}</style>
    </div>
  )
}
