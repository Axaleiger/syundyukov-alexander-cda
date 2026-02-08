import React, { useState, useCallback, useRef } from 'react'
import './OntologyTab.css'

const INITIAL_NODES = [
  { id: 'n1', type: 'trigger', label: 'Триггер', x: 80, y: 120 },
  { id: 'n2', type: 'process', label: 'Обработка данных', x: 280, y: 100 },
  { id: 'n3', type: 'process', label: 'Валидация', x: 480, y: 120 },
  { id: 'n4', type: 'output', label: 'Результат', x: 680, y: 120 },
]

const INITIAL_EDGES = [
  { id: 'e1', from: 'n1', to: 'n2' },
  { id: 'e2', from: 'n2', to: 'n3' },
  { id: 'e3', from: 'n3', to: 'n4' },
]

function OntologyTab() {
  const [nodes, setNodes] = useState(INITIAL_NODES)
  const [edges, setEdges] = useState(INITIAL_EDGES)
  const [dragId, setDragId] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const canvasRef = useRef(null)
  const panStartRef = useRef(null)

  const getNode = (id) => nodes.find((n) => n.id === id)

  const handleNodeMouseDown = useCallback((e, id) => {
    e.stopPropagation()
    const node = getNode(id)
    if (!node) return
    setDragId(id)
    setDragOffset({ x: e.clientX - node.x, y: e.clientY - node.y })
  }, [nodes])

  const handleMouseMove = useCallback((e) => {
    if (dragId) {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === dragId ? { ...n, x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y } : n
        )
      )
    }
  }, [dragId, dragOffset])

  const handleMouseUp = useCallback(() => setDragId(null), [])

  const handleCanvasMouseDown = (e) => {
    if (e.target === canvasRef.current) panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }
  const handleCanvasMouseMove = (e) => {
    if (panStartRef.current) {
      setPan({ x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y })
    }
  }
  const handleCanvasMouseUp = () => { panStartRef.current = null }

  const addNode = () => {
    const id = `n${Date.now()}`
    setNodes((prev) => [...prev, { id, type: 'process', label: 'Новый узел', x: 300, y: 300 }])
  }

  return (
    <div className="ontology-tab">
      <div className="ontology-toolbar">
        <h2 className="ontology-title">Онтология</h2>
        <button type="button" className="ontology-add-node" onClick={addNode}>
          + Добавить узел
        </button>
        <div className="ontology-zoom">
          <button type="button" onClick={() => setScale((s) => Math.min(2, s + 0.2))}>+</button>
          <span>{Math.round(scale * 100)}%</span>
          <button type="button" onClick={() => setScale((s) => Math.max(0.3, s - 0.2))}>−</button>
        </div>
      </div>
      <div
        className="ontology-canvas-wrap"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          ref={canvasRef}
          className="ontology-canvas"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            backgroundSize: `${20 * scale}px ${20 * scale}px`,
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
        >
          <svg className="ontology-edges" width="2000" height="2000">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
              </marker>
            </defs>
            {edges.map((edge) => {
              const from = getNode(edge.from)
              const to = getNode(edge.to)
              if (!from || !to) return null
              const x1 = from.x + 100
              const y1 = from.y + 24
              const x2 = to.x
              const y2 = to.y + 24
              const mx = (x1 + x2) / 2
              const path = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
              return (
                <path
                  key={edge.id}
                  d={path}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  markerEnd="url(#arrowhead)"
                />
              )
            })}
          </svg>
          {nodes.map((node) => (
            <div
              key={node.id}
              className={`ontology-node ontology-node-${node.type}`}
              style={{ left: node.x, top: node.y }}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
            >
              <div className="ontology-node-handle ontology-node-handle-in" />
              <span className="ontology-node-label">{node.label}</span>
              <div className="ontology-node-handle ontology-node-handle-out" />
            </div>
          ))}
        </div>
      </div>
      <p className="ontology-hint">Перетаскивайте узлы. Панорама: перетаскивание по пустому месту. Стиль n8n: кубики и связи.</p>
    </div>
  )
}

export default OntologyTab
