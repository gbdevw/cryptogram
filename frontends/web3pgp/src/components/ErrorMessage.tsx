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
      <div className="error-icon-wrapper">
        <svg
          className="error-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className="error-content">
        <h3 className="error-title">{title}</h3>
        <p className="error-text">{message}</p>
      </div>
      {onDismiss && (
        <button className="error-dismiss" onClick={onDismiss} title="Dismiss">
          <svg
            className="dismiss-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      <style jsx>{`
        .error-message {
          display: flex;
          align-items: flex-start;
          gap: 1.5rem;
          padding: 1.5rem;
          border-radius: 0.5rem;
          margin-bottom: 1.5rem;
          border-left: 4px solid var(--error-color, #ef4444);
          background-color: var(--error-bg, #fef2f2);
        }

        .error-icon-wrapper {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 3rem;
          height: 3rem;
          border-radius: 50%;
          background-color: var(--error-icon-bg, #fee2e2);
        }

        .error-icon {
          width: 1.75rem;
          height: 1.75rem;
          color: var(--error-color, #ef4444);
          flex-shrink: 0;
        }

        .error-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding-top: 0.25rem;
        }

        .error-title {
          margin: 0;
          font-size: 1rem;
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
          padding: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.2s;
          opacity: 0.7;
        }

        .dismiss-icon {
          width: 1.25rem;
          height: 1.25rem;
        }

        .error-dismiss:hover {
          opacity: 1;
        }

        @media (max-width: 640px) {
          .error-message {
            gap: 1rem;
            padding: 1rem;
          }

          .error-icon-wrapper {
            width: 2.5rem;
            height: 2.5rem;
          }

          .error-icon {
            width: 1.5rem;
            height: 1.5rem;
          }

          .error-title {
            font-size: 0.95rem;
          }

          .error-text {
            font-size: 0.85rem;
          }
        }
      `}</style>
    </div>
  )
}
