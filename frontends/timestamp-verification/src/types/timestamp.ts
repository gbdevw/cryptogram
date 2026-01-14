export interface VerificationResult {
  id: bigint
  timestamp: Date
  documentHash: string
  signerFingerprint: string
  signerUserIds: string[]
}

export interface VerificationError {
  id?: bigint
  message: string
}
