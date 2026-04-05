import React, { useCallback, useEffect, useMemo } from 'react'
import ConfiguratorCanvas from './ConfiguratorCanvas'
import { schemaToMermaid, mermaidToSchema } from '../lib/schemaToMermaid'
import {
  COL,
  ROW,
  NODE_WIDTH,
  INITIAL_UBD_EDGES,
  FALLBACK_NODES,
  FALLBACK_EDGES,
} from '../lib/ontologyBootstrap'
import { useOntologyStore } from '../model/ontologyStore'
import './OntologyTab.css'

/** Совместимость импортов из старого пути */
export {
  DEFAULT_FLOW_CODE,
  getSchemaFromFlowCode,
} from '../lib/ontologyBootstrap'

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

function OntologyTab({
  isVisible,
  onOpenDoc,
  flowCode: _flowCode,
  onFlowCodeChange: _onFlowCodeChange,
  openFromPlanning: _openFromPlanning,
  onOpenFromPlanningConsumed: _onOpenFromPlanningConsumed,
  configuratorNodeCommand,
  onConfiguratorNodeConsumed,
  initialSchemaNodes: _initialSchemaNodes,
  initialSchemaEdges: _initialSchemaEdges,
  schemaFromPlanningRef,
}) {
  const schemaNodes = useOntologyStore((s) => s.schemaNodes)
  const schemaEdges = useOntologyStore((s) => s.schemaEdges)
  const mode = useOntologyStore((s) => s.mode)
  const codeValue = useOntologyStore((s) => s.codeValue)
  const setSchemaNodes = useOntologyStore((s) => s.setSchemaNodes)
  const setSchemaEdges = useOntologyStore((s) => s.setSchemaEdges)
  const setMode = useOntologyStore((s) => s.setMode)
  const setCodeValue = useOntologyStore((s) => s.setCodeValue)

  const syncedCode = useMemo(
    () =>
      schemaNodes?.length && schemaEdges
        ? schemaToMermaid(schemaNodes, schemaEdges)
        : '',
    [schemaNodes, schemaEdges],
  )

  useEffect(() => {
    if (schemaNodes?.length && schemaFromPlanningRef) {
      schemaFromPlanningRef.current = { nodes: schemaNodes, edges: schemaEdges || [] }
    }
  }, [schemaNodes, schemaEdges, schemaFromPlanningRef])

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
  }, [configuratorNodeCommand, onConfiguratorNodeConsumed, setSchemaNodes])

  useEffect(() => {
    if (mode === 'code') setCodeValue(syncedCode)
  }, [mode, syncedCode, setCodeValue])

  const handleApplyCode = useCallback(() => {
    try {
      const { nodes: parsed, edges: parsedEdges } = mermaidToSchema(codeValue)
      if (parsed.length) {
        setSchemaNodes(parsed)
        setSchemaEdges(parsedEdges)
      }
    } catch (_) {}
  }, [codeValue, setSchemaNodes, setSchemaEdges])

  useEffect(() => {
    if (mode !== 'schema') return
    if (schemaNodes && schemaNodes.length > 0) return
    setSchemaNodes(FALLBACK_NODES)
    setSchemaEdges([...INITIAL_UBD_EDGES])
  }, [mode, schemaNodes, setSchemaNodes, setSchemaEdges])

  const displayNodes = schemaNodes?.length ? schemaNodes : FALLBACK_NODES
  const displayEdges = schemaEdges?.length ? schemaEdges : FALLBACK_EDGES

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
            key={isVisible ? 'canvas-visible' : 'canvas-hidden'}
            nodes={displayNodes}
            edges={displayEdges}
            onNodesChange={setSchemaNodes}
            onEdgesChange={setSchemaEdges}
            className="ontology-n8n-canvas"
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
              value={codeValue ?? ''}
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
