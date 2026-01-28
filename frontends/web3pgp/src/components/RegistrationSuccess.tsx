import React from 'react'
import { useChainId } from 'wagmi'

interface RegistrationSuccessProps {
  transactionHash: string
  onDone?: () => void
}

/**
 * Success screen displayed after successful key or subkey registration
 * Shows confirmation message and transaction details with link to explorer
 */
export function RegistrationSuccess({
  transactionHash,
  onDone,
}: RegistrationSuccessProps) {
  const chainId = useChainId()
  const [explorerUrl, setExplorerUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    // Try to get the explorer URL from viem's chain configuration
    try {
      // Import the chain dynamically based on chainId
      const chains = require('viem/chains')
      let chainName = ''

      // Map common chain IDs to their names
      const chainMap: Record<number, string> = {
        1: 'mainnet',
        5: 'goerli',
        11155111: 'sepolia',
        84532: 'baseSepolia',
        2192: 'swisstronik',
        7004: 'inkSepolia',
      }

      chainName = chainMap[chainId]

      if (chainName && chains[chainName]) {
        const chain = chains[chainName]
        if (chain.blockExplorers?.default?.url) {
          const baseUrl = chain.blockExplorers.default.url
          const txUrl = `${baseUrl}/tx/${transactionHash}`
          setExplorerUrl(txUrl)
        }
      }
    } catch (error) {
      console.log('Could not determine explorer URL:', error)
    }
  }, [chainId, transactionHash])

  return (
    <div className="registration-success">
      <div className="success-content">
        <div className="success-icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>

        <h1 className="success-title">Congratulations!</h1>
        <p className="success-message">
          Your public key has been registered in Web3PGP
        </p>

        <div className="transaction-details">
          <div className="detail-label">Transaction Hash</div>
          <div className="detail-value">
            <code>{transactionHash}</code>
            <button
              className="copy-button"
              onClick={() => {
                navigator.clipboard.writeText(transactionHash)
              }}
              title="Copy transaction hash"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              </svg>
            </button>
          </div>
        </div>

        <div className="action-buttons">
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="explorer-button"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
              <span>See in the Explorer</span>
            </a>
          )}

          <button className="done-button" onClick={onDone}>
            Done
          </button>
        </div>
      </div>

      <style jsx>{`
        .registration-success {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1rem;
          background: linear-gradient(
            135deg,
            rgba(16, 185, 129, 0.05) 0%,
            rgba(59, 130, 246, 0.05) 100%
          );
          animation: fadeIn 0.3s ease-out;
        }

        .success-content {
          width: 100%;
          max-width: 500px;
          text-align: center;
          background-color: white;
          border-radius: 1rem;
          border: 1px solid var(--border-color, #e5e7eb);
          padding: 3rem 2rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07), 0 10px 13px rgba(0, 0, 0, 0.05);
        }

        .success-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 1.5rem;
          background-color: rgba(16, 185, 129, 0.1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #10b981;
        }

        .success-icon svg {
          width: 44px;
          height: 44px;
          stroke-width: 2.5;
        }

        .success-title {
          margin: 0 0 0.75rem 0;
          font-size: 1.875rem;
          font-weight: 700;
          color: var(--text-primary, #1f2937);
        }

        .success-message {
          margin: 0 0 2rem 0;
          font-size: 1.0625rem;
          color: var(--text-secondary, #6b7280);
          line-height: 1.5;
        }

        .transaction-details {
          background-color: var(--bg-secondary, #f9fafb);
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 0.625rem;
          padding: 1.5rem;
          margin-bottom: 2rem;
          text-align: left;
        }

        .detail-label {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-secondary, #6b7280);
          margin-bottom: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .detail-value {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          word-break: break-all;
        }

        .detail-value code {
          flex: 1;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 0.8125rem;
          color: var(--text-primary, #1f2937);
          background-color: white;
          padding: 0.75rem;
          border-radius: 0.375rem;
          border: 1px solid var(--border-color, #e5e7eb);
          overflow-x: auto;
        }

        .copy-button {
          flex-shrink: 0;
          padding: 0.5rem;
          background-color: white;
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 0.375rem;
          cursor: pointer;
          color: var(--text-secondary, #6b7280);
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
        }

        .copy-button:hover {
          background-color: var(--bg-secondary, #f9fafb);
          color: var(--text-primary, #1f2937);
          border-color: var(--border-hover, #d1d5db);
        }

        .copy-button svg {
          width: 1rem;
          height: 1rem;
        }

        .action-buttons {
          display: flex;
          gap: 1rem;
          flex-direction: column;
        }

        .explorer-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 0.875rem 1.5rem;
          background-color: #3b82f6;
          color: white;
          border: none;
          border-radius: 0.625rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
        }

        .explorer-button:hover {
          background-color: #2563eb;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .explorer-button:active {
          transform: translateY(0);
        }

        .explorer-button svg {
          width: 1.25rem;
          height: 1.25rem;
        }

        .done-button {
          padding: 0.875rem 1.5rem;
          background-color: var(--bg-secondary, #f9fafb);
          color: var(--text-primary, #1f2937);
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 0.625rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .done-button:hover {
          background-color: white;
          border-color: var(--border-hover, #d1d5db);
        }

        .done-button:active {
          transform: scale(0.95);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 640px) {
          .success-content {
            padding: 2rem 1.5rem;
          }

          .success-title {
            font-size: 1.5rem;
          }

          .success-message {
            font-size: 1rem;
          }

          .action-buttons {
            flex-direction: column;
          }

          .explorer-button,
          .done-button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
