import React, { useState, useRef, useEffect } from 'react'
import { PublicKey } from 'openpgp'
import * as openpgp from 'openpgp'
import { useWeb3PGPService } from '../hooks/useWeb3PGPService'
import { to0x } from '@jibidieuw/dexes'

interface FingerPrintVerificationInputProps {
  certificate: string
  onVerify: (publicKey: PublicKey) => void
  onError: (error: string) => void
}

/**
 * Component for verifying a standalone revocation certificate
 * User provides the fingerprint of the key to revoke, and the component validates
 * that the certificate actually revokes that key
 */
export function FingerPrintVerificationInput({
  certificate,
  onVerify,
  onError,
}: FingerPrintVerificationInputProps) {
  const web3pgpService = useWeb3PGPService()
  const [fingerprint, setFingerprint] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus()
  }, [])

  /**
   * Validates fingerprint format (40 hex characters)
   */
  const validateFingerprintFormat = (fp: string): boolean => {
    // Remove spaces and make uppercase
    const clean = fp.replaceAll(/\s/g, '').toUpperCase()
    // Check if it's 40 hex characters
    return /^[0-9A-F]{40}$/.test(clean)
  }

  /**
   * Handles fingerprint verification
   */
  const handleVerifyClick = async () => {
    if (!web3pgpService) {
      setLocalError('Web3PGP service not available')
      onError('Web3PGP service not available')
      return
    }

    setLocalError(null)
    setIsVerifying(true)

    try {
      // Normalize fingerprint (remove spaces, uppercase)
      const normalizedFingerprint = fingerprint.replaceAll(/\s/g, '').toUpperCase()

      // Validate fingerprint format
      if (!validateFingerprintFormat(normalizedFingerprint)) {
        throw new Error(
          'Invalid fingerprint format. Must be 40 hexadecimal characters.'
        )
      }

      // Download the public key from the blockchain
      const fingerprintHex = to0x(normalizedFingerprint)
      const publicKey = await web3pgpService.getPublicKey(fingerprintHex)

      if (!publicKey) {
        throw new Error(
          'Key not found on the blockchain. Please verify the fingerprint is correct.'
        )
      }

      // Apply the revocation certificate to the downloaded key
      const revocationCheckDate = new Date()
      const revoked = await openpgp.revokeKey({
        key: publicKey,
        revocationCertificate: certificate,
        date: revocationCheckDate,
        format: 'object',
      })

      // Verify that the key is actually revoked after applying the certificate
      const isPrimaryRevoked = await revoked.publicKey.isRevoked()
      const subkeys = revoked.publicKey.getSubkeys()
      const revokedSubkeys = []

      for (const subkey of subkeys) {
        try {
          await subkey.verify()
          // If verify succeeds, subkey is not revoked
        } catch (error) {
          if (error instanceof Error && error.message === 'Subkey is revoked') {
            revokedSubkeys.push(subkey.getFingerprint())
          }
        }
      }

      if (!isPrimaryRevoked && revokedSubkeys.length === 0) {
        throw new Error(
          'The revocation certificate did not revoke the key. Please check the certificate and fingerprint.'
        )
      }

      // Success - notify parent with the revoked key
      setLocalError(null)
      onVerify(revoked.publicKey)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to verify revocation'
      setLocalError(errorMessage)
      onError(errorMessage)
      console.error('Revocation verification failed:', err)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFingerprint(e.target.value)
    setLocalError(null)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isVerifying) {
      handleVerifyClick()
    }
  }

  const isInputValid = fingerprint.trim().length > 0
  const hasError = !!localError

  return (
    <div className="fingerprint-verification-input">
      <div className="form-header">
        <h2 className="form-title">Verify Revocation</h2>
        <p className="form-description">
          Enter the fingerprint of the key to revoke. The application will download
          the key from the blockchain and verify that the revocation certificate
          revokes it.
        </p>
      </div>

      <div className="form-content">
        <div className="form-section">
          <label htmlFor="fingerprint-input" className="section-label">
            Key Fingerprint (40 hex characters)
          </label>
          <input
            ref={inputRef}
            id="fingerprint-input"
            type="text"
            className={`fingerprint-input ${hasError ? 'error' : ''}`}
            placeholder="AAAA BBBB CCCC DDDD EEEE 1111 2222 3333 4444 5555"
            value={fingerprint}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            disabled={isVerifying}
            spellCheck="false"
          />
          <p className="section-hint">
            Format: 40 hexadecimal characters. Spaces are optional.
          </p>
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

        {/* Verify button */}
        <button
          className="verify-button"
          onClick={handleVerifyClick}
          disabled={!isInputValid || isVerifying}
        >
          {isVerifying ? (
            <>
              <span className="spinner"></span>
              <span>Verifying revocation...</span>
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
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Verify Revocation</span>
            </>
          )}
        </button>
      </div>

      <style jsx>{`
        .fingerprint-verification-input {
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
          margin-bottom: 2rem;
          flex-shrink: 0;
        }

        .form-title {
          margin: 0 0 1rem 0;
          font-size: 1.875rem;
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
          gap: 1.5rem;
          flex: 1;
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

        .fingerprint-input {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 2px solid var(--border-color, #e5e7eb);
          border-radius: 0.5rem;
          font-family: 'Courier New', monospace;
          font-size: 0.95rem;
          letter-spacing: 0.05em;
          color: var(--text-primary, #1f2937);
          background-color: white;
          transition: border-color 0.2s, background-color 0.2s;
          text-transform: uppercase;
        }

        .fingerprint-input:focus {
          outline: none;
          border-color: var(--primary-color, #0ea5e9);
          background-color: #f0f9ff;
        }

        .fingerprint-input:disabled {
          background-color: var(--bg-secondary, #f9fafb);
          color: var(--text-disabled, #9ca3af);
          cursor: not-allowed;
        }

        .fingerprint-input.error {
          border-color: #ef4444;
          background-color: #fef2f2;
        }

        .section-hint {
          margin: 0;
          font-size: 0.875rem;
          color: var(--text-secondary, #6b7280);
          line-height: 1.5;
        }

        .error-container {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 1rem;
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 0.375rem;
        }

        .error-icon {
          flex-shrink: 0;
          width: 1.25rem;
          height: 1.25rem;
          color: #dc2626;
          margin-top: 0.125rem;
        }

        .error-message {
          margin: 0;
          font-size: 0.95rem;
          color: #991b1b;
          line-height: 1.5;
        }

        .verify-button {
          padding: 1rem;
          background-color: var(--primary-color, #0ea5e9);
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
          transition: background-color 0.2s, transform 0.1s;
        }

        .verify-button:hover:not(:disabled) {
          background-color: var(--primary-hover, #0284c7);
          transform: translateY(-1px);
        }

        .verify-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .verify-button:disabled {
          background-color: var(--border-color, #e5e7eb);
          color: var(--text-disabled, #9ca3af);
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

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 640px) {
          .fingerprint-verification-input {
            padding: 1rem;
          }

          .form-title {
            font-size: 1.5rem;
          }

          .form-description {
            font-size: 0.95rem;
          }
        }
      `}</style>
    </div>
  )
}
