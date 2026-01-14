import { useState } from 'react'
import { useWeb3DocService } from '../hooks/useWeb3DocService'
import { FileUpload } from './FileUpload'
import { SuccessResult, ErrorResult } from './VerificationResult'
import { VerificationResult as VerificationResultType } from '../types/timestamp'
import { toBytes, toHex } from 'viem'

interface TimestampVerifierProps {
    idFromUrl?: string
}

export const TimestampVerifier = ({ idFromUrl }: TimestampVerifierProps) => {
    const web3DocService = useWeb3DocService()
    const [loading, setLoading] = useState(false)
    const [results, setResults] = useState<VerificationResultType[]>([])
    const [fileName, setFileName] = useState<string>('')
    const [hasError, setHasError] = useState(false)

    const verifyTimestamp = async (hash: `0x${string}`, fileName: string) => {
        if (!web3DocService) {
            return
        }

        try {
            setLoading(true)
            setResults([])
            setHasError(false)
            setFileName(fileName)

            let timestampIds: bigint[] = []

            // If ID is provided in URL, use it directly
            if (idFromUrl) {
                timestampIds = [BigInt(idFromUrl)]
            } else {
                // Otherwise, find timestamps by hash
                timestampIds = await web3DocService.findTimestampsByHash(toBytes(hash))
            }

            const validResults: VerificationResultType[] = []
            const errors: string[] = []

            // Verify each timestamp
            for (const id of timestampIds) {
                try {
                    const timestamp = await web3DocService.verifyTimestamp(id)
                    console.log('Timestamp hash:', toHex(timestamp.documentHash))
                    console.log('Provided hash:', hash)
                    if (toHex(timestamp.documentHash) !== hash) {
                        console.error('Document hash does not match the provided file hash')
                        errors.push(`ID ${id}: Document hash does not match the provided file hash`)
                    } else {
                        console.log('Timestamp verified successfully:', timestamp.date, timestamp.tx)
                        validResults.push({
                            id,
                            timestamp: Number(timestamp),
                            documentHash: hash,
                        })
                    }
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'Unknown error'
                    errors.push(`ID ${id}: ${message}`)
                    console.error(`Failed to verify timestamp ${id}:`, err)
                }
            }

            if (validResults.length === 0) {
                setHasError(true)
                if (errors.length > 0) {
                    console.log('Verification errors:', errors)
                }
            } else {
                setResults(validResults)
            }
        } catch (err) {
            console.error('Failed to verify file:', err)
            setHasError(true)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
            {!fileName ? (
                <FileUpload onHashGenerated={verifyTimestamp} />
            ) : (
                <>
                    {loading && (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <p style={{ fontSize: '18px', color: '#0066cc' }}>Verifying timestamp...</p>
                        </div>
                    )}

                    {!loading && hasError && <ErrorResult fileName={fileName} />}

                    {!loading && results.length > 0 && (
                        <SuccessResult results={results} fileName={fileName} />
                    )}

                    {!loading && fileName && (
                        <button
                            onClick={() => {
                                setFileName('')
                                setResults([])
                                setHasError(false)
                            }}
                            style={{
                                marginTop: '30px',
                                width: '100%',
                                padding: '12px',
                                backgroundColor: '#0066cc',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '16px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'backgroundColor 0.3s ease',
                            }}
                            onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor = '#0052a3')
                            }
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor = '#0066cc')
                            }
                        >
                            Verify Another File
                        </button>
                    )}
                </>
            )}
        </div>
    )
}
