import React, { useState, useCallback, useEffect, useRef } from 'react'
import ConfiguratorCanvas from './ConfiguratorCanvas'
import { schemaToMermaid, mermaidToSchema } from '../lib/schemaToMermaid'
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

/** Узлы по умолчанию из UBD — разложены без наложений (слои слева направо) */
const COL = 260
const ROW = 80
const INITIAL_UBD_NODES = [
  { id: 'spectr', label: 'СПЕКТР', type: 'trigger', x: 0, y: 1 * ROW },
  { id: 'b6k', label: 'Б6К', type: 'process', x: 1 * COL, y: 0 },
  { id: 'exoil', label: 'EXOIL', type: 'process', x: 1 * COL, y: 2 * ROW },
  { id: 'cdwell', label: 'ЦД well', type: 'process', x: 2 * COL, y: 0 },
  { id: 'gibrima', label: 'ГибрИМА', type: 'process', x: 2 * COL, y: 2 * ROW },
  { id: 'eraiskra', label: 'ЭРА ИСКРА', type: 'process', x: 2 * COL, y: 4 * ROW },
  { id: 'eraremonty', label: 'ЭраРемонты', type: 'process', x: 3 * COL, y: 0 },
  { id: 'ipa', label: 'ИПА', type: 'process', x: 3 * COL, y: 2 * ROW },
  { id: 'condition', label: 'Условие достижения макс. профиля ДДН', type: 'output', x: 2 * COL, y: 6 * ROW },
  { id: 'cdrb', label: 'ЦДРБ', type: 'output', x: 0, y: 4 * ROW },
  { id: 'burenie', label: 'Бурение', type: 'process', x: 1 * COL, y: 5 * ROW },
]

const INITIAL_UBD_EDGES = [
  { id: 'e-spectr-b6k', from: 'spectr', to: 'b6k' },
  { id: 'e-spectr-exoil', from: 'spectr', to: 'exoil' },
  { id: 'e-b6k-cdwell', from: 'b6k', to: 'cdwell' },
  { id: 'e-exoil-gibrima', from: 'exoil', to: 'gibrima' },
  { id: 'e-cdwell-gibrima', from: 'cdwell', to: 'gibrima' },
  { id: 'e-eraiskra-gibrima', from: 'eraiskra', to: 'gibrima' },
  { id: 'e-gibrima-condition', from: 'gibrima', to: 'condition' },
  { id: 'e-cdwell-eraremonty', from: 'cdwell', to: 'eraremonty' },
  { id: 'e-gibrima-ipa', from: 'gibrima', to: 'ipa' },
  { id: 'e-spectr-cdrb', from: 'spectr', to: 'cdrb' },
]

export const DEFAULT_FLOW_CODE = schemaToMermaid(INITIAL_UBD_NODES, INITIAL_UBD_EDGES)

const NODE_WIDTH = 200
const CANVAS_CENTER = 16384

function findFreeNodePosition(existing, startX, startY) {
  const STEP_X = COL
  const STEP_Y = ROW
  const maxTries = 500
  let x = startX
  let y = startY
  for (let i = 0; i < maxTries; i += 1) {
    const overlaps = existing.some((n) => {
      const dx = Math.abs((n.x || 0) - x)
      const dy = Math.abs((n.y || 0) - y)
      return dx < NODE_WIDTH && dy < 56
    })
    if (!overlaps) return { x, y }
    y += STEP_Y
    if (i % 12 === 11) {
      x += STEP_X
      y = startY
    }
  }
  return { x: startX, y: startY }
}

function centerNodesInField(nodes) {
  if (!nodes.length) return nodes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  nodes.forEach((n) => {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + NODE_WIDTH)
    maxY = Math.max(maxY, n.y + 56)
  })
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const dx = CANVAS_CENTER - cx
  const dy = CANVAS_CENTER - cy
  return nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }))
}

function OntologyTab({ onOpenDoc, flowCode, onFlowCodeChange, openFromPlanning, onOpenFromPlanningConsumed, configuratorNodeCommand, onConfiguratorNodeConsumed }) {
  const [mode, setMode] = useState('schema')
  const [schemaNodes, setSchemaNodes] = useState(() => centerNodesInField([...INITIAL_UBD_NODES]))
  const [schemaEdges, setSchemaEdges] = useState(() => [...INITIAL_UBD_EDGES])
  const [codeValue, setCodeValue] = useState('')
  const fitViewRef = useRef(null)

  const syncedCode = schemaToMermaid(schemaNodes, schemaEdges)

  useEffect(() => {
    if (!configuratorNodeCommand?.label) return
    const label = configuratorNodeCommand.label
    setSchemaNodes((prev) => {
      let maxX = -Infinity
      let refY = 0
      prev.forEach((n) => {
        if (n.x + NODE_WIDTH > maxX) {
          maxX = n.x + NODE_WIDTH
          refY = n.y
        }
      })
      const baseX = Number.isFinite(maxX) ? maxX + 50 : 0
      const baseY = refY
      const pos = findFreeNodePosition(prev, baseX, baseY)
      const id = `node-${Date.now()}`
      return [...prev, { id, label, type: 'process', x: pos.x, y: pos.y }]
    })
    onConfiguratorNodeConsumed?.()
  }, [configuratorNodeCommand, onConfiguratorNodeConsumed])

  useEffect(() => {
    if (mode === 'code') setCodeValue(syncedCode)
  }, [mode, syncedCode])

  const handleApplyCode = useCallback(() => {
    try {
      const { nodes: parsed, edges: parsedEdges } = mermaidToSchema(codeValue)
      if (parsed.length) {
        setSchemaNodes(parsed)
        setSchemaEdges(parsedEdges)
      }
    } catch (_) {}
  }, [codeValue])

  useEffect(() => {
    if (!openFromPlanning || !flowCode) return
    try {
      const { nodes: parsed, edges: parsedEdges } = mermaidToSchema(flowCode)
      if (!parsed.length) {
        onOpenFromPlanningConsumed?.()
        return
      }
      setSchemaNodes([])
      setSchemaEdges([])
      const delay = 120
      parsed.forEach((node, i) => {
        setTimeout(() => {
          setSchemaNodes((prev) => [...prev, node])
        }, i * delay)
      })
      const edgesStart = parsed.length * delay
      parsedEdges.forEach((edge, i) => {
        setTimeout(() => {
          setSchemaEdges((prev) => [...prev, edge])
        }, edgesStart + i * delay)
      })
      const total = edgesStart + parsedEdges.length * delay + 100
      const t = setTimeout(() => {
        fitViewRef.current?.()
        onOpenFromPlanningConsumed?.()
      }, total)
      return () => clearTimeout(t)
    } catch (_) {
      onOpenFromPlanningConsumed?.()
    }
  }, [openFromPlanning, flowCode, onOpenFromPlanningConsumed])

  return (
    <div className="ontology-tab ontology-tab-config">
      <h2 className="ontology-title">Конфигуратор систем</h2>
      <p className="ontology-subtitle">Код и схема синхронны с вкладкой «Планирование». Реализовано на базе концепции workflow-редактора.</p>
      <div className="ontology-view-toggle">
        <button type="button" className={`ontology-toggle-btn ${mode === 'schema' ? 'active' : ''}`} onClick={() => setMode('schema')}>
          <span className="ontology-toggle-icon"><IconSchema /></span>
          Схема
        </button>
        <button type="button" className={`ontology-toggle-btn ${mode === 'code' ? 'active' : ''}`} onClick={() => setMode('code')}>
          <span className="ontology-toggle-icon"><IconCode /></span>
          Код
        </button>
      </div>
      <div className={`ontology-config-wrap ${mode === 'schema' ? 'ontology-config-wrap-schema' : ''}`}>
        {mode === 'schema' && (
          <ConfiguratorCanvas
            nodes={schemaNodes}
            edges={schemaEdges}
            onNodesChange={setSchemaNodes}
            onEdgesChange={setSchemaEdges}
            className="ontology-n8n-canvas"
            onMounted={(fit) => { fitViewRef.current = fit; fit?.(); }}
          />
        )}
        {mode === 'code' && (
          <div className="ontology-code-panel">
            <div className="ontology-code-toolbar">
              <button type="button" className="ontology-doc-btn" onClick={() => onOpenDoc?.()}>
                <IconDoc />
                Документация
              </button>
              <button type="button" className="ontology-doc-btn ontology-apply-btn" onClick={handleApplyCode}>
                Применить к схеме
              </button>
            </div>
            <textarea
              className="ontology-code-textarea"
              value={codeValue}
              onChange={(e) => setCodeValue(e.target.value)}
              placeholder="flowchart LR"
              spellCheck={false}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default OntologyTab
