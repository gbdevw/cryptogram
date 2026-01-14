export interface VerificationResult {
  id: bigint
  timestamp: number
  documentHash: string
}

export interface VerificationError {
  id?: bigint
  message: string
}
