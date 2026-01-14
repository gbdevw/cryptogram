import { useState } from 'react'
import { keccak256 } from 'viem'
import { VerificationSteps } from './VerificationSteps'

interface FileUploadProps {
    onHashGenerated: (hash: `0x${string}`, fileName: string) => void
}

export const FileUpload = ({ onHashGenerated }: FileUploadProps) => {
    const [dragActive, setDragActive] = useState(false)
    const [fileName, setFileName] = useState<string>('')

    const processFile = (file: File) => {
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

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                style={{
                    border: `2px dashed ${dragActive ? '#0066cc' : '#6bb6ff'}`,
                    borderRadius: '12px',
                    padding: '40px',
                    textAlign: 'center',
                    backgroundColor: dragActive ? '#e6f2ff' : '#f0f8ff',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                }}
            >
                <input
                    type="file"
                    id="fileInput"
                    onChange={handleChange}
                    style={{ display: 'none' }}
                />
                <label htmlFor="fileInput" style={{ cursor: 'pointer', display: 'block' }}>
                    <p style={{ fontSize: '18px', color: '#0066cc', margin: '0 0 10px 0', fontWeight: '600' }}>
                        Drop your file here or click to upload
                    </p>
                    <p style={{ fontSize: '14px', color: '#0066cc', margin: '0' }}>
                        {fileName || 'Select a file to verify its authenticity'}
                    </p>
                </label>
            </div>
            <VerificationSteps />
        </div>
    )
}
