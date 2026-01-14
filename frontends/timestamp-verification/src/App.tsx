import { useState, useEffect } from 'react'
import { useWeb3PGPService } from './hooks/useWeb3PGPService'

function App() {
  console.log('App: Component rendered')
  const web3PGPService = useWeb3PGPService()
  const [publicKeyArmor, setPublicKeyArmor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPublicKey = async () => {
      if (!web3PGPService) {
        return
      }

      try {
        setLoading(true)
        setFetchError(null)

        const fingerprint = `0xD193A86A16DF334C651DFC9C097D8084740BB919` as `0x${string}`
        const publicKey = await web3PGPService.getPublicKey(fingerprint)
        const armor = await publicKey.armor()

        setPublicKeyArmor(armor)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setFetchError(message)
      } finally {
        setLoading(false)
      }
    }

    if (web3PGPService) {
      fetchPublicKey()
    }
  }, [web3PGPService])

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {loading && <p>Loading...</p>}
      {fetchError && <p style={{ color: 'red' }}>Error: {fetchError}</p>}
      {publicKeyArmor && publicKeyArmor}
    </div>
  )
}

export default App
