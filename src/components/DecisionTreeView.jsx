import React, { useState, useMemo } from 'react'
import './DecisionTreeView.css'

const WIDTH = 640
const HEIGHT = 320
const ROOT_X = 30
const ROOT_Y = HEIGHT / 2

/**
 * Строим разветвлённое дерево слева направо.
 * Каждая ветка — отдельный путь решения с собственной конечной точкой.
 */
function buildTreeData() {
  const positions = {
    root: { x: ROOT_X, y: ROOT_Y },
  }

  const pathIds = ['path1', 'path2', 'path3', 'path4', 'path5', 'path6', 'path7', 'path8']
  const paths = {}
  const leaves = []

  const colX = [ROOT_X + 60, ROOT_X + 150, ROOT_X + 260, ROOT_X + 380]
  const rowY = [40, 85, 130, 175, 220, 265]

  pathIds.forEach((pid, index) => {
    const midRow = rowY[(index * 2) % rowY.length]
    const endRow = rowY[(index * 3 + 1) % rowY.length]
    const n1 = `${pid}-n1`
    const n2 = `${pid}-n2`
    const leaf = `${pid}-leaf`

    positions[n1] = { x: colX[0], y: midRow }
    positions[n2] = { x: colX[1], y: (midRow + endRow) / 2 }
    positions[leaf] = { x: colX[3], y: endRow }

    const nodes = ['root', n1, n2, leaf]
    const edges = [
      ['root', n1],
      [n1, n2],
      [n2, leaf],
    ]

    const denseNodes = []
    const denseEdges = []
    const addDenseSegment = (fromId, toId, segments) => {
      const fromPos = positions[fromId]
      const toPos = positions[toId]
      let prevId = fromId
      for (let i = 1; i <= segments; i += 1) {
        const t = i / (segments + 1)
        const id = `${pid}-d-${fromId}-${i}`
        const x = fromPos.x + (toPos.x - fromPos.x) * t + (Math.random() - 0.5) * 3
        const y = fromPos.y + (toPos.y - fromPos.y) * t + (Math.random() - 0.5) * 8
        positions[id] = { x, y }
        denseNodes.push(id)
        denseEdges.push([prevId, id])
        prevId = id
      }
      denseEdges.push([prevId, toId])
    }

    const segmentsPerEdge = 60
    addDenseSegment('root', n1, segmentsPerEdge)
    addDenseSegment(n1, n2, segmentsPerEdge)
    addDenseSegment(n2, leaf, segmentsPerEdge)

    paths[pid] = { nodes: ['root', ...denseNodes, leaf], edges: [...edges, ...denseEdges], leafId: leaf }
    leaves.push({ pathId: pid, nodeId: leaf })
  })

  return { paths, positions, pathIds, leaves }
}

const TREE_DATA = buildTreeData()

/**
 * Для каждой ветки задаём вероятность и цвет финишной точки.
 * Минимум 3 зелёных (лучшие варианты), остальные — оранжевые или красные.
 */
function buildLeafMeta(pathIds) {
  const raw = pathIds.map((pid) => {
    const base = 60 + Math.random() * 40 // 60–100
    return { pathId: pid, prob: base }
  })
  const sorted = [...raw].sort((a, b) => b.prob - a.prob)
  const best = sorted.slice(0, 3)
  const bestIds = new Set(best.map((i) => i.pathId))

  const meta = {}
  sorted.forEach(({ pathId, prob }) => {
    let color = 'red'
    if (bestIds.has(pathId)) {
      color = 'green'
    } else if (prob >= 70) {
      color = 'orange'
    }
    meta[pathId] = {
      color,
      prob: prob.toFixed(1),
    }
  })
  return meta
}

const LEAF_META = buildLeafMeta(TREE_DATA.pathIds)

function DecisionTreeView({ selectedPathId, onSelect, growthProgress = 0 }) {
  const [hoverPathId, setHoverPathId] = useState(null)
  const { paths, positions, pathIds, leaves } = TREE_DATA

  const totalNodes = Object.keys(positions).length
  const visibleLimit = Math.max(1, Math.round(totalNodes * Math.min(1, growthProgress || 0)))

  const getPathIdForNode = (nodeId) => {
    for (const pid of pathIds) {
      if (paths[pid].nodes.includes(nodeId)) return pid
    }
    return null
  }

  const activePathId = selectedPathId || hoverPathId

  const isActive = (pathOrNodeOrEdge) => {
    if (!activePathId) return true
    return pathOrNodeOrEdge === activePathId
  }

  const edges = useMemo(() => {
    const list = []
    pathIds.forEach((pid) => {
      paths[pid].edges.forEach(([from, to]) => list.push({ from, to, pathId: pid }))
    })
    return list
  }, [])

  return (
    <div className="decision-tree-view">
      <h4 className="decision-tree-title">Дерево вычисления решений</h4>
      <div className="decision-tree-graph-wrap">
        <svg className="decision-tree-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <marker id="dt-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0 0 L6 3 L0 6 z" fill="currentColor" />
            </marker>
          </defs>
          {/* Рёбра */}
          {edges.map(({ from, to, pathId }) => {
            const fromPos = positions[from]
            const toPos = positions[to]
            if (!fromPos || !toPos) return null
            const active = isActive(pathId)
            const isOptimal = paths[pathId]?.isOptimal
            return (
              <line
                key={`${from}-${to}`}
                x1={fromPos.x}
                y1={fromPos.y}
                x2={toPos.x}
                y2={toPos.y}
                className={`decision-tree-edge ${active ? 'decision-tree-edge-active' : 'decision-tree-edge-dimmed'} ${isOptimal ? 'decision-tree-edge-optimal' : ''}`}
                stroke={isOptimal && active ? '#22c55e' : '#94a3b8'}
                strokeWidth={active ? 2.5 : 1.5}
              />
            )
          })}
          {/* Узлы */}
          {Object.entries(positions).map(([nodeId, pos]) => {
            const idx = Object.keys(positions).indexOf(nodeId)
            if (idx >= visibleLimit) return null
            const pathId = getPathIdForNode(nodeId)
            const active = pathId ? isActive(pathId) : true
            const leaf = leaves.find((l) => l.nodeId === nodeId)
            const meta = leaf ? LEAF_META[leaf.pathId] : null
            const isLeaf = Boolean(leaf)
            return (
              <g key={nodeId} className={`decision-tree-node-wrap ${active ? 'decision-tree-node-active' : 'decision-tree-node-dimmed'}`}>
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={nodeId === 'root' ? 4 : 2}
                  className={`decision-tree-node ${isLeaf ? `decision-tree-node-leaf-${meta?.color || 'red'}` : 'decision-tree-node-alive'}`}
                  fill={isLeaf ? (meta?.color === 'green' ? '#22c55e' : meta?.color === 'orange' ? '#f97316' : '#ef4444') : '#5b8dc9'}
                >
                  {isLeaf && meta && <title>{meta.prob}%</title>}
                </circle>
              </g>
            )
          })}
        </svg>
      </div>
      <div className="decision-tree-buttons">
        {pathIds
          .filter((pid) => LEAF_META[pid]?.color === 'green')
          .sort((a, b) => Number(LEAF_META[b].prob) - Number(LEAF_META[a].prob))
          .slice(0, 3)
          .map((pathId, i) => (
            <button
              key={pathId}
              type="button"
              className={`decision-tree-btn ${hoverPathId === pathId || selectedPathId === pathId ? 'decision-tree-btn-hover' : ''}`}
              onMouseEnter={() => setHoverPathId(pathId)}
              onMouseLeave={() => setHoverPathId(null)}
              onClick={() => {
                onSelect?.(pathId)
              }}
            >
              <span className="decision-tree-btn-label">Вариант {i + 1}</span>
              <span className="decision-tree-btn-pct">{LEAF_META[pathId].prob}%</span>
            </button>
          ))}
      </div>
    </div>
  )
}

export default DecisionTreeView
