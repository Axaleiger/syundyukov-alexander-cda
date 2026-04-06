import React, { useState, useRef, useCallback, useEffect } from 'react'
import './N8nStyleCanvas.css'
import './ConfiguratorCanvas.css'

const NODE_WIDTH = 200
const NODE_HEIGHT = 56
const HANDLE_OFFSET = 28
const FALLBACK_VIEWPORT_WIDTH = 800
const FALLBACK_VIEWPORT_HEIGHT = 600

const NODE_TYPES = [
  { id: 'trigger', label: 'Триггер', barColor: '#22c55e' },
  { id: 'process', label: 'Обработка', barColor: '#3b82f6' },
  { id: 'output', label: 'Выход', barColor: '#8b5cf6' },
]

function ConfiguratorCanvas({
  nodes: controlledNodes,
  edges: controlledEdges,
  onNodesChange,
  onEdgesChange,
  className = '',
  containerRef,
  onMounted,
  animateFromNodes,
}) {
  const [isPanning, setIsPanning] = useState(false)
  const [startPan, setStartPan] = useState({ x: 0, y: 0 })
  const [draggingNodeId, setDraggingNodeId] = useState(null)
  const [dragOffset, setDragOffset] = useState({ dx: 0, dy: 0 })
  const [selectedEdgeId, setSelectedEdgeId] = useState(null)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [pendingFromId, setPendingFromId] = useState(null)
  const [pendingDrag, setPendingDrag] = useState(null)
  const [rightPanel, setRightPanel] = useState(null)
  const [edgeSettings, setEdgeSettings] = useState({})
  const [newNodeForm, setNewNodeForm] = useState({ type: 'process', label: 'Новый узел' })
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const didFitViewRef = useRef(false)
  const selectedEdgeIdRef = useRef(null)
  const pendingSelectNodeRef = useRef(null)

  const nodes = controlledNodes || []
  const edges = controlledEdges || []
  const setNodes = onNodesChange || (() => {})
  const setEdges = onEdgesChange || (() => {})

  const getInitialTransform = (nodeList, viewportWidth, viewportHeight) => {
    if (!nodeList || !nodeList.length) {
      return { x: 0, y: 0, scale: 1 }
    }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    nodeList.forEach((n) => {
      minX = Math.min(minX, n.x)
      minY = Math.min(minY, n.y)
      maxX = Math.max(maxX, n.x + NODE_WIDTH)
      maxY = Math.max(maxY, n.y + NODE_HEIGHT)
    })
    const padding = 80
    const contentW = maxX - minX + padding * 2
    const contentH = maxY - minY + padding * 2
    const vw = viewportWidth || FALLBACK_VIEWPORT_WIDTH
    const vh = viewportHeight || FALLBACK_VIEWPORT_HEIGHT
    const scale = Math.max(0.45, Math.min(vw / contentW, vh / contentH, 1.2))
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const offsetX = vw / 2 - cx * scale
    const offsetY = vh / 2 - cy * scale
    return { x: offsetX, y: offsetY, scale }
  }

  const [transform, setTransform] = useState(() =>
    getInitialTransform(nodes, FALLBACK_VIEWPORT_WIDTH, FALLBACK_VIEWPORT_HEIGHT),
  )

  const nodeMap = useCallback(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes])

  const getNodeCenter = useCallback((node) => ({
    x: node.x + NODE_WIDTH / 2,
    y: node.y + NODE_HEIGHT / 2,
  }), [])

  const getOutHandle = useCallback((node) => ({
    x: node.x + NODE_WIDTH,
    y: node.y + HANDLE_OFFSET,
  }), [])

  const getInHandle = useCallback((node) => ({
    x: node.x,
    y: node.y + HANDLE_OFFSET,
  }), [])

  const fitView = useCallback(() => {
    if (!wrapRef.current || !nodes.length) return
    const rect = wrapRef.current.getBoundingClientRect()
    if (rect.width < 50 || rect.height < 50) return
    const next = getInitialTransform(nodes, rect.width, rect.height)
    setTransform(next)
  }, [nodes.length])

  useEffect(() => {
    onMounted?.(fitView)
    const runFit = () => {
      if (wrapRef.current && nodes.length) {
        fitView()
        didFitViewRef.current = true
      }
    }
    const t1 = setTimeout(runFit, 50)
    const t2 = setTimeout(runFit, 250)
    const t3 = setTimeout(runFit, 600)
    const ro = wrapRef.current && new ResizeObserver(runFit)
    if (ro && wrapRef.current) ro.observe(wrapRef.current)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      ro?.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!wrapRef.current || !nodes.length || didFitViewRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    if (rect.width < 50 || rect.height < 50) return
    fitView()
    didFitViewRef.current = true
  }, [nodes.length, fitView])

  // При добавлении нод центрируем схему с небольшой задержкой
  useEffect(() => {
    if (!nodes.length) return
    const id = setTimeout(() => { if (wrapRef.current) fitView() }, 100)
    return () => clearTimeout(id)
  }, [nodes.length, fitView])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    const delta = e.deltaY > 0 ? -0.05 : 0.05
    setTransform((t) => ({ ...t, scale: Math.min(2, Math.max(0.45, t.scale + delta)) }))
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      e.stopPropagation()
      const delta = e.deltaY > 0 ? -0.05 : 0.05
      setTransform((t) => ({ ...t, scale: Math.min(2, Math.max(0.45, t.scale + delta)) }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const handleCanvasMouseDown = useCallback((e) => {
    if (e.target.closest('.configurator-node') || e.target.closest('.configurator-edge-hit') || e.target.closest('.configurator-right-panel')) return
    setSelectedEdgeId(null)
    setSelectedNodeId(null)
    setPendingFromId(null)
    setPendingDrag(null)
    setIsPanning(true)
    setStartPan({ x: e.clientX - transform.x, y: e.clientY - transform.y })
  }, [transform.x, transform.y])

  const handleMouseMove = useCallback((e) => {
    if (draggingNodeId) {
      const rect = wrapRef.current?.getBoundingClientRect()
      if (!rect) return
      const scale = transform.scale
      const x = (e.clientX - rect.left - transform.x) / scale - dragOffset.dx
      const y = (e.clientY - rect.top - transform.y) / scale - dragOffset.dy
      setNodes((prev) => prev.map((n) => n.id === draggingNodeId ? { ...n, x: Math.round(x), y: Math.round(y) } : n))
      return
    }
    if (pendingDrag) {
      const dx = e.clientX - pendingDrag.clientX
      const dy = e.clientY - pendingDrag.clientY
      if (dx * dx + dy * dy > 25) {
        const node = nodes.find((n) => n.id === pendingDrag.nodeId)
        if (node) {
          const rect = wrapRef.current?.getBoundingClientRect()
          if (rect) {
            const scale = transform.scale
            const clickCanvasX = (pendingDrag.clientX - rect.left - transform.x) / scale
            const clickCanvasY = (pendingDrag.clientY - rect.top - transform.y) / scale
            setDragOffset({ dx: clickCanvasX - node.x, dy: clickCanvasY - node.y })
          }
          setDraggingNodeId(pendingDrag.nodeId)
          pendingSelectNodeRef.current = null
        }
        setPendingDrag(null)
        setPendingFromId(null)
      }
      return
    }
    if (isPanning) {
      setTransform((t) => ({ ...t, x: e.clientX - startPan.x, y: e.clientY - startPan.y }))
    }
  }, [draggingNodeId, dragOffset, isPanning, startPan, transform, nodes, setNodes, pendingDrag])

  const handleMouseUp = useCallback(() => {
    pendingSelectNodeRef.current = null
    setIsPanning(false)
    setDraggingNodeId(null)
    setPendingDrag(null)
  }, [])

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [handleMouseUp])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedNodeId) {
        setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId))
        setEdges((prev) => prev.filter((ed) => ed.from !== selectedNodeId && ed.to !== selectedNodeId))
        setSelectedNodeId(null)
        setRightPanel(null)
        return
      }
      const id = selectedEdgeIdRef.current || selectedEdgeId
      if (id) {
        setEdges((prev) => prev.filter((ed) => ed.id !== id))
        setSelectedEdgeId(null)
        setRightPanel(null)
        selectedEdgeIdRef.current = null
      }
    }
    if (e.key === ' ' && !e.target.closest('textarea') && !e.target.closest('input')) {
      e.preventDefault()
      setRightPanel('newNode')
    }
  }, [selectedEdgeId, selectedNodeId, setEdges, setNodes])

  useEffect(() => {
    wrapRef.current?.focus()
  }, [])
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleNodeMouseDown = useCallback((e, nodeId) => {
    e.stopPropagation()
    // повторный клик по той же ноде отменяет режим связывания и подсветку
    if (pendingFromId && pendingFromId === nodeId) {
      setPendingFromId(null)
      setSelectedNodeId(null)
      setPendingDrag(null)
      pendingSelectNodeRef.current = null
      return
    }
    if (pendingFromId && pendingFromId !== nodeId) {
      const exists = edges.some((ed) => ed.from === pendingFromId && ed.to === nodeId)
      if (!exists) {
        setEdges((prev) => [...prev, { id: `e-${pendingFromId}-${nodeId}`, from: pendingFromId, to: nodeId }])
      }
      setPendingFromId(null)
      setPendingDrag(null)
      setSelectedNodeId(null)
      pendingSelectNodeRef.current = null
      return
    }
    setSelectedEdgeId(null)
    setSelectedNodeId(nodeId)
    setPendingFromId(nodeId)
    pendingSelectNodeRef.current = null
    setPendingDrag({ nodeId, clientX: e.clientX, clientY: e.clientY })
  }, [pendingFromId, edges, setEdges])

  const handleNodeContextMenu = useCallback((e, nodeId) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedNodeId(nodeId)
    setSelectedEdgeId(null)
    setRightPanel('nodeEdit')
  }, [])

  const handleEdgeClick = useCallback((e, edgeId) => {
    e.stopPropagation()
    selectedEdgeIdRef.current = edgeId
    setSelectedEdgeId(edgeId)
    setRightPanel('edgeSettings')
    setEdgeSettings((prev) => ({ ...prev, [edgeId]: { dashed: (edges.find((x) => x.id === edgeId) || {}).dashed } }))
  }, [edges])

  const addNode = useCallback((type, label, atPosition) => {
    const id = `node-${Date.now()}`
    let x, y
    if (atPosition && typeof atPosition.x === 'number' && typeof atPosition.y === 'number') {
      x = atPosition.x
      y = atPosition.y
    } else if (nodes.length > 0) {
      let maxX = -Infinity
      let refY = 0
      nodes.forEach((n) => {
        if (n.x + NODE_WIDTH > maxX) {
          maxX = n.x + NODE_WIDTH
          refY = n.y
        }
      })
      x = maxX + 50
      y = refY
    } else {
      const rect = wrapRef.current?.getBoundingClientRect()
      const cx = rect ? rect.width / 2 : 400
      const cy = rect ? rect.height / 2 : 300
      const scale = transform.scale
      x = Math.round((cx - transform.x) / scale - NODE_WIDTH / 2)
      y = Math.round((cy - transform.y) / scale - NODE_HEIGHT / 2)
    }
    setNodes((prev) => [...prev, { id, label: label || 'Новый узел', type: type || 'process', x, y }])
    setRightPanel(null)
    setNewNodeForm({ type: 'process', label: 'Новый узел' })
  }, [setNodes, transform, nodes.length])

  const updateEdgeOption = useCallback((edgeId, key, value) => {
    setEdges((prev) => prev.map((e) => e.id === edgeId ? { ...e, [key]: value } : e))
    setEdgeSettings((prev) => ({ ...prev, [edgeId]: { ...(prev[edgeId] || {}), [key]: value } }))
  }, [setEdges])

  const updateNodeOption = useCallback((nodeId, key, value) => {
    setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, [key]: value } : n))
  }, [setNodes])

  const nm = nodeMap()
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId)
  const selectedNode = nodes.find((n) => n.id === selectedNodeId)

  return (
    <div
      ref={(r) => { wrapRef.current = r; if (containerRef) containerRef.current = r }}
      className={`n8n-canvas-wrap configurator-canvas-wrap ${className}`.trim()}
      tabIndex={0}
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{ outline: 'none' }}
    >
      <div
        ref={canvasRef}
        className="n8n-canvas configurator-canvas"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          cursor: draggingNodeId ? 'grabbing' : isPanning ? 'grabbing' : 'grab',
        }}
      >
        <div className="n8n-canvas-dots" aria-hidden />
        <svg className="n8n-edges configurator-edges" width="32768" height="32768" style={{ left: 0, top: 0, pointerEvents: 'auto' }}>
          <defs>
            <marker id="config-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0 0 L6 3 L0 6 z" fill="#94a3b8" />
            </marker>
          </defs>
          {edges.map((edge) => {
            const a = nm[edge.from]
            const b = nm[edge.to]
            if (!a || !b) return null
            const x1 = a.x + NODE_WIDTH
            const y1 = a.y + HANDLE_OFFSET
            const x2 = b.x
            const y2 = b.y + HANDLE_OFFSET
            const mx = (x1 + x2) / 2
            const pathD = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
            const isSelected = edge.id === selectedEdgeId
            return (
              <g key={edge.id}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={edge.dashed ? '#64748b' : '#94a3b8'}
                  strokeWidth={isSelected ? 3 : 2}
                  strokeDasharray={edge.dashed ? '8 4' : 'none'}
                  markerEnd="url(#config-arrow)"
                  className="configurator-edge-path"
                />
                <path
                  d={pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="20"
                  className="configurator-edge-hit"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => handleEdgeClick(e, edge.id)}
                />
                {isSelected && (
                  <g transform={`translate(${mx}, ${(y1 + y2) / 2})`}>
                    <circle r="10" fill="#334155" stroke="#64748b" />
                    <text x="0" y="4" textAnchor="middle" fill="#94a3b8" fontSize="12">⚙</text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
        {nodes.map((node) => (
          <div
            key={node.id}
            className={`n8n-node configurator-node n8n-node-${node.type} ${pendingFromId === node.id ? 'configurator-pending' : ''} ${selectedNodeId === node.id ? 'configurator-node-selected' : ''}`}
            style={{ left: node.x, top: node.y }}
            onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
            onContextMenu={(e) => handleNodeContextMenu(e, node.id)}
          >
            <div className="n8n-node-bar" />
            <div className="n8n-node-body">
              <span className="n8n-node-handle n8n-node-handle-in" />
              <span className="n8n-node-label">{node.label}</span>
              {node.type === 'trigger' && (
                <span className="n8n-node-trigger-spinner" aria-hidden>
                  <span className="n8n-trigger-dot" />
                </span>
              )}
              <span className="n8n-node-handle n8n-node-handle-out configurator-handle-out" />
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="configurator-fit-btn" onClick={() => fitView()} title="Вернуть вид по центру схемы" aria-label="Центрировать схему">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
      </button>
      <div className="configurator-hotkeys-hint" aria-hidden>
        <span>Del — удалить связь/ноду</span>
        <span>Пробел — новая карточка</span>
      </div>

      {rightPanel === 'newNode' && (
        <div className="configurator-right-panel">
          <div className="configurator-panel-head">
            <h3>Новая карточка</h3>
            <button type="button" className="configurator-panel-close" onClick={() => setRightPanel(null)}>×</button>
          </div>
          <div className="configurator-panel-body" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            <label>
              Тип
              <select value={newNodeForm.type} onChange={(e) => setNewNodeForm((f) => ({ ...f, type: e.target.value }))}>
                {NODE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <label>
              Название
              <input type="text" value={newNodeForm.label} onChange={(e) => setNewNodeForm((f) => ({ ...f, label: e.target.value }))} />
            </label>
            <button type="button" className="configurator-btn-primary" onClick={() => addNode(newNodeForm.type, newNodeForm.label)}>Добавить</button>
          </div>
        </div>
      )}

      {rightPanel === 'edgeSettings' && selectedEdge && (
        <div className="configurator-right-panel">
          <div className="configurator-panel-head">
            <h3>Настройка связи</h3>
            <button type="button" className="configurator-panel-close" onClick={() => { setRightPanel(null); setSelectedEdgeId(null); selectedEdgeIdRef.current = null; }}>×</button>
          </div>
          <div className="configurator-panel-body" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            <label>
              Тип связи
              <select
                value={selectedEdge.dashed ? 'secondary' : 'primary'}
                onChange={(e) => updateEdgeOption(selectedEdge.id, 'dashed', e.target.value === 'secondary')}
              >
                <option value="primary">Основная (сплошная)</option>
                <option value="secondary">Второстепенная (пунктир)</option>
              </select>
            </label>
            <button type="button" className="configurator-btn-danger" onClick={(e) => { e.stopPropagation(); const id = selectedEdgeIdRef.current || selectedEdgeId; if (id) { setEdges((prev) => prev.filter((ed) => ed.id !== id)); setRightPanel(null); setSelectedEdgeId(null); selectedEdgeIdRef.current = null; } }}>Удалить связь</button>
          </div>
        </div>
      )}

      {rightPanel === 'nodeEdit' && selectedNode && (
        <div className="configurator-right-panel">
          <div className="configurator-panel-head">
            <h3>Редактирование ноды</h3>
            <button type="button" className="configurator-panel-close" onClick={() => { setRightPanel(null); setSelectedNodeId(null); }}>×</button>
          </div>
          <div className="configurator-panel-body" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            <label>
              Название
              <input
                type="text"
                value={selectedNode.label}
                onChange={(e) => updateNodeOption(selectedNode.id, 'label', e.target.value)}
              />
            </label>
            <label>
              Тип
              <select
                value={selectedNode.type}
                onChange={(e) => updateNodeOption(selectedNode.id, 'type', e.target.value)}
              >
                {NODE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <button type="button" className="configurator-btn-danger" onClick={() => { setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId)); setEdges((prev) => prev.filter((ed) => ed.from !== selectedNodeId && ed.to !== selectedNodeId)); setRightPanel(null); setSelectedNodeId(null); }}>Удалить ноду</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConfiguratorCanvas
export { NODE_WIDTH, NODE_HEIGHT }
