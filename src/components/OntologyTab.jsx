import React, { useState } from 'react'
import './OntologyTab.css'

const IconCode = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
)
const IconSchema = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <line x1="10" y1="6.5" x2="14" y2="6.5" />
    <line x1="12" y1="10" y2="14" x2="12" />
    <line x1="10" y1="17.5" x2="14" y2="17.5" />
    <line x1="6.5" y1="12" y2="17.5" x2="6.5" />
  </svg>
)

const DEFAULT_FLOW_CODE = `flowchart LR
  A[Триггер] --> B[Обработка]
  B --> C[Выход]
`

function OntologyTab() {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') + '/'
  const [mode, setMode] = useState('code')
  const [flowCode, setFlowCode] = useState(DEFAULT_FLOW_CODE)

  return (
    <div className="ontology-tab ontology-tab-config">
      <h2 className="ontology-title">Конфигуратор систем</h2>
      <div className="ontology-view-toggle">
        <button type="button" className={`ontology-toggle-btn ${mode === 'code' ? 'active' : ''}`} onClick={() => setMode('code')}>
          <span className="ontology-toggle-icon"><IconCode /></span>
          Код
        </button>
        <button type="button" className={`ontology-toggle-btn ${mode === 'schema' ? 'active' : ''}`} onClick={() => setMode('schema')}>
          <span className="ontology-toggle-icon"><IconSchema /></span>
          Схема
        </button>
      </div>
      <div className="ontology-config-wrap">
        {mode === 'code' && (
          <div className="ontology-code-panel">
            <textarea
              className="ontology-code-textarea"
              value={flowCode}
              onChange={(e) => setFlowCode(e.target.value)}
              placeholder="flowchart LR&#10;  A --> B --> C"
              spellCheck={false}
            />
            <p className="ontology-code-hint">Синтаксис в стиле Mermaid. При переключении на «Схема» отображается визуализация.</p>
          </div>
        )}
        {mode === 'schema' && (
          <div className="ontology-schema-panel">
            <img
              src={`${base}n8n-mvp.png`}
              alt="Схема (n8n)"
              className="ontology-config-img"
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default OntologyTab
