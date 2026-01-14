export const VerificationSteps = () => (
  <div style={{ 
    marginTop: '40px', 
    width: '100%', // Prend toute la largeur du parent (900px)
    boxSizing: 'border-box',
    textAlign: 'left'
  }}>
    
    <h3 style={{ 
      textAlign: 'center', 
      color: '#1e293b', 
      fontSize: '18px', 
      marginBottom: '32px',
      fontWeight: '600'
    }}>
      How the secure verification works
    </h3>

    {/* LISTE VERTICALE */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* ÉTAPE 1 */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '24px', 
        borderRadius: '12px', 
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        display: 'flex', // On aligne l'icône et le texte horizontalement
        gap: '20px',
        alignItems: 'flex-start'
      }}>
        {/* Icône à gauche (taille fixe pour ne pas s'écraser) */}
        <div style={{ 
          color: '#0066cc', 
          flexShrink: 0,
          backgroundColor: '#f0f8ff', // Petit fond bleu derrière l'icone
          padding: '12px',
          borderRadius: '50%'
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        </div>
        <div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#334155', fontWeight: '600' }}>1. Select Document</h4>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b', lineHeight: '1.5' }}>
            Choose the original file you want to verify. We support any file format (PDF, Images, etc.).
          </p>
        </div>
      </div>

      {/* ÉTAPE 2 */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '24px', 
        borderRadius: '12px', 
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        display: 'flex',
        gap: '20px',
        alignItems: 'flex-start'
      }}>
        <div style={{ 
          color: '#0066cc', 
          flexShrink: 0,
          backgroundColor: '#f0f8ff',
          padding: '12px',
          borderRadius: '50%'
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
          </svg>
        </div>
        <div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#334155', fontWeight: '600' }}>2. Registry Lookup</h4>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b', lineHeight: '1.5' }}>
            The system checks the registry for a valid cryptographic proof issued by a <strong>Trusted Entity</strong>.
          </p>
        </div>
      </div>

      {/* ÉTAPE 3 */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '24px', 
        borderRadius: '12px', 
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        display: 'flex',
        gap: '20px',
        alignItems: 'flex-start'
      }}>
        <div style={{ 
          color: '#0066cc', 
          flexShrink: 0,
          backgroundColor: '#f0f8ff',
          padding: '12px',
          borderRadius: '50%'
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <path d="M9 12l2 2 4-4"></path>
          </svg>
        </div>
        <div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#334155', fontWeight: '600' }}>3. Instant Verification</h4>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b', lineHeight: '1.5' }}>
            If a proof is found, we download it and mathematically verify that your file is authentic.
          </p>
        </div>
      </div>

    </div>

    {/* BLOC PRIVACY */}
    <div style={{ 
      marginTop: '32px', 
      backgroundColor: '#f0f9ff',
      border: '1px solid #bae6fd',
      borderRadius: '12px',
      padding: '20px',
      display: 'flex',
      gap: '20px',
      alignItems: 'flex-start',
      boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
    }}>
      <div style={{ 
        color: '#0284c7', 
        flexShrink: 0, 
        padding: '2px 0' // Petit ajustement pour aligner l'icone avec la première ligne de texte
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </div>
      <div>
        <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#0c4a6e', fontWeight: '600' }}>Privacy Guarantee</h4>
        <p style={{ margin: 0, fontSize: '14px', color: '#075985', lineHeight: '1.5' }}>
          Your document <strong>never leaves your device</strong>. The cryptographic fingerprint (hash) is calculated locally in your browser. We never upload your files to any server.
        </p>
      </div>
    </div>
  </div>
);