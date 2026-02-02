import React, { useState, useRef } from 'react'
import { PublicKey } from 'openpgp'
import * as openpgp from 'openpgp'
import { useFileUpload } from '../hooks/useFileUpload'

interface UpdateKeyInputProps {
  onKeySubmit: (publicKey: PublicKey) => void
  onError?: (error: string) => void
  isLoading?: boolean
}

/**
 * Form component for importing OpenPGP public keys for update
 * Users can either paste armored keys or upload files (.asc, .gpg, .txt)
 * Similar to PublicKeyImportForm but for the update workflow
 */
export function UpdateKeyInput({
  onKeySubmit,
  onError,
  isLoading = false,
}: UpdateKeyInputProps) {
  const [pastedKey, setPastedKey] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { readPublicKeyFromFile, isLoading: isFileLoading } = useFileUpload()

  /**
   * Validates and parses pasted armored key
   * Automatically transitions to next screen if key is valid
   */
  const handlePastedKeyChange = async (value: string) => {
    setPastedKey(value)
    setLocalError(null)

    // Only try to validate if there's content to validate
    if (!value.trim()) {
      return
    }

    // Check if it looks like a complete key (has closing marker)
    if (!value.includes('-----END PGP PUBLIC KEY BLOCK-----')) {
      return
    }

    // Attempt to parse and validate
    setIsValidating(true)

    try {
      const trimmedKey = value.trim()

      // Basic validation: should start with PGP header
      if (!trimmedKey.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----')) {
        throw new Error(
          'Invalid armored key format. Key must start with "-----BEGIN PGP PUBLIC KEY BLOCK-----"'
        )
      }

      // Try to parse the key
      const keys = await openpgp.readKeys({ armoredKeys: trimmedKey })

      if (!keys || keys.length === 0) {
        throw new Error('No valid PGP key found in the pasted content')
      }

      const publicKey = keys[0]

      // Verify it's a public key (not private)
      if (publicKey.isPrivate()) {
        throw new Error(
          'Private keys are not supported. Please use only public keys.'
        )
      }

      // Success - reset form and notify parent
      setPastedKey('')
      setLocalError(null)
      onKeySubmit(publicKey)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to parse the public key'
      setLocalError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setIsValidating(false)
    }
  }

  /**
   * Handles file input change
   */
  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLocalError(null)

    try {
      // Validate file type
      const validExtensions = ['asc', 'gpg', 'txt']
      const fileExtension = file.name.toLowerCase().split('.').pop() || ''

      if (!validExtensions.includes(fileExtension)) {
        throw new Error(
          `Invalid file type: .${fileExtension}. Please use .asc, .gpg, or .txt files`
        )
      }

      // Validate file size (max 1MB)
      if (file.size > 1024 * 1024) {
        throw new Error('File size exceeds 1MB limit')
      }

      // Read and parse the key
      const publicKey = await readPublicKeyFromFile(file)

      if (!publicKey) {
        throw new Error('Failed to read the public key from file')
      }

      // Verify it's a public key (not private)
      if (publicKey.isPrivate()) {
        throw new Error(
          'Private keys are not supported. Please use only public keys.'
        )
      }

      // Reset form and notify parent
      setPastedKey('')
      setLocalError(null)
      onKeySubmit(publicKey)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to read the file'
      setLocalError(errorMessage)
      onError?.(errorMessage)
    }
  }

  /**
   * Trigger file input dialog
   */
  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  const isProcessing = isLoading || isValidating || isFileLoading

  return (
    <div className="update-key-input">
      <div className="input-container">
        <h2 className="form-title">Update Your OpenPGP Key</h2>
        <p className="form-description">
          Paste your updated public key or upload a file to update your
          registered key on the blockchain.
        </p>

        {/* Error message */}
        {localError && (
          <div className="error-message">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{localError}</span>
          </div>
        )}

        {/* Textarea for pasting key */}
        <div className="input-section">
          <label htmlFor="pasted-key" className="input-label">
            Paste Your Public Key
          </label>
          <textarea
            id="pasted-key"
            className="key-textarea"
            placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----&#10;..."
            value={pastedKey}
            onChange={(e) => handlePastedKeyChange(e.target.value)}
            disabled={isProcessing}
            rows={12}
          />
          <p className="input-hint">
            Paste your complete OpenPGP public key block in armored format
          </p>
        </div>

        {/* File input */}
        <div className="input-section">
          <label className="input-label">Or Upload a Key File</label>
          <div className="file-upload-area">
            <input
              ref={fileInputRef}
              type="file"
              accept=".asc,.gpg,.txt"
              onChange={handleFileSelect}
              disabled={isProcessing}
              className="file-input"
            />
            <button
              className="browse-button"
              onClick={handleBrowseClick}
              disabled={isProcessing}
              type="button"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Browse Files</span>
            </button>
            <p className="file-hint">
              Supported formats: .asc, .gpg, .txt (max 1MB)
            </p>
          </div>
        </div>

        {/* Processing state */}
        {isProcessing && (
          <div className="processing-message">
            <div className="spinner" />
            <span>
              {isFileLoading
                ? 'Reading file...'
                : isValidating
                  ? 'Validating key...'
                  : 'Processing...'}
            </span>
          </div>
        )}
      </div>

      <style jsx>{`
        .update-key-input {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background-color: var(--bg-primary, #ffffff);
        }

        .input-container {
          width: 100%;
          max-width: 600px;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-title {
          margin: 0;
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--text-primary, #1f2937);
        }

        .form-description {
          margin: 0;
          font-size: 0.95rem;
          color: var(--text-secondary, #6b7280);
          line-height: 1.5;
        }

        .error-message {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 1rem;
          background-color: var(--error-bg, #fee2e2);
          border: 1px solid #fecaca;
          border-radius: 0.5rem;
          color: var(--error-text, #991b1b);
        }

        .error-message svg {
          width: 1.25rem;
          height: 1.25rem;
          flex-shrink: 0;
          margin-top: 0.125rem;
        }

        .error-message span {
          font-size: 0.9rem;
        }

        .input-section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .input-label {
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--text-primary, #1f2937);
        }

        .key-textarea {
          width: 100%;
          padding: 1rem;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 0.85rem;
          line-height: 1.5;
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 0.375rem;
          background-color: var(--bg-secondary, #f9fafb);
          color: var(--text-primary, #1f2937);
          resize: vertical;
          transition: all 0.2s;
        }

        .key-textarea:focus {
          outline: none;
          border-color: #3b82f6;
          background-color: var(--bg-primary, #ffffff);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .key-textarea:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .input-hint {
          margin: 0;
          font-size: 0.85rem;
          color: var(--text-tertiary, #9ca3af);
        }

        .file-upload-area {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1.5rem;
          border: 2px dashed var(--border-color, #e5e7eb);
          border-radius: 0.5rem;
          background-color: var(--bg-secondary, #f9fafb);
          text-align: center;
        }

        .file-input {
          display: none;
        }

        .browse-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          background-color: #3b82f6;
          color: white;
          border: none;
          border-radius: 0.375rem;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.2s;
          align-self: center;
        }

        .browse-button:hover:not(:disabled) {
          background-color: #2563eb;
        }

        .browse-button:active:not(:disabled) {
          transform: scale(0.98);
        }

        .browse-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .browse-button svg {
          width: 1.25rem;
          height: 1.25rem;
        }

        .file-hint {
          margin: 0;
          font-size: 0.85rem;
          color: var(--text-tertiary, #9ca3af);
        }

        .processing-message {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 1rem;
          background-color: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 0.375rem;
          color: #1e40af;
          font-size: 0.9rem;
        }

        .spinner {
          width: 1rem;
          height: 1rem;
          border: 2px solid #1e40af;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 640px) {
          .update-key-input {
            padding: 1rem;
          }

          .form-title {
            font-size: 1.5rem;
          }

          .key-textarea {
            font-size: 0.8rem;
          }

          .file-upload-area {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  )
}
