import { useChainId } from 'wagmi'
import styles from '../styles/testnetFaucetButton.module.css'

const FAUCET_URLS: Record<number, string> = {
  11155111: 'https://sepolia-faucet.pk910.de/', // Sepolia
  534351: 'https://portal-sepolia.scroll.io/bridge', // Scroll Sepolia
}

export function TestnetFaucetButton() {
  const chainId = useChainId()
  const faucetUrl = FAUCET_URLS[chainId]

  if (!faucetUrl) {
    return null // Don't show button if chain is not supported
  }

  return (
    <a
      href={faucetUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.button}
      title="Get testnet ETH (opens in new window)"
    >
      <span>Get testnet ETH</span>
      <svg
        className={styles.icon}
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 7h10v10"></path>
        <path d="M7 17L17 7"></path>
      </svg>
    </a>
  )
}

