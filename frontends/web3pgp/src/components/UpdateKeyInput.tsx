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

  const hasError = !!localError

  return (
    <div className="update-key-input">
      <div className="form-header">
        <h2 className="form-title">Update a Public Key</h2>
        <p className="form-description">
          Manage your public key. Update its expiration date, its attached identities or modify its settings.
        </p>
      </div>

      <div className="form-content">
        {/* Textarea for pasting key */}
        <div className="form-section">
          <label htmlFor="pasted-key" className="section-label">
            Paste an armored public key
          </label>
          <textarea
            id="pasted-key"
            className={`key-textarea ${hasError ? 'error' : ''}`}
            placeholder={`-----BEGIN PGP PUBLIC KEY BLOCK-----

mDMEaX1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop
qrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk
lmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefg
hijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcd
efghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZa

-----END PGP PUBLIC KEY BLOCK-----`}
            value={pastedKey}
            onChange={(e) => handlePastedKeyChange(e.target.value)}
            disabled={isProcessing}
          />
        </div>

        {/* Error message */}
        {hasError && (
          <div className="error-container">
            <svg
              className="error-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="error-message">{localError}</p>
          </div>
        )}

        {/* File upload section */}
        <div className="form-section file-upload-section">
          <label className="section-label">Or import your public key from a file</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".asc,.gpg,.txt"
            onChange={handleFileSelect}
            disabled={isProcessing}
            style={{ display: 'none' }}
          />
          <button
            className="import-button"
            onClick={handleBrowseClick}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <span className="spinner"></span>
                <span>Reading file...</span>
              </>
            ) : (
              <>
                <svg
                  className="button-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Import from File (.asc, .gpg, .txt)</span>
              </>
            )}
          </button>
          <p className="section-hint">
            Supported formats: ASCII armored (.asc, .txt) or binary (.gpg)
          </p>
        </div>
      </div>

      <style jsx>{`
        .update-key-input {
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
          padding: 2rem 1rem;
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .form-header {
          margin-bottom: 2.5rem;
          flex-shrink: 0;
        }

        .form-title {
          margin: 0 0 0.75rem 0;
          font-size: 2rem;
          font-weight: 700;
          color: var(--text-primary, #1f2937);
        }

        .form-description {
          margin: 0;
          font-size: 1rem;
          color: var(--text-secondary, #6b7280);
          line-height: 1.6;
        }

        .form-content {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          flex: 1;
          overflow: hidden;
          min-height: 0;
        }

        .form-section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .section-label {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-primary, #1f2937);
        }

        .key-textarea {
          min-height: 200px;
          padding: 1rem;
          border: 2px solid var(--border-color, #e5e7eb);
          border-radius: 0.5rem;
          background-color: white;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 0.9rem;
          color: var(--text-primary, #1f2937);
          resize: vertical;
          transition: all 0.2s;
        }

        .key-textarea:focus {
          outline: none;
          border-color: var(--primary-color, #0ea5e9);
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
        }

        .key-textarea:disabled {
          background-color: var(--bg-secondary, #f9fafb);
          cursor: not-allowed;
          opacity: 0.6;
        }

        .key-textarea.error {
          border-color: var(--error-color, #ef4444);
        }

        .key-textarea.error:focus {
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }

        .error-container {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 1rem;
          background-color: var(--error-bg, #fef2f2);
          border: 1px solid var(--error-color, #ef4444);
          border-radius: 0.5rem;
        }

        .error-icon {
          flex-shrink: 0;
          width: 1.5rem;
          height: 1.5rem;
          color: var(--error-color, #ef4444);
          margin-top: 0.125rem;
        }

        .error-message {
          margin: 0;
          font-size: 0.9rem;
          color: var(--error-text, #991b1b);
        }

        .file-upload-section {
          padding: 1.5rem;
          background-color: var(--bg-secondary, #f9fafb);
          border: 2px dashed var(--border-color, #d1d5db);
          border-radius: 0.5rem;
        }

        .import-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 1rem 1.5rem;
          background-color: #667eea;
          color: white;
          border: none;
          border-radius: 0.5rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .import-button:hover:not(:disabled) {
          background-color: #5568d3;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .import-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .import-button:disabled {
          background-color: #667eea;
          opacity: 0.6;
          cursor: not-allowed;
        }

        .button-icon {
          width: 1.25rem;
          height: 1.25rem;
          flex-shrink: 0;
        }

        .spinner {
          display: inline-block;
          width: 1.25rem;
          height: 1.25rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .section-hint {
          margin: 0.5rem 0 0 0;
          font-size: 0.85rem;
          color: var(--text-secondary, #6b7280);
          font-style: italic;
        }

        @media (max-width: 640px) {
          .update-key-input {
            padding: 1rem 0.5rem;
          }

          .form-header {
            margin-bottom: 1.5rem;
          }

          .form-title {
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
          }

          .key-textarea {
            min-height: 150px;
            font-size: 0.85rem;
          }

          .import-button {
            padding: 0.875rem 1.25rem;
            font-size: 0.95rem;
          }
        }
      `}</style>
    </div>
  )
}
