import { useChainId } from 'wagmi'
import styles from '../styles/testnetFaucetButton.module.css'

const FAUCET_URLS: Record<number, string> = {
  11155111: 'https://sepolia-faucet.pk910.de/', // Sepolia
  534352: 'https://portal.scroll.io/bridge', // Scroll
}

const BUTTON_TEXT: Record<number, string> = {
  11155111: 'Get testnet ETH', // Sepolia
  534352: 'Get ETH', // Scroll
}

const BUTTON_TITLE: Record<number, string> = {
  11155111: 'Get testnet ETH (opens in new window)', // Sepolia
  534352: 'Get ETH via Scroll Bridge (opens in new window)', // Scroll
}

export function TestnetFaucetButton() {
  const chainId = useChainId()
  const faucetUrl = FAUCET_URLS[chainId]
  const buttonText = BUTTON_TEXT[chainId] || 'Get ETH'
  const buttonTitle = BUTTON_TITLE[chainId] || 'Get ETH (opens in new window)'

  if (!faucetUrl) {
    return null // Don't show button if chain is not supported
  }

  return (
    <a
      href={faucetUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.button}
      title={buttonTitle}
    >
      <span>{buttonText}</span>
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

