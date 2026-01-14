export interface VerificationResult {
  id: bigint
  timestamp: Date
  documentHash: string
}

export interface VerificationError {
  id?: bigint
  message: string
}
