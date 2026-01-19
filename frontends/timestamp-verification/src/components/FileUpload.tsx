import { useState, useRef } from 'react'
import { keccak256 } from 'viem'
import { VerificationSteps } from './VerificationSteps'

interface FileUploadProps {
    onHashGenerated: (hash: `0x${string}`, fileName: string) => void
}

export const FileUpload = ({ onHashGenerated }: FileUploadProps) => {
    const [dragActive, setDragActive] = useState(false)
    const [fileName, setFileName] = useState<string>('')
    const inputRef = useRef<HTMLInputElement>(null)

    const processFile = (file: File) => {
        // Optionnel : Vérification de taille ici si besoin
        const reader = new FileReader()
        reader.onload = (e) => {
            const content = e.target?.result as ArrayBuffer
            const hash = keccak256(new Uint8Array(content))
            setFileName(file.name)
            onHashGenerated(hash, file.name)
        }
        reader.readAsArrayBuffer(file)
    }

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else if (e.type === 'dragleave') {
            setDragActive(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        const files = e.dataTransfer.files
        if (files && files[0]) {
            processFile(files[0])
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files[0]) {
            processFile(files[0])
        }
    }

    const handleZoneClick = () => {
        // Petite sécurité : on reset la valeur pour permettre
        // de sélectionner le même fichier deux fois de suite si besoin
        if (inputRef.current) {
            inputRef.current.value = '' 
            inputRef.current.click()
        }
    }

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={handleZoneClick}
                style={{
                    border: `2px dashed ${dragActive ? '#0066cc' : '#6bb6ff'}`,
                    borderRadius: '12px',
                    padding: '40px',
                    textAlign: 'center',
                    backgroundColor: dragActive ? '#e6f2ff' : '#f0f8ff',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    touchAction: 'manipulation', // Important pour la réactivité mobile
                    position: 'relative' // Nécessaire pour cacher l'input proprement
                }}
            >
                {/* CORRECTION MAJEURE : 
                   1. Pas de display: none. On utilise une opacité 0 et une position absolue.
                   2. Pas d'attribut 'accept' pour éviter les filtres de média agressifs sur mobile.
                   3. capture={undefined} pour éviter d'ouvrir la caméra par défaut.
                */}
                <input
                    ref={inputRef}
                    type="file"
                    onChange={handleChange}
                    style={{ 
                        position: 'absolute',
                        width: '1px',
                        height: '1px',
                        padding: 0,
                        margin: -1,
                        overflow: 'hidden',
                        clip: 'rect(0,0,0,0)',
                        border: 0,
                        whiteSpace: 'nowrap'
                    }}
                />
                
                <div style={{ pointerEvents: 'none' }}>
                    <p style={{ fontSize: '18px', color: '#0066cc', margin: '0 0 10px 0', fontWeight: '600' }}>
                        Drop your file here or click to upload
                    </p>
                    <p style={{ fontSize: '14px', color: '#0066cc', margin: '0' }}>
                        {fileName || 'Select any file (PDF, Doc, Video, etc.)'}
                    </p>
                </div>
            </div>
            <VerificationSteps />
        </div>
    )
}