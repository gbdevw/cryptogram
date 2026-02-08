import { useState } from 'react'
import { useNetwork } from '../contexts/NetworkContext'
import styles from '../styles/networkSwitcher.module.css'

export function NetworkSwitcher() {
  const { currentChain, switchChain, availableChains } = useNetwork()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const currentChainConfig = availableChains.find(c => c.id === currentChain)

  const handleSwitchChain = async (chainId: typeof currentChain) => {
    setIsLoading(true)
    try {
      await switchChain(chainId)
      setIsOpen(false)
    } catch (error) {
      console.error('Failed to switch chain:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <button
        className={styles.button}
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        title="Switch network"
      >
        <span className={styles.network}>{currentChainConfig?.displayName || 'Network'}</span>
        <span className={styles.icon}>▼</span>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          {availableChains.map(chain => (
            <button
              key={chain.id}
              className={`${styles.dropdownItem} ${currentChain === chain.id ? styles.active : ''}`}
              onClick={() => handleSwitchChain(chain.id)}
              disabled={isLoading}
            >
              <span className={styles.label}>{chain.displayName}</span>
              {currentChain === chain.id && <span className={styles.checkmark}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
