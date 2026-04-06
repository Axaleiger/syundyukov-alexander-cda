import React, { useEffect, useState, useRef } from 'react'

let mermaidInitialized = false

async function initMermaid() {
  if (mermaidInitialized) return
  const mermaid = (await import('mermaid')).default
  mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    flowchart: { useMaxWidth: true, htmlLabels: true },
    securityLevel: 'loose',
  })
  mermaidInitialized = true
}

export default function MermaidSchema({ code, className = '' }) {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState(null)
  const containerRef = useRef(null)
  const renderIdRef = useRef(0)

  useEffect(() => {
    if (!code || !code.trim()) {
      setSvg('')
      setError(null)
      return
    }

    let cancelled = false

    async function render() {
      try {
        await initMermaid()
        const mermaid = (await import('mermaid')).default
        const id = `mermaid-${Date.now()}-${++renderIdRef.current}`
        const { svg: result } = await mermaid.render(id, code.trim())
        if (!cancelled) {
          setSvg(result)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setSvg('')
          setError(err?.message || String(err))
        }
      }
    }

    render()
    return () => { cancelled = true }
  }, [code])

  if (error) {
    return (
      <div className={`mermaid-schema-error ${className}`.trim()} ref={containerRef}>
        <p className="mermaid-schema-error-title">Ошибка отображения схемы</p>
        <pre className="mermaid-schema-error-message">{error}</pre>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className={`mermaid-schema-loading ${className}`.trim()} ref={containerRef}>
        <p>Загрузка схемы…</p>
      </div>
    )
  }

  return (
    <div
      className={`mermaid-schema ${className}`.trim()}
      ref={containerRef}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
