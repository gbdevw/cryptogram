import React, { useState } from 'react'

interface FingerprintSearchFormProps {
  onSearch: (fingerprint: string) => void
  isLoading: boolean
  initialValue?: string
}

/**
 * Form component for entering and submitting a fingerprint search
 * Provides input validation feedback and loading state management
 */
export function FingerprintSearchForm({
  onSearch,
  isLoading,
  initialValue = '',
}: FingerprintSearchFormProps) {
  const [fingerprint, setFingerprint] = useState(initialValue)
  const [touched, setTouched] = useState(false)

  /**
   * Check if fingerprint has valid format
   */
  const isValidFormat = (value: string): boolean => {
    const cleaned = value.trim().replace(/\s/g, '')
    return /^[0-9a-fA-F]{40}$/.test(cleaned) || /^[0-9a-fA-F]{64}$/.test(cleaned)
  }

  const isValid = fingerprint.length === 0 || isValidFormat(fingerprint)
  const showError = touched && fingerprint.length > 0 && !isValid

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFingerprint(e.target.value)
  }

  const handleBlur = () => {
    setTouched(true)
  }

  const handleClear = () => {
    setFingerprint('')
    setTouched(false)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setTouched(true)

    if (fingerprint.trim() && isValid) {
      onSearch(fingerprint)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="fingerprint-search-form">
      <div className="form-group">
        <label htmlFor="fingerprint-input">Public Key Fingerprint</label>
        <div className="input-wrapper">
          <input
            id="fingerprint-input"
            type="text"
            value={fingerprint}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isLoading}
            placeholder="Enter public key fingerprint (40 or 64 hex characters)"
            className={`fingerprint-input ${showError ? 'error' : ''} ${isLoading ? 'disabled' : ''}`}
            autoComplete="off"
            spellCheck="false"
          />
          {fingerprint && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="clear-button"
              title="Clear input"
            >
              ✕
            </button>
          )}
        </div>
        {showError && (
          <p className="error-message">
            Please enter a valid fingerprint (40 or 64 hexadecimal characters)
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading || !fingerprint.trim() || !isValid}
        className="submit-button"
      >
        {isLoading ? (
          <>
            <span className="spinner"></span>
            Searching...
          </>
        ) : (
          'Search'
        )}
      </button>

      <style jsx>{`
        .fingerprint-search-form {
          display: flex;
          gap: 1rem;
          align-items: flex-end;
          margin-bottom: 2rem;
          flex-wrap: wrap;
        }

        .form-group {
          flex: 1;
          min-width: 250px;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        label {
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--text-primary, #1f2937);
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .fingerprint-input {
          width: 100%;
          padding: 0.75rem;
          padding-right: 2.5rem;
          border: 2px solid var(--border-color, #d1d5db);
          border-radius: 0.375rem;
          font-size: 0.95rem;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .fingerprint-input:focus {
          outline: none;
          border-color: var(--primary-color, #0ea5e9);
          box-shadow: 0 0 0 3px var(--primary-color-alpha, rgba(14, 165, 233, 0.1));
        }

        .fingerprint-input.error {
          border-color: var(--error-color, #ef4444);
        }

        .fingerprint-input.error:focus {
          box-shadow: 0 0 0 3px var(--error-color-alpha, rgba(239, 68, 68, 0.1));
        }

        .fingerprint-input:disabled,
        .fingerprint-input.disabled {
          background-color: var(--bg-disabled, #f3f4f6);
          color: var(--text-disabled, #9ca3af);
          cursor: not-allowed;
        }

        .clear-button {
          position: absolute;
          right: 0.75rem;
          background: none;
          border: none;
          color: var(--text-secondary, #6b7280);
          cursor: pointer;
          padding: 0.25rem 0.5rem;
          font-size: 1rem;
          transition: color 0.2s;
        }

        .clear-button:hover {
          color: var(--text-primary, #1f2937);
        }

        .error-message {
          font-size: 0.85rem;
          color: var(--error-color, #ef4444);
          margin: 0;
        }

        .submit-button {
          padding: 0.75rem 1.5rem;
          background-color: #667eea;
          color: white;
          border: none;
          border-radius: 0.375rem;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          white-space: nowrap;
        }

        .submit-button:hover:not(:disabled) {
          background-color: #5568d3;
        }

        .submit-button:disabled {
          background-color: var(--primary-color-disabled, #cbd5e1);
          cursor: not-allowed;
        }

        .spinner {
          display: inline-block;
          width: 0.85rem;
          height: 0.85rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 640px) {
          .fingerprint-search-form {
            flex-direction: column;
            gap: 0.75rem;
          }

          .form-group {
            width: 100%;
          }

          .submit-button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </form>
  )
}
