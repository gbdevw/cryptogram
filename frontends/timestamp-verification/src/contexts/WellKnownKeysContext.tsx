import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react'

interface WellKnownKeysContextType {
  keys: `0x${string}`[]
  isLoading: boolean
  error: Error | null
}

const WellKnownKeysContext = createContext<WellKnownKeysContextType>({
  keys: [],
  isLoading: true,
  error: null,
})

let isInitialized = false

export const WellKnownKeysProvider = ({ children }: { children: ReactNode }) => {
  const [keys, setKeys] = useState<`0x${string}`[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const initializationAttempted = useRef(false)

  useEffect(() => {
    const loadWellKnownKeys = async () => {
      // Prevent multiple initialization attempts (handles React StrictMode)
      if (isInitialized || initializationAttempted.current) {
        setIsLoading(false)
        return
      }

      initializationAttempted.current = true

      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch('/well-known-keys.json')
        if (!response.ok) {
          throw new Error(`Failed to load well-known keys: ${response.statusText}`)
        }

        const data = await response.json()
        const loadedKeys = (data.keys || []) as `0x${string}`[]
        setKeys(loadedKeys)
        isInitialized = true
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error loading keys')
        setError(error)
        console.error('Failed to load well-known keys:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadWellKnownKeys()
  }, [])

  return (
    <WellKnownKeysContext.Provider value={{ keys, isLoading, error }}>
      {children}
    </WellKnownKeysContext.Provider>
  )
}

export const useWellKnownKeys = () => {
  const context = useContext(WellKnownKeysContext)
  if (!context) {
    throw new Error('useWellKnownKeys must be used within WellKnownKeysProvider')
  }
  return context
}
