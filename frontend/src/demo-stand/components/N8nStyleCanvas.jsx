import React, { useState, useRef, useCallback } from 'react'
import './N8nStyleCanvas.css'

/** Узлы и рёбра из UBD.drawio (СПЕКТР, Б6К, EXOIL, ГибрИМА, ЦД well, ЭРА ИСКРА, ЭраРемонты, ИПА и др.) */
const UBD_NODES = [
  { id: 'spectr', label: 'СПЕКТР', type: 'trigger', x: 80, y: 200 },
  { id: 'b6k', label: 'Б6К', type: 'process', x: 280, y: 160 },
  { id: 'exoil', label: 'EXOIL', type: 'process', x: 280, y: 260 },
  { id: 'cdwell', label: 'ЦД well', type: 'process', x: 480, y: 160 },
  { id: 'gibrima', label: 'ГибрИМА', type: 'process', x: 480, y: 260 },
  { id: 'eraiskra', label: 'ЭРА ИСКРА', type: 'process', x: 480, y: 360 },
  { id: 'eraremonty', label: 'ЭраРемонты', type: 'process', x: 700, y: 160 },
  { id: 'ipa', label: 'ИПА', type: 'process', x: 700, y: 260 },
  { id: 'condition', label: 'Условие достижения макс. профиля ДДН', type: 'output', x: 320, y: 420 },
  { id: 'cdrb', label: 'ЦДРБ', type: 'output', x: 80, y: 400 },
]

const UBD_EDGES = [
  { from: 'spectr', to: 'b6k' },
  { from: 'spectr', to: 'exoil' },
  { from: 'b6k', to: 'cdwell' },
  { from: 'exoil', to: 'gibrima' },
  { from: 'cdwell', to: 'gibrima' },
  { from: 'eraiskra', to: 'gibrima' },
  { from: 'gibrima', to: 'condition' },
  { from: 'cdwell', to: 'eraremonty' },
  { from: 'gibrima', to: 'ipa' },
  { from: 'spectr', to: 'cdrb' },
]

function N8nStyleCanvas({ className = '' }) {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const [startPan, setStartPan] = useState({ x: 0, y: 0 })
  const containerRef = useRef(null)

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.05 : 0.05
    setTransform((t) => ({
      ...t,
      scale: Math.min(2, Math.max(0.3, t.scale + delta)),
    }))
  }, [])

  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.n8n-node')) return
    setIsPanning(true)
    setStartPan({ x: e.clientX - transform.x, y: e.clientY - transform.y })
  }, [transform.x, transform.y])

  const handleMouseMove = useCallback((e) => {
    if (!isPanning) return
    setTransform((t) => ({
      ...t,
      x: e.clientX - startPan.x,
      y: e.clientY - startPan.y,
    }))
  }, [isPanning, startPan])

  const handleMouseUp = useCallback(() => setIsPanning(false), [])

  React.useEffect(() => {
    const onUp = () => setIsPanning(false)
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [])

  const nodeMap = React.useMemo(() => Object.fromEntries(UBD_NODES.map((n) => [n.id, n])), [])

  return (
    <div
      className={`n8n-canvas-wrap ${className}`.trim()}
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="n8n-canvas"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          cursor: isPanning ? 'grabbing' : 'grab',
        }}
      >
        <div className="n8n-canvas-dots" aria-hidden />
        <svg className="n8n-edges" width="4000" height="2000" style={{ left: 0, top: 0 }}>
          <defs>
            <marker id="n8n-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0 0 L6 3 L0 6 z" fill="#94a3b8" />
            </marker>
          </defs>
          {UBD_EDGES.map((edge, i) => {
            const a = nodeMap[edge.from]
            const b = nodeMap[edge.to]
            if (!a || !b) return null
            const x1 = a.x + 200
            const y1 = a.y + 28
            const x2 = b.x
            const y2 = b.y + 28
            const mx = (x1 + x2) / 2
            return (
              <g key={i}>
                <path
                  d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  markerEnd="url(#n8n-arrow)"
                  className="n8n-edge-path"
                />
              </g>
            )
          })}
        </svg>
        {UBD_NODES.map((node) => (
          <div
            key={node.id}
            className={`n8n-node n8n-node-${node.type}`}
            style={{ left: node.x, top: node.y }}
            draggable={false}
          >
            <div className="n8n-node-bar" />
            <div className="n8n-node-body">
              <span className="n8n-node-handle n8n-node-handle-in" />
              <span className="n8n-node-label">{node.label}</span>
              {node.type === 'trigger' && (
                <span className="n8n-node-trigger-spinner" aria-hidden title="Триггер">
                  <span className="n8n-trigger-dot" />
                </span>
              )}
              <span className="n8n-node-handle n8n-node-handle-out" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default N8nStyleCanvas
