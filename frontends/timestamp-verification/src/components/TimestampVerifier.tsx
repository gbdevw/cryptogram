import { useState } from 'react'
import pLimit from 'p-limit'
import { useWeb3DocService } from '../hooks/useWeb3DocService'
import { useWeb3PGPService } from '../hooks/useWeb3PGPService'
import { useWellKnownKeys } from '../hooks/useWellKnownKeys'
import { FileUpload } from './FileUpload'
import { SuccessResult, ErrorResult } from './VerificationResult'
import { VerificationResult as VerificationResultType } from '../types/timestamp'
import { toBytes, toHex } from 'viem'

interface TimestampVerifierProps {
    idFromUrl?: string
}

export const TimestampVerifier = ({ idFromUrl }: TimestampVerifierProps) => {
    const web3DocService = useWeb3DocService()
    const web3PGPService = useWeb3PGPService()
    const { keys: wellKnownKeys } = useWellKnownKeys()
    const [loading, setLoading] = useState(false)
    const [results, setResults] = useState<VerificationResultType[]>([])
    const [fileName, setFileName] = useState<string>('')
    const [hasError, setHasError] = useState(false)

    const verifyTimestamp = async (hash: `0x${string}`, fileName: string) => {
        if (!web3DocService || !web3PGPService) {
            return
        }

        try {
            setLoading(true)
            setResults([])
            setHasError(false)
            setFileName(fileName)
            // Limit concurrent operations to 10
            const limit = pLimit(10)

            let timestampIds: bigint[] = []


            // If ID is provided in URL, use it directly
            if (idFromUrl) {
                timestampIds = [BigInt(idFromUrl)]
            } else {
                // Otherwise, find timestamps by hash
                timestampIds = await web3DocService.findTimestampsByHash(toBytes(hash))
            }

            // Load well-known keys used to verify the identity of timestamp signers
            const validResults: VerificationResultType[] = []
            const errors: string[] = []
            const wellKnownPublicKeys = await Promise.all(wellKnownKeys.map((fingerprint) =>
                limit(async () => {
                    try {
                        console.log(`Loading well-known key ${fingerprint}`)
                        const publicKey = await web3PGPService.getPublicKey(fingerprint)
                        return publicKey;
                    } catch (err) {
                        // Log and rethrow the error to be caught by Promise.all
                        const message = err instanceof Error ? err.message : 'Unknown error'
                        console.error(`Failed to load well-known key ${fingerprint}:`, err)
                        throw new Error(message);
                    }
                }))
            );

            // Build an array will the fingerprint of all well known keys and their subkeys
            const allWellKnownFingerprints: string[] = []
            for (const publicKey of wellKnownPublicKeys) {
                allWellKnownFingerprints.push(publicKey.getFingerprint())
                const subkeys = publicKey.getSubkeys()
                for (const subkey of subkeys) {
                    allWellKnownFingerprints.push(subkey.getFingerprint())
                }
            }

            // Verify each timestamp
            const timestampVerificationResults = await Promise.allSettled(timestampIds.map((id) =>
                limit(async () => {
                    try {
                        console.log(`Verifying timestamp with ID ${id.toString()}`)
                        const timestamp = await web3DocService.verifyTimestamp(id)
                        console.log(`Valid timestamp retrieved: ID = ${id.toString()}, Date = ${timestamp.date}, TX = ${timestamp.tx}, Hash = ${toHex(timestamp.documentHash)}, Emitter = ${timestamp.publicKey.getFingerprint()}`)
                        console.log('Verifying the timestamp matches the provided hash:', hash)
                        if (toHex(timestamp.documentHash) !== hash) {
                            console.error('File hash does not match the provided file hash')
                            return { status: 'rejected' as const, id, error: 'File hash does not match the provided file hash' }
                        } else {
                            // Verify the public key that has signed the timestamp is either well-known or trusted
                            console.log('Verifying the trust of the public key that signed the timestamp:', timestamp.publicKey.getFingerprint())
                            if(timestamp.publicKey.getFingerprint() in allWellKnownFingerprints) {
                                // The signing key is well-known, consider it valid
                                console.log('The public key that signed the timestamp is a well-known key')
                                return {
                                    status: 'fulfilled' as const,
                                    id,
                                    timestamp: timestamp.date,
                                    documentHash: hash,
                                    signerFingerprint: timestamp.publicKey.getFingerprint(),
                                    signerUserIds: timestamp.publicKey.getUserIDs(),
                                }
                            } 
                            // Bugfix: verifyAllUsers reject timestamps when a certification revocation is present even though the revocation happened after the timestamp date
                            // Temp. solution: filter out revocations that happened after the timestamp date according blockchain time
                            console.log(timestamp.tx ,timestamp.date)
                            timestamp.publicKey.users.forEach(user => {
                                user.revocationSignatures = user.revocationSignatures.filter(sig => (sig.created || new Date()) <= timestamp.date);
                            });
                            // If not well-known, verify its trust using the well-known keys
                            // Use the timestamp date to check the validity of the trust signatures at the time of the timestamp
                            const keyTrustVerification = await timestamp.publicKey.verifyAllUsers(wellKnownPublicKeys, timestamp.date)
                            console.log('Key trust verification results for timestamp:', id, keyTrustVerification)
                            if (keyTrustVerification.some(result => result.valid)) {
                                // The signing key is trusted by at least one well-known key
                                console.log('The public key that signed the timestamp is trusted by at least one well-known key')
                                return {
                                    status: 'fulfilled' as const,
                                    id,
                                    timestamp: timestamp.date,
                                    documentHash: hash,
                                    signerFingerprint: timestamp.publicKey.getFingerprint(),
                                    signerUserIds: timestamp.publicKey.getUserIDs(),
                                }
                            }
                            // If we reach here, the key is neither well-known nor trusted
                            console.error('The public key that signed the timestamp is neither well-known nor trusted at the time of the timestamp')
                            return { status: 'rejected' as const, id, error: 'The signer of the timestamp is not trusted by the service provider'}
                        }
                    } catch (err) {
                        const message = err instanceof Error ? err.message : 'Unknown error'
                        console.error(`Failed to verify timestamp ${id}:`, err)
                        return { status: 'rejected' as const, id, error: message }
                    }
                })
            ));

            timestampVerificationResults.forEach((result) => {
                if (result.status === 'fulfilled') {
                    const value = result.value
                    if (value.status === 'fulfilled') {
                        validResults.push({
                            id: value.id,
                            timestamp: value.timestamp,
                            documentHash: value.documentHash,
                            signerFingerprint: value.signerFingerprint,
                            signerUserIds: value.signerUserIds,
                        })
                    } else {
                        errors.push(`ID ${value.id}: ${value.error}`)
                    }
                } else {
                    errors.push(`Promise error: ${result.reason}`)
                }
            })

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
