import { useState, useCallback } from 'react'
import * as openpgp from 'openpgp'
import { PublicKey } from 'openpgp'

interface UseFileUploadReturn {
  isLoading: boolean
  error: string | null
  readPublicKeyFromFile: (file: File) => Promise<PublicKey>
  reset: () => void
}

/**
 * Custom hook to read and parse OpenPGP public keys from files
 * Supports both armored (.asc, .txt) and binary (.gpg) formats
 */
export function useFileUpload(): UseFileUploadReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Reads a file as text (armored format)
   */
  const readFileAsText = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        resolve(content)
      }
      reader.onerror = () => {
        reject(new Error('Failed to read file'))
      }
      reader.readAsText(file)
    })
  }, [])

  /**
   * Reads a file as binary (for .gpg format)
   */
  const readFileAsBinary = useCallback((file: File): Promise<Uint8Array> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer
        resolve(new Uint8Array(arrayBuffer))
      }
      reader.onerror = () => {
        reject(new Error('Failed to read file'))
      }
      reader.readAsArrayBuffer(file)
    })
  }, [])

  /**
   * Parses armored key text
   */
  const parseArmoredKey = useCallback(
    async (armoredText: string): Promise<PublicKey> => {
      try {
        const keys = await openpgp.readKeys({ armoredKeys: armoredText })
        if (!keys || keys.length === 0) {
          throw new Error('No valid PGP keys found in the file')
        }
        // Return the first key (primary key)
        return keys[0]
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to parse armored key: ${error.message}`)
        }
        throw new Error('Failed to parse armored key')
      }
    },
    []
  )

  /**
   * Parses binary key data
   */
  const parseBinaryKey = useCallback(
    async (binaryData: Uint8Array): Promise<PublicKey> => {
      try {
        const keys = await openpgp.readKeys({ binaryKeys: binaryData })
        if (!keys || keys.length === 0) {
          throw new Error('No valid PGP keys found in the file')
        }
        // Return the first key (primary key)
        return keys[0]
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to parse binary key: ${error.message}`)
        }
        throw new Error('Failed to parse binary key')
      }
    },
    []
  )

  /**
   * Reads a public key from a file
   * Automatically detects format based on file extension or tries both formats
   */
  const readPublicKeyFromFile = useCallback(
    async (file: File): Promise<PublicKey> => {
      setIsLoading(true)
      setError(null)

      try {
        // Check file extension to determine format
        const extension = file.name.toLowerCase().split('.').pop() || ''

        let publicKey: PublicKey

        if (extension === 'gpg') {
          // Binary format
          const binaryData = await readFileAsBinary(file)
          publicKey = await parseBinaryKey(binaryData)
        } else if (extension === 'asc' || extension === 'txt') {
          // Armored format
          const armoredText = await readFileAsText(file)
          publicKey = await parseArmoredKey(armoredText)
        } else {
          // Try text first, then binary
          try {
            const armoredText = await readFileAsText(file)
            publicKey = await parseArmoredKey(armoredText)
          } catch {
            // If armored parsing fails, try binary
            const binaryData = await readFileAsBinary(file)
            publicKey = await parseBinaryKey(binaryData)
          }
        }

        setError(null)
        return publicKey
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to read or parse the public key file'
        setError(errorMessage)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [readFileAsText, readFileAsBinary, parseArmoredKey, parseBinaryKey]
  )

  /**
   * Resets all state to initial values
   */
  const reset = useCallback(() => {
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    isLoading,
    error,
    readPublicKeyFromFile,
    reset,
  }
}
