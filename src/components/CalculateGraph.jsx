import React, { useState, useCallback, useMemo, useEffect } from 'react'

/** Генерирует HTML для графа в стиле function_graph.html: маленькие круги, подсказки при наведении, плавная физика */
function generateVisNetworkHtml(stages, tasks) {
  const nodes = []
  const edges = []
  let id = 0
  const stageIds = {}
  const firstTaskId = {}
  stages.forEach((stageName) => {
    const sid = id++
    stageIds[stageName] = sid
    const stageLabel = stageName.length > 16 ? stageName.slice(0, 13) + '…' : stageName
    nodes.push({
      id: sid,
      label: stageLabel,
      title: `Этап: ${stageName}`,
      shape: 'dot',
      size: 22,
      color: { background: '#E8EEF2', border: '#94a3b8' },
      font: { color: '#1f2937', size: 11, face: 'sans-serif' },
    })
    const list = tasks[stageName] || []
    firstTaskId[stageName] = id
    list.forEach((task) => {
      const tid = id++
      const name = task.name || task.id || ''
      const shortLabel = name.length > 14 ? name.slice(0, 11) + '…' : name
      nodes.push({
        id: tid,
        label: shortLabel,
        title: `Карточка: ${name}\nЭтап: ${stageName}`,
        shape: 'dot',
        size: 18,
        color: { background: '#0078D2', border: '#005a9e' },
        font: { color: '#fff', size: 10, face: 'sans-serif' },
      })
      edges.push({ from: sid, to: tid, arrows: 'to', color: { color: 'rgba(0,65,102,0.35)' } })
    })
  })
  stages.forEach((stageName, si) => {
    const list = tasks[stageName] || []
    list.forEach((task, ti) => {
      if (ti < list.length - 1) {
        const fromId = firstTaskId[stageName] + ti
        const toId = firstTaskId[stageName] + ti + 1
        edges.push({ from: fromId, to: toId, arrows: 'to', color: { color: 'rgba(0,65,102,0.25)' } })
      }
    })
    if (si < stages.length - 1) {
      edges.push({ from: stageIds[stageName], to: stageIds[stages[si + 1]], arrows: 'to', color: { color: 'rgba(0,65,102,0.3)' } })
    }
  })
  const options = {
    nodes: { font: { strokeWidth: 0 } },
    edges: { smooth: { type: 'cubicBezier', roundness: 0.5 } },
    physics: {
      enabled: true,
      solver: 'forceAtlas2Based',
      forceAtlas2Based: {
        gravitationalConstant: -12,
        centralGravity: 0.003,
        springLength: 120,
        springConstant: 0.04,
        damping: 0.65,
        avoidOverlap: 0.15,
      },
      stabilization: { iterations: 300, updateInterval: 50 },
    },
    interaction: { dragNodes: true, dragView: true, zoomView: true, hover: true, tooltipDelay: 100 },
  }
  const nodesJson = JSON.stringify(nodes)
  const edgesJson = JSON.stringify(edges)
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><script src="https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js"><\/script><style>body{margin:0;background:#f8fafc;}#mynetwork{width:100%;height:100vh;}.vis-tooltip{font-size:11px;padding:6px 10px;max-width:220px;word-wrap:break-word;white-space:normal;overflow-wrap:break-word;}<\/style></head><body><div id="mynetwork"></div><script>
var n=new vis.DataSet(${nodesJson});var e=new vis.DataSet(${edgesJson});
var d={nodes:n,edges:e};var o=${JSON.stringify(options)};
var c=document.getElementById("mynetwork");var net=new vis.Network(c,d,o);
net.on("stabilizationProgress", function(params){if(params.iterations===params.total){net.setOptions({physics:false});}});
<\/script></body></html>`
}

/**
 * Граф сценария и инфографика: граф в стиле function_graph.html (vis-network) + панель из graf_and_statistics.py
 */
function CalculateGraph({ stages, tasks, analytics, onBack }) {
  const [positions, setPositions] = useState(() => {
    const pos = {}
    let nodeId = 0
    stages.forEach((stageName, si) => {
      pos[`stage-${si}`] = { x: 80 + si * 180, y: 60 }
      nodeId++
      ;(tasks[stageName] || []).forEach((task, ti) => {
        pos[`task-${stageName}-${task.id}`] = { x: 100 + si * 180, y: 140 + ti * 52 }
      })
    })
    return pos
  })
  const [dragging, setDragging] = useState(null)

  const nodeIds = useMemo(() => {
    const ids = []
    stages.forEach((stageName, si) => {
      ids.push({ key: `stage-${si}`, type: 'stage', stageName, stageIdx: si })
      ;(tasks[stageName] || []).forEach((task) => {
        ids.push({ key: `task-${stageName}-${task.id}`, type: 'task', stageName, task })
      })
    })
    return ids
  }, [stages, tasks])

  useEffect(() => {
    setPositions((prev) => {
      const next = { ...prev }
      let hasNew = false
      nodeIds.forEach(({ key }) => {
        if (!(key in next)) {
          hasNew = true
          const [, type, stageOrIdx, rest] = key.split('-')
          const si = parseInt(stageOrIdx, 10)
          if (type === 'stage' && !Number.isNaN(si)) {
            next[key] = { x: 80 + si * 180, y: 60 }
          } else {
            next[key] = { x: 200, y: 200 }
          }
        }
      })
      return hasNew ? next : prev
    })
  }, [nodeIds.length])

  const handlePointerDown = useCallback((e, key) => {
    e.preventDefault()
    if (!positions[key]) return
    setDragging(key)
  }, [positions])

  const handlePointerMove = useCallback((e) => {
    if (!dragging) return
    setPositions((prev) => ({
      ...prev,
      [dragging]: {
        x: (prev[dragging]?.x ?? 0) + e.movementX,
        y: (prev[dragging]?.y ?? 0) + e.movementY,
      },
    }))
  }, [dragging])

  const handlePointerUp = useCallback(() => {
    setDragging(null)
  }, [])

  useEffect(() => {
    if (!dragging) return
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragging, handlePointerMove, handlePointerUp])

  const stagePositions = useMemo(() => {
    const map = {}
    stages.forEach((stageName, si) => {
      const key = `stage-${si}`
      map[stageName] = positions[key] || { x: 80 + si * 180, y: 60 }
    })
    return map
  }, [stages, positions])

  const edges = useMemo(() => {
    const list = []
    stages.forEach((stageName, si) => {
      const listTask = tasks[stageName] || []
      listTask.forEach((task, ti) => {
        const fromPos = si === 0 && ti === 0 ? stagePositions[stageName] : (stagePositions[stageName] || positions[`task-${stageName}-${listTask[ti - 1]?.id}`])
        const toKey = `task-${stageName}-${task.id}`
        const toPos = positions[toKey]
        if (toPos) {
          const fromP = stagePositions[stageName] || toPos
          list.push({ from: fromP, to: toPos })
        }
        if (ti < listTask.length - 1) {
          const fromKey = `task-${stageName}-${task.id}`
          const toKey2 = `task-${stageName}-${listTask[ti + 1].id}`
          const fromP = positions[fromKey]
          const toP = positions[toKey2]
          if (fromP && toP) list.push({ from: fromP, to: toP })
        }
      })
      if (si < stages.length - 1) {
        const fromP = stagePositions[stageName]
        const nextStage = stages[si + 1]
        const toP = stagePositions[nextStage]
        if (fromP && toP) list.push({ from: fromP, to: toP })
      }
    })
    return list
  }, [stages, tasks, positions, stagePositions])

  const maxCount = Math.max(...(analytics.degreeBuckets || []).map((b) => b.count), 1)
  const maxAvg = Math.max(Number(analytics.avgByType?.Этап) || 0, Number(analytics.avgByType?.Карточка) || 0, Number(analytics.avgByType?.Система) || 0, 1)
  const maxTop = Math.max(...(analytics.topNodes || []).map((n) => n.degree), 1)

  const visGraphHtml = useMemo(() => generateVisNetworkHtml(stages, tasks), [stages, tasks])

  return (
    <div className="bpm-calculate-wrap">
      <div className="bpm-board-header">
        <h2>Граф сценария и статистика</h2>
        <button type="button" className="bpm-btn bpm-btn-primary" onClick={onBack}>Назад к доске</button>
      </div>
      <div className="bpm-calculate-layout">
        <div className="bpm-calculate-graph-inline">
          <iframe
            title="Граф сценария (vis-network)"
            srcDoc={visGraphHtml}
            className="bpm-graph-iframe"
            sandbox="allow-scripts"
          />
        </div>
        <div className="bpm-calculate-right">
          <div className="bpm-calculate-analytics">
            <h3>Основная статистика</h3>
            <div className="bpm-analytics-row"><span>Узлов всего:</span> <strong>{analytics.nodeCount}</strong></div>
            <div className="bpm-analytics-row"><span>Связей всего:</span> <strong>{analytics.edgeCount}</strong></div>
            {analytics.density != null && <div className="bpm-analytics-row"><span>Плотность графа:</span> <strong>{analytics.density}</strong></div>}
            {analytics.nodeCount > 0 && (
              <div className="bpm-analytics-row">
                <span>Средняя степень узла:</span>{' '}
                <strong>{(analytics.edgeCount * 2 / analytics.nodeCount).toFixed(2)}</strong>
              </div>
            )}
          </div>
          <div className="bpm-infographics-grid">
            <div className="bpm-infographic-card">
              <h4 className="bpm-infographic-card-title-main">НАИБОЛЕЕ СВЯЗАННЫЕ УЗЛЫ</h4>
              <p className="bpm-infographic-subtitle">(по количеству связей)</p>
              <div className="bpm-infographic-top-nodes">
                {(analytics.topNodes || []).slice(0, 8).map(({ label, degree }, i) => {
                  const displayLabel = label.includes(': ') ? label.split(': ').slice(1).join(': ') : label
                  return (
                    <div key={i} className="bpm-top-node-row">
                      <span className="bpm-top-node-label" title={label}>{displayLabel.length > 28 ? displayLabel.slice(0, 25) + '…' : displayLabel}</span>
                      <div className="bpm-top-node-track">
                        <div className="bpm-top-node-bar" style={{ width: `${(degree / maxTop) * 100}%` }} />
                      </div>
                      <span className="bpm-top-node-degree">{degree}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="bpm-infographic-card bpm-infographic-card-compact">
              <h4>Количество узлов по типам</h4>
              <div className="bpm-infographic-bars">
                {['Этап', 'Карточка', 'Система'].map((t, i) => (
                  <div key={t} className="bpm-infographic-bar-row">
                    <span className="bpm-infographic-bar-label">{t}</span>
                    <div className="bpm-infographic-bar-track">
                      <div className={`bpm-infographic-bar bpm-infographic-bar-${i + 1}`} style={{ width: `${(analytics.byType[t] / Math.max(1, analytics.nodeCount)) * 100}%` }} />
                    </div>
                    <span className="bpm-infographic-bar-value">{analytics.byType[t]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bpm-infographic-card bpm-infographic-card-compact">
              <h4>Среднее количество связей по типам узлов</h4>
              <div className="bpm-infographic-bars">
                {['Этап', 'Карточка', 'Система'].map((t, i) => (
                  <div key={t} className="bpm-infographic-bar-row">
                    <span className="bpm-infographic-bar-label">{t}</span>
                    <div className="bpm-infographic-bar-track">
                      <div className={`bpm-infographic-bar bpm-infographic-bar-${i + 1}`} style={{ width: `${((Number(analytics.avgByType[t]) || 0) / maxAvg) * 100}%` }} />
                    </div>
                    <span className="bpm-infographic-bar-value">{analytics.avgByType[t]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CalculateGraph
