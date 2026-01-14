import { useState, useEffect } from 'react'
import { useBlockchainServiceStatus } from './contexts/BlockchainServiceContext'
import { TimestampVerifier } from './components/TimestampVerifier'

function App() {
  const { isInitialized, isLoading, error } = useBlockchainServiceStatus()
  const [route, setRoute] = useState<{ path: string; id?: string }>({ path: 'timestamp' })

  // Parse hash route on mount and when hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) // Remove #
      const parts = hash.split('/')
      const path = parts[1] || 'timestamp'
      const id = parts[2]

      setRoute({
        path,
        id,
      })
    }

    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Navigate to default route on mount if no hash
  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = '#/timestamp'
    }
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f0f8ff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: '#0066cc',
          color: 'white',
          padding: '20px',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0, 102, 204, 0.2)',
        }}
      >
        <h1 style={{ margin: '0', fontSize: '32px', fontWeight: '700' }}>DEXES</h1>
        <p style={{ margin: '8px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
          Timestamp Verification System
        </p>
      </div>

      {/* Content */}
      <div style={{ padding: '20px' }}>
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ fontSize: '18px', color: '#0066cc' }}>Initializing services...</p>
          </div>
        )}

        {error && (
          <div
            style={{
              maxWidth: '800px',
              margin: '0 auto',
              backgroundColor: '#ffebee',
              border: '2px solid #d32f2f',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center',
            }}
          >
            <p style={{ color: '#c62828', margin: '0' }}>
              Failed to initialize: {error.message}
            </p>
          </div>
        )}

        {isInitialized && route.path === 'timestamp' && (
          <TimestampVerifier idFromUrl={route.id} />
        )}
      </div>
    </div>
  )
}

export default App
