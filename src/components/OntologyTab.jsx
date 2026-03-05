import React, { useState } from 'react'
import MermaidSchema from './MermaidSchema'
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
const IconDoc = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)

export const DEFAULT_FLOW_CODE = `flowchart LR
  subgraph Вход
    A[Триггер события]
    B[Проверка данных]
  end
  subgraph Обработка
    C[Валидация]
    D[Расчёт показателей]
    E[Агрегация]
  end
  subgraph Выход
    F[Отчёт]
    G[Уведомление]
  end
  A --> B
  B --> C
  C --> D
  D --> E
  E --> F
  E --> G
  F --> H((Конец))
  G --> H
`

function OntologyTab({ onOpenDoc, flowCode, onFlowCodeChange }) {
  const [mode, setMode] = useState('code')
  const localCode = flowCode !== undefined ? flowCode : undefined
  const setCode = onFlowCodeChange || (() => {})
  const [internalCode, setInternalCode] = useState(DEFAULT_FLOW_CODE)
  const flowCodeValue = localCode !== undefined ? localCode : internalCode
  const setFlowCodeValue = localCode !== undefined ? setCode : setInternalCode

  return (
    <div className="ontology-tab ontology-tab-config">
      <h2 className="ontology-title">Конфигуратор систем</h2>
      <p className="ontology-subtitle">Код и схема синхронны с вкладкой «Планирование». Реализовано на базе концепции workflow-редактора (n8n).</p>
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
            <div className="ontology-code-toolbar">
              <button
                type="button"
                className="ontology-doc-btn"
                onClick={() => onOpenDoc?.()}
              >
                <IconDoc />
                Документация
              </button>
            </div>
            <textarea
              className="ontology-code-textarea"
              value={flowCodeValue}
              onChange={(e) => setFlowCodeValue(e.target.value)}
              placeholder="flowchart LR&#10;  A --> B --> C"
              spellCheck={false}
            />
          </div>
        )}
        {mode === 'schema' && (
          <div className="ontology-schema-panel">
            <MermaidSchema code={flowCodeValue} className="ontology-mermaid-schema" />
          </div>
        )}
      </div>
    </div>
  )
}

export default OntologyTab
