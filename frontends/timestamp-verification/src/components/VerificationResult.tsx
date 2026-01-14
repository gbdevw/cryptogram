import { VerificationResult as VerificationResultType } from '../types/timestamp'

interface VerificationResultProps {
  results: VerificationResultType[]
  fileName: string
}

export const SuccessResult = ({ results, fileName }: VerificationResultProps) => {
  return (
    <div style={{ textAlign: 'center', marginTop: '40px' }}>
      <div style={{ fontSize: '80px', marginBottom: '20px' }}>
        ✅
      </div>
      <div
        style={{
          backgroundColor: '#e8f5e9',
          border: '2px solid #4caf50',
          borderRadius: '12px',
          padding: '30px',
          marginBottom: '20px',
        }}
      >
        <h2 style={{ color: '#2e7d32', margin: '0 0 15px 0' }}>Document Verified</h2>
        <p style={{ color: '#558b2f', margin: '0 0 15px 0', fontSize: '16px' }}>
          {fileName} has been verified as authentic
        </p>
        <p style={{ color: '#7cb342', margin: '0', fontSize: '14px' }}>
          Found {results.length} valid timestamp{results.length !== 1 ? 's' : ''} in the registry
        </p>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3 style={{ color: '#0066cc', marginBottom: '15px' }}>Timestamp Details</h3>
        {results.map((result, index) => (
          <div
            key={index}
            style={{
              backgroundColor: '#f0f8ff',
              border: '1px solid #6bb6ff',
              borderRadius: '8px',
              padding: '15px',
              marginBottom: '10px',
              textAlign: 'left',
            }}
          >
            <p style={{ margin: '0', color: '#0066cc', fontWeight: '600' }}>
              ID: {result.id.toString()}
            </p>
            <p style={{ margin: '8px 0 0 0', color: '#6bb6ff', fontSize: '14px' }}>
              Timestamp: {new Date(Number(result.timestamp) * 1000).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export const ErrorResult = ({ fileName }: { fileName: string }) => {
  return (
    <div style={{ textAlign: 'center', marginTop: '40px' }}>
      <div style={{ fontSize: '80px', marginBottom: '20px' }}>
        ❌
      </div>
      <div
        style={{
          backgroundColor: '#ffebee',
          border: '2px solid #d32f2f',
          borderRadius: '12px',
          padding: '30px',
        }}
      >
        <h2 style={{ color: '#c62828', margin: '0 0 15px 0' }}>Document Not Found</h2>
        <p style={{ color: '#e53935', margin: '0', fontSize: '16px' }}>
          No trace of {fileName} was found in the registry
        </p>
      </div>
    </div>
  )
}
