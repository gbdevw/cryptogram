import React, { useState, useRef } from 'react'
import { PublicKey } from 'openpgp'
import * as openpgp from 'openpgp'
import { useFileUpload } from '../hooks/useFileUpload'

interface RevokeCertificateInputProps {
  onPublicKeySubmit: (publicKey: PublicKey) => void
  onCertificateSubmit: (certificate: string) => void
  onError?: (error: string) => void
  isLoading?: boolean
}

/**
 * Form component for importing revocation certificates or public keys with revocation signatures
 * Users can either paste armored content or upload files
 */
export function RevokeCertificateInput({
  onPublicKeySubmit,
  onCertificateSubmit,
  onError,
  isLoading = false,
}: RevokeCertificateInputProps) {
  const [pastedContent, setPastedContent] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { readPublicKeyFromFile, isLoading: isFileLoading } = useFileUpload()

  /**
   * Parse input using the same fallback logic as the CLI
   * Try binary format first, then armored, then treat as certificate string
   */
  const parseInput = async (buffer: Buffer): Promise<PublicKey | string> => {
    try {
      // Try to read as key using binary format first
      return await openpgp.readKey({ binaryKey: buffer })
    } catch {
      try {
        // Try to read as key using armored format
        return await openpgp.readKey({ armoredKey: buffer.toString('ascii') })
      } catch {
        // Parse as armored standalone revocation certificate (string)
        return buffer.toString('ascii')
      }
    }
  }

  /**
   * Validates and processes pasted armored content
   */
  const handlePastedContentChange = async (value: string) => {
    setPastedContent(value)
    setLocalError(null)

    // Only try to validate if there's content to validate
    if (!value.trim()) {
      return
    }

    // Check if it looks like complete content (has closing marker)
    if (
      !value.includes('-----END PGP') &&
      !value.includes('-----END SIGNATURE-----')
    ) {
      return
    }

    // Attempt to parse and validate
    setIsValidating(true)

    try {
      const trimmedContent = value.trim()

      // Parse the input
      const parsed = await parseInput(Buffer.from(trimmedContent, 'ascii'))

      if (parsed instanceof openpgp.PublicKey) {
        // It's a public key - check for revoked items
        const isRevoked = await parsed.isRevoked()
        const revokedSubkeys: openpgp.Subkey[] = []
        for (const sk of parsed.getSubkeys()) {
          try {
            await sk.verify()
            // If verify succeeds, subkey is not revoked
          } catch (error) {
            if (error instanceof Error && error.message === 'Subkey is revoked') {
              revokedSubkeys.push(sk)
            }
          }
        }

        const hasRevocations = isRevoked || revokedSubkeys.length > 0

        if (hasRevocations) {
          // Success - reset form and notify parent
          setPastedContent('')
          setLocalError(null)
          onPublicKeySubmit(parsed)
        } else {
          throw new Error('No revoked keys found in the provided key')
        }
      } else {
        // It's a standalone revocation certificate string
        if (!parsed || parsed.trim().length === 0) {
          throw new Error('Invalid or empty revocation certificate')
        }
        // Success - reset form and notify parent
        setPastedContent('')
        setLocalError(null)
        onCertificateSubmit(parsed)
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to parse the content'
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
      const validExtensions = ['asc', 'gpg', 'txt', 'cert']
      const fileExtension = file.name.toLowerCase().split('.').pop() || ''

      if (!validExtensions.includes(fileExtension)) {
        throw new Error(
          `Invalid file type. Supported formats: ${validExtensions.join(', ')}`
        )
      }

      // Read file as buffer
      const fileBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(fileBuffer)

      // Parse the input
      const parsed = await parseInput(buffer)

      if (parsed instanceof openpgp.PublicKey) {
        // It's a public key - check for revoked items
        const isRevoked = await parsed.isRevoked()
        const revokedSubkeys: openpgp.Subkey[] = []
        for (const sk of parsed.getSubkeys()) {
          try {
            await sk.verify()
            // If verify succeeds, subkey is not revoked
          } catch (error) {
            if (error instanceof Error && error.message === 'Subkey is revoked') {
              revokedSubkeys.push(sk)
            }
          }
        }

        const hasRevocations = isRevoked || revokedSubkeys.length > 0

        if (hasRevocations) {
          // Success - reset form and notify parent
          setPastedContent('')
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
          setLocalError(null)
          onPublicKeySubmit(parsed)
        } else {
          throw new Error('No revoked keys found in the provided key')
        }
      } else {
        // It's a standalone revocation certificate string
        if (!parsed || parsed.trim().length === 0) {
          throw new Error('Invalid or empty revocation certificate')
        }
        // Success - reset form and notify parent
        setPastedContent('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        setLocalError(null)
        onCertificateSubmit(parsed)
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to read the file'
      setLocalError(errorMessage)
      onError?.(errorMessage)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  /**
   * Triggers file input click
   */
  const handleImportFileClick = () => {
    fileInputRef.current?.click()
  }

  const isProcessing = isValidating || isFileLoading || isLoading
  const hasError = !!localError

  return (
    <div className="revoke-certificate-input">
      <div className="form-header">
        <h2 className="form-title">Revoke a Public Key</h2>
        <p className="form-description">
          Publish a revocation certificate for your OpenPGP public key in the Web3PGP registry.
        </p>
      </div>

      <div className="form-content">
        {/* Textarea for pasting armored content */}
        <div className="form-section">
          <label htmlFor="revoke-content-input" className="section-label">
            Paste a revocation certificate or armored public key
          </label>
          <textarea
            id="revoke-content-input"
            className={`content-textarea ${hasError ? 'error' : ''}`}
            placeholder={`-----BEGIN PGP PUBLIC KEY BLOCK-----

mDMEaX1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop
qrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk
lmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefg
hijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcd
efghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZa

-----END PGP PUBLIC KEY BLOCK-----`}
            value={pastedContent}
            onChange={(e) => handlePastedContentChange(e.target.value)}
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
          <label className="section-label">
            Or import from a file
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".asc,.gpg,.txt,.rev,.cert"
            onChange={handleFileSelect}
            disabled={isProcessing}
            style={{ display: 'none' }}
          />
          <button
            className="import-button"
            onClick={handleImportFileClick}
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
                <span>Import from File (.asc, .gpg, .txt, .rev, .cert)</span>
              </>
            )}
          </button>
          <p className="section-hint">
            Supported formats: ASCII armored (.asc, .txt, .rev, .cert) or binary (.gpg)
          </p>
        </div>
      </div>

      <style jsx>{`
        .revoke-certificate-input {
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
          padding: 2rem 1rem;
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
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

        .content-textarea {
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

        .content-textarea:focus {
          outline: none;
          border-color: var(--primary-color, #0ea5e9);
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
        }

        .content-textarea:disabled {
          background-color: var(--bg-secondary, #f9fafb);
          cursor: not-allowed;
          opacity: 0.6;
        }

        .content-textarea.error {
          border-color: var(--error-color, #ef4444);
        }

        .content-textarea.error:focus {
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
          width: 100%;
          padding: 1rem;
          background-color: #667eea;
          border: none;
          border-radius: 0.5rem;
          color: white;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
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
        }

        .spinner {
          display: inline-block;
          width: 1rem;
          height: 1rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .section-hint {
          margin: 0.5rem 0 0 0;
          font-size: 0.875rem;
          color: var(--text-secondary, #6b7280);
          line-height: 1.5;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 640px) {
          .revoke-certificate-input {
            padding: 1rem 0.5rem;
          }

          .form-header {
            margin-bottom: 1.5rem;
          }

          .form-title {
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
          }

          .content-textarea {
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
