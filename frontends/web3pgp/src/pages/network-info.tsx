import React, { useEffect, useState } from 'react'
import styles from '../styles/terms.module.css'

export default function NetworkInfoPage() {
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadNetworkInfo = async () => {
      try {
        const response = await fetch('/NETWORK_INFORMATION.md')
        if (!response.ok) {
          throw new Error('Failed to load network information')
        }
        const text = await response.text()
        setContent(text)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    loadNetworkInfo()
  }, [])

  const renderBoldText = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = []
    const regex = /\*\*([^*]+)\*\*/g
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index))
      }
      parts.push(
        <strong key={`bold-${match.index}`}>{match[1]}</strong>
      )
      lastIndex = regex.lastIndex
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }

    return parts.length > 0 ? parts : [text]
  }

  const parseMarkdown = (markdown: string): React.ReactNode => {
    const lines = markdown.split('\n')
    const elements: React.ReactNode[] = []
    let currentParagraph: string[] = []

    lines.forEach((line, index) => {
      // Handle headings
      if (line.startsWith('# ')) {
        if (currentParagraph.length > 0) {
          elements.push(
            <p key={`para-${elements.length}`} className={styles.paragraph}>
              {currentParagraph.map((text, idx) => (
                <React.Fragment key={idx}>{renderBoldText(text)}</React.Fragment>
              ))}
            </p>
          )
          currentParagraph = []
        }
        elements.push(
          <h1 key={`h1-${index}`} className={styles.heading1}>
            {line.replace('# ', '')}
          </h1>
        )
      } else if (line.startsWith('## ')) {
        if (currentParagraph.length > 0) {
          elements.push(
            <p key={`para-${elements.length}`} className={styles.paragraph}>
              {currentParagraph.map((text, idx) => (
                <React.Fragment key={idx}>{renderBoldText(text)}</React.Fragment>
              ))}
            </p>
          )
          currentParagraph = []
        }
        elements.push(
          <h2 key={`h2-${index}`} className={styles.heading2}>
            {line.replace('## ', '')}
          </h2>
        )
      } else if (line.startsWith('### ')) {
        if (currentParagraph.length > 0) {
          elements.push(
            <p key={`para-${elements.length}`} className={styles.paragraph}>
              {currentParagraph.map((text, idx) => (
                <React.Fragment key={idx}>{renderBoldText(text)}</React.Fragment>
              ))}
            </p>
          )
          currentParagraph = []
        }
        elements.push(
          <h3 key={`h3-${index}`} className={styles.heading3}>
            {line.replace('### ', '')}
          </h3>
        )
      } else if (line.startsWith('- ')) {
        if (currentParagraph.length > 0) {
          elements.push(
            <p key={`para-${elements.length}`} className={styles.paragraph}>
              {currentParagraph.map((text, idx) => (
                <React.Fragment key={idx}>{renderBoldText(text)}</React.Fragment>
              ))}
            </p>
          )
          currentParagraph = []
        }
        const listItem = line.substring(2).trim()
        elements.push(
          <li key={`li-${index}`} className={styles.listItem}>
            {renderBoldText(listItem)}
          </li>
        )
      } else if (line.startsWith('**') && line.endsWith(':**')) {
        if (currentParagraph.length > 0) {
          elements.push(
            <p key={`para-${elements.length}`} className={styles.paragraph}>
              {currentParagraph.map((text, idx) => (
                <React.Fragment key={idx}>{renderBoldText(text)}</React.Fragment>
              ))}
            </p>
          )
          currentParagraph = []
        }
        const label = line.replace(/\*\*|\:/g, '').trim()
        elements.push(
          <div key={`bold-${index}`} className={styles.boldLabel}>
            {label}:
          </div>
        )
      } else if (line.trim() === '') {
        if (currentParagraph.length > 0) {
          elements.push(
            <p key={`para-${elements.length}`} className={styles.paragraph}>
              {currentParagraph.map((text, idx) => (
                <React.Fragment key={idx}>{renderBoldText(text)}</React.Fragment>
              ))}
            </p>
          )
          currentParagraph = []
        }
      } else if (line.trim().length > 0) {
        currentParagraph.push(line.trim())
      }
    })

    if (currentParagraph.length > 0) {
      elements.push(
        <p key={`para-${elements.length}`} className={styles.paragraph}>
          {currentParagraph.map((text, idx) => (
            <React.Fragment key={idx}>{renderBoldText(text)}</React.Fragment>
          ))}
        </p>
      )
    }

    return elements
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <p>Loading network information...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <p className={styles.error}>Error: {error}</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {parseMarkdown(content)}
      </div>
    </div>
  )
}
