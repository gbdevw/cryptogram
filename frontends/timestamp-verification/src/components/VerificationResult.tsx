import { VerificationResult as VerificationResultType } from '../types/timestamp'

interface VerificationResultProps {
    results: VerificationResultType[]
    fileName: string
}

export const SuccessResult = ({ results, fileName }: VerificationResultProps) => {
    return (
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
            
            <div style={{ marginBottom: '20px' }}>
                <svg
                    width="80"
                    height="80"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ margin: '0 auto' }}
                >
                    <path
                        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                        stroke="#16a34a"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="#f0fdf4"
                    />
                    <path
                        d="M9 12l2 2 4-4"
                        stroke="#16a34a"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>

            <div
                style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderTop: '4px solid #16a34a',
                    borderRadius: '12px',
                    padding: '30px',
                    marginBottom: '20px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
            >
                <h2 style={{ color: '#1f2937', margin: '0 0 12px 0', fontSize: '24px' }}>
                    Document Verified
                </h2>
                <p style={{ color: '#4b5563', margin: '0', fontSize: '16px', lineHeight: '1.5' }}>
                    <strong>"{fileName}"</strong> has been verified as authentic and certified by a
                    trusted entity.
                </p>
            </div>

            <div style={{ marginTop: '32px' }}>
                <h3
                    style={{
                        color: '#374151',
                        marginBottom: '16px',
                        fontSize: '18px',
                        textAlign: 'center',
                    }}
                >
                    Trusted Certification Details
                </h3>

                {results.map((result, index) => (
                    <div
                        key={index}
                        style={{
                            backgroundColor: '#f9fafb',
                            border: '1px solid #e5e7eb',
                            borderBottom: '4px solid #16a34a', 
                            borderRadius: '8px',
                            padding: '20px',
                            marginBottom: '16px',
                            textAlign: 'left',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                                <strong style={{ color: '#1f2937', display: 'block', fontSize: '14px', marginBottom: '4px' }}>
                                    Certified by
                                </strong>
                                <span style={{ color: '#16a34a', fontWeight: '600', fontSize: '16px' }}>
                                    {result.signerUserIds[0] || 'Unknown Identity'}
                                </span>
                            </div>
                            
                            <div style={{ textAlign: 'right' }}>
                                <strong style={{ color: '#1f2937', display: 'block', fontSize: '14px', marginBottom: '4px' }}>
                                    Date
                                </strong>
                                <span style={{ color: '#4b5563', fontFamily: 'monospace', fontSize: '15px' }}>
                                    {result.timestamp.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export const ErrorResult = ({ fileName }: { fileName: string }) => {
    return (
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <div style={{ marginBottom: '20px' }}>
                <svg
                    width="80"
                    height="80"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ margin: '0 auto' }}
                >
                    <path 
                        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" 
                        stroke="#dc2626" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        fill="#fef2f2" 
                    />
                    <path 
                        d="M9 9l6 6M15 9l-6 6" 
                        stroke="#dc2626" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                    />
                </svg>
            </div>
            <div
                style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderTop: '4px solid #dc2626',
                    borderRadius: '12px',
                    padding: '30px',
                    marginBottom: '20px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
            >
                <h2 style={{ color: '#1f2937', margin: '0 0 15px 0', fontSize: '24px' }}>
                    Unknown Document
                </h2>

                <p style={{ color: '#4b5563', margin: '0 0 24px 0', fontSize: '16px', lineHeight: '1.5' }}>
                    We could not find any digital proof for <strong>"{fileName}"</strong> in the registry.
                </p>

                <div style={{ 
                    backgroundColor: '#f9fafb',
                    borderRadius: '6px', 
                    padding: '16px', 
                    textAlign: 'left',
                    fontSize: '14px',
                    color: '#6b7280',
                    border: '1px solid #f3f4f6'
                }}>
                    <strong style={{ color: '#374151', display: 'block', marginBottom: '4px' }}>Why is this happening?</strong>
                    This usually means the document has never been recorded by a trusted entity in the registry or it has been modified (even slightly).
                </div>
            </div>
        </div>
    );
};