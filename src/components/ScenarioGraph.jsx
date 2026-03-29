import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  optimalScenarioEdgeKeys,
  optimalScenarioNodeIds,
  scenarioGraphDimensions,
  scenarioGraphEdges,
  scenarioGraphNodes,
} from '../lib/scenarioGraphData'

const { width: WIDTH, height: HEIGHT } = scenarioGraphDimensions

const LINE_HEIGHT = 13
const ZOOM_MIN = 0.12
const ZOOM_MAX = 2.8
const FIT_PAD = 72
const FIT_ANIM_MS = 520

function maxCharsForWidth(innerWidthPx, fontSize) {
  return Math.max(8, Math.floor(innerWidthPx / (fontSize * 0.52)))
}

function wrapLabelToLines(text, maxCharsPerLine, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean)
  const lines = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (next.length <= maxCharsPerLine) {
      cur = next
    } else {
      if (cur) lines.push(cur)
      if (w.length > maxCharsPerLine) {
        let rest = w
        while (rest.length > 0 && lines.length < maxLines) {
          lines.push(rest.slice(0, maxCharsPerLine))
          rest = rest.slice(maxCharsPerLine)
        }
        cur = rest || ''
      } else {
        cur = w
      }
    }
    if (lines.length >= maxLines) break
  }
  if (lines.length < maxLines && cur) lines.push(cur)
  return lines.slice(0, maxLines)
}

function nodeBox(node) {
  if (node.type === 'start') {
    return { w: 220, h: 46, fontSize: 10, maxLines: 3, padY: 10, iconPad: 28 }
  }
  if (node.type === 'scenario') {
    return { w: 120, h: 42, fontSize: 10, maxLines: 2, padY: 9, iconPad: 26 }
  }
  if (node.type === 'milestone') {
    return { w: 168, h: 46, fontSize: 9, maxLines: 3, padY: 9, iconPad: 26 }
  }
  return { w: 120, h: 46, fontSize: 9, maxLines: 3, padY: 9, iconPad: 26 }
}

function estimateRenderedBox(node) {
  const box = nodeBox(node)
  const innerW = box.w - 12 - (box.iconPad ?? 26)
  const maxChars = maxCharsForWidth(innerW, box.fontSize)
  const lines = wrapLabelToLines(node.label, maxChars, box.maxLines)
  const textBlockH = lines.length * LINE_HEIGHT
  const rectH = Math.max(box.h, textBlockH + box.padY * 2)
  return { w: box.w, h: rectH, lines, box }
}

function nodeStyleByType(type) {
  if (type === 'start') {
    return { fill: '#162032', stroke: '#f59e0b', port: '#fbbf24' }
  }
  if (type === 'scenario') {
    return { fill: '#0c1222', stroke: '#38bdf8', port: '#7dd3fc' }
  }
  if (type === 'milestone') {
    return { fill: '#0d1f1d', stroke: '#34d399', port: '#6ee7b7' }
  }
  return { fill: '#121826', stroke: '#94a3b8', port: '#cbd5e1' }
}

function pickSides(from, to) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const preferVertical = Math.abs(dy) >= Math.abs(dx) * 0.92
  if (preferVertical) {
    return dy >= 0
      ? { sourcePos: 'bottom', targetPos: 'top' }
      : { sourcePos: 'top', targetPos: 'bottom' }
  }
  return dx >= 0
    ? { sourcePos: 'right', targetPos: 'left' }
    : { sourcePos: 'left', targetPos: 'right' }
}

function getHandle(node, position, bw, bh, inPort) {
  const hw = bw / 2
  const hh = bh / 2
  let ox = 0
  if (position === 'top') {
    if (inPort === 0) ox = -16
    if (inPort === 1) ox = 16
    return { x: node.x + ox, y: node.y - hh }
  }
  if (position === 'bottom') return { x: node.x, y: node.y + hh }
  if (position === 'left') return { x: node.x - hw, y: node.y }
  return { x: node.x + hw, y: node.y }
}

function createSmoothBezierPath(from, to, fb, tb, edge) {
  const { sourcePos, targetPos } = pickSides(from, to)
  const inPort = edge.inPort
  const s = getHandle(from, sourcePos, fb.w, fb.h)
  const t = getHandle(to, targetPos, tb.w, tb.h, inPort)

  const dx = t.x - s.x
  const dy = t.y - s.y
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const cBase = Math.max(40, Math.min(155, dist * 0.36))

  let c1x = s.x
  let c1y = s.y
  let c2x = t.x
  let c2y = t.y

  if (sourcePos === 'bottom') c1y += cBase
  else if (sourcePos === 'top') c1y -= cBase
  else if (sourcePos === 'right') c1x += cBase
  else if (sourcePos === 'left') c1x -= cBase

  if (targetPos === 'bottom') c2y += cBase
  else if (targetPos === 'top') c2y -= cBase
  else if (targetPos === 'right') c2x += cBase
  else if (targetPos === 'left') c2x -= cBase

  return `M ${s.x} ${s.y} C ${c1x} ${c1y} ${c2x} ${c2y} ${t.x} ${t.y}`
}

function NodeIcon({ type }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }
  if (type === 'start') {
    return (
      <g className="text-amber-400/90" transform="translate(0,0)">
        <path {...common} d="M4 8 L12 4 L20 8 L12 12 Z M12 12 L12 18" />
      </g>
    )
  }
  if (type === 'scenario') {
    return (
      <g className="text-sky-400/90">
        <rect x={5} y={4} width={14} height={14} rx={3} {...common} />
        <path {...common} d="M8 10 L16 10 M12 7 L12 13" />
      </g>
    )
  }
  if (type === 'milestone') {
    return (
      <g className="text-emerald-400/90">
        <path {...common} d="M12 3 L20 8 L20 16 L12 21 L4 16 L4 8 Z" />
      </g>
    )
  }
  return (
    <g className="text-slate-400/90">
      <circle cx={12} cy={12} r={7} {...common} />
      <path {...common} d="M12 8 L12 16 M8 12 L16 12" />
    </g>
  )
}

function computeBBoxForNodeIds(ids, nodesById, boxById) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const id of ids) {
    const n = nodesById.get(id)
    const b = boxById.get(id)
    if (!n || !b) continue
    const left = n.x - b.w / 2
    const right = n.x + b.w / 2
    const top = n.y - b.h / 2
    const bottom = n.y + b.h / 2
    minX = Math.min(minX, left)
    maxX = Math.max(maxX, right)
    minY = Math.min(minY, top)
    maxY = Math.max(maxY, bottom)
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: WIDTH, maxY: HEIGHT, cx: WIDTH / 2, cy: HEIGHT / 2, bw: WIDTH, bh: HEIGHT }
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const bw = maxX - minX + FIT_PAD * 2
  const bh = maxY - minY + FIT_PAD * 2
  return { minX, minY, maxX, maxY, cx, cy, bw, bh }
}

function viewFromBBox(bbox) {
  const z = Math.min(WIDTH / bbox.bw, HEIGHT / bbox.bh) * 0.94
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
  return {
    zoom,
    pan: { x: WIDTH / 2 - zoom * bbox.cx, y: HEIGHT / 2 - zoom * bbox.cy },
  }
}

function ScenarioGraph({ revealWave = 0, graphComplete = false }) {
  const containerRef = useRef(null)
  const animRef = useRef(null)
  const zoomRef = useRef(0.5)
  const panRef = useRef({ x: 0, y: 0 })

  const [zoom, setZoom] = useState(0.5)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragStart, setDragStart] = useState(null)

  const visibleNodes = useMemo(
    () => scenarioGraphNodes.filter((node) => node.revealWave <= revealWave),
    [revealWave]
  )
  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes])
  const visibleEdges = useMemo(
    () => scenarioGraphEdges.filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to)),
    [visibleIds]
  )

  const nodesById = useMemo(() => {
    const m = new Map()
    scenarioGraphNodes.forEach((n) => m.set(n.id, n))
    return m
  }, [])

  const incomingCount = useMemo(() => {
    const c = new Map()
    for (const n of scenarioGraphNodes) c.set(n.id, 0)
    for (const e of scenarioGraphEdges) {
      c.set(e.to, (c.get(e.to) || 0) + 1)
    }
    return c
  }, [])

  const boxById = useMemo(() => {
    const m = new Map()
    for (const n of scenarioGraphNodes) {
      m.set(n.id, estimateRenderedBox(n))
    }
    return m
  }, [])

  const animateToView = useCallback((targetZoom, targetPan) => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    const z0 = zoomRef.current
    const p0 = { ...panRef.current }
    const z1 = targetZoom
    const p1 = { ...targetPan }
    const t0 = performance.now()

    const step = (now) => {
      const t = Math.min(1, (now - t0) / FIT_ANIM_MS)
      const e = 1 - (1 - t) ** 3
      const z = z0 + (z1 - z0) * e
      const px = p0.x + (p1.x - p0.x) * e
      const py = p0.y + (p1.y - p0.y) * e
      zoomRef.current = z
      panRef.current = { x: px, y: py }
      setZoom(z)
      setPan({ x: px, y: py })
      if (t < 1) animRef.current = requestAnimationFrame(step)
      else animRef.current = null
    }
    animRef.current = requestAnimationFrame(step)
  }, [])

  const fitAllVisible = useCallback(() => {
    const bbox = computeBBoxForNodeIds(visibleIds, nodesById, boxById)
    const v = viewFromBBox(bbox)
    animateToView(v.zoom, v.pan)
  }, [visibleIds, nodesById, boxById, animateToView])

  const fitOptimalOnly = useCallback(() => {
    const ids = [...optimalScenarioNodeIds].filter((id) => visibleIds.has(id))
    const bbox = computeBBoxForNodeIds(ids, nodesById, boxById)
    const v = viewFromBBox(bbox)
    animateToView(v.zoom, v.pan)
  }, [visibleIds, nodesById, boxById, animateToView])

  useEffect(() => {
    zoomRef.current = zoom
    panRef.current = pan
  }, [zoom, pan])

  useEffect(() => {
    if (visibleIds.size === 0) return
    const bbox = computeBBoxForNodeIds(visibleIds, nodesById, boxById)
    const v = viewFromBBox(bbox)
    animateToView(v.zoom, v.pan)
  }, [revealWave, graphComplete, visibleIds, nodesById, boxById, animateToView])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      e.stopPropagation()
      const delta = e.deltaY > 0 ? -0.06 : 0.06
      const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number((zoomRef.current + delta).toFixed(4))))
      const rect = el.getBoundingClientRect()
      const sx = ((e.clientX - rect.left) / rect.width) * WIDTH
      const sy = ((e.clientY - rect.top) / rect.height) * HEIGHT
      const z0 = zoomRef.current
      const p0 = panRef.current
      const wx = (sx - p0.x) / z0
      const wy = (sy - p0.y) / z0
      const p1x = sx - wx * nz
      const p1y = sy - wy * nz
      zoomRef.current = nz
      panRef.current = { x: p1x, y: p1y }
      setZoom(nz)
      setPan({ x: p1x, y: p1y })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const zoomIn = () => {
    const nz = Math.min(ZOOM_MAX, zoomRef.current * 1.18)
    animateToView(nz, panRef.current)
  }
  const zoomOut = () => {
    const nz = Math.max(ZOOM_MIN, zoomRef.current / 1.18)
    animateToView(nz, panRef.current)
  }

  return (
    <div className="w-full">
      <h4 className="mb-3 text-sm font-semibold text-slate-200">Граф сценария</h4>
      <div
        ref={containerRef}
        className="relative h-[560px] w-full cursor-grab overflow-hidden rounded-2xl border border-slate-700/50 bg-[#0a0e14] shadow-[0_20px_60px_rgba(2,6,23,0.65)] active:cursor-grabbing"
        style={{
          touchAction: 'none',
          backgroundImage:
            'linear-gradient(rgba(51,65,85,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(51,65,85,0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          if (e.target.closest('[data-sg-control]')) return
          e.currentTarget.setPointerCapture(e.pointerId)
          setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
        }}
        onPointerMove={(e) => {
          if (!dragStart) return
          const nx = e.clientX - dragStart.x
          const ny = e.clientY - dragStart.y
          zoomRef.current = zoom
          panRef.current = { x: nx, y: ny }
          setPan({ x: nx, y: ny })
        }}
        onPointerUp={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId)
          }
          setDragStart(null)
        }}
        onPointerCancel={() => setDragStart(null)}
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full select-none" preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="sg-node-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#000000" floodOpacity="0.5" />
            </filter>
            <style>
              {`
                @keyframes sg-flow {
                  to { stroke-dashoffset: -32; }
                }
                .sg-flow-line {
                  animation: sg-flow 2.4s linear infinite;
                }
              `}
            </style>
          </defs>
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            <g className="pointer-events-none">
              {visibleEdges.map((edge, idx) => {
                const from = nodesById.get(edge.from)
                const to = nodesById.get(edge.to)
                if (!from || !to) return null
                const fb = boxById.get(edge.from)
                const tb = boxById.get(edge.to)
                if (!fb || !tb) return null
                const d = createSmoothBezierPath(from, to, fb, tb, edge)
                const ekey = `${edge.from}|${edge.to}`
                const isOptimalEdge = graphComplete && optimalScenarioEdgeKeys.has(ekey)
                const baseW = Math.max(2.2, idx % 7 === 0 ? 2.8 : 2.2)
                return (
                  <g key={`${edge.from}-${edge.to}-${idx}`}>
                    <path
                      d={d}
                      fill="none"
                      stroke={
                        isOptimalEdge ? 'rgba(34, 197, 94, 0.22)' : 'rgba(56, 189, 248, 0.35)'
                      }
                      strokeWidth={isOptimalEdge ? Math.max(5, baseW + 2.5) : baseW}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-opacity duration-500"
                    />
                    <path
                      d={d}
                      fill="none"
                      stroke={isOptimalEdge ? 'rgba(74, 222, 128, 0.95)' : 'rgba(56, 189, 248, 0.42)'}
                      strokeWidth={isOptimalEdge ? 2.4 : baseW * 0.55}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={isOptimalEdge ? '5 14' : undefined}
                      className={isOptimalEdge ? 'sg-flow-line' : 'transition-opacity duration-500'}
                    />
                  </g>
                )
              })}
            </g>

            {scenarioGraphNodes.map((node) => {
              const visible = visibleIds.has(node.id)
              const styles = nodeStyleByType(node.type)
              const isOptimal = graphComplete && optimalScenarioNodeIds.has(node.id)
              const { w: bw, h: rectH, box } = estimateRenderedBox(node)
              const left = node.x - bw / 2
              const top = node.y - rectH / 2
              const iconPad = box.iconPad ?? 26
              const textStartX = iconPad + 6
              const textInnerW = bw - textStartX - 8
              const maxChars = maxCharsForWidth(textInnerW, box.fontSize)
              const linesClamped = wrapLabelToLines(node.label, maxChars, box.maxLines)
              const textBlockH = linesClamped.length * LINE_HEIGHT
              const textStartY = rectH / 2 - textBlockH / 2 + LINE_HEIGHT * 0.72

              const strokeColor = isOptimal ? '#4ade80' : styles.stroke
              const strokeW = isOptimal ? 2.85 : 1.2
              const fillCol = isOptimal ? '#0f1f14' : styles.fill
              const portStroke = isOptimal ? '#4ade80' : styles.port
              const inc = incomingCount.get(node.id) || 0
              const showDualIn = node.type === 'milestone' && inc >= 2

              return (
                <g key={node.id}>
                  <g transform={`translate(${left}, ${top})`}>
                    <g
                      className="transition-all duration-500 ease-out"
                      style={{
                        opacity: visible ? 1 : 0,
                        transform: visible ? 'translateY(0)' : 'translateY(6px)',
                      }}
                    >
                      <defs>
                        <clipPath id={`sg-clip-${node.id}`}>
                          <rect x="0" y="0" width={bw} height={rectH} rx="12" ry="12" />
                        </clipPath>
                      </defs>
                      <rect
                        width={bw}
                        height={rectH}
                        rx="12"
                        ry="12"
                        fill={fillCol}
                        stroke={strokeColor}
                        strokeWidth={strokeW}
                        filter="url(#sg-node-shadow)"
                        className={isOptimal ? 'drop-shadow-[0_0_12px_rgba(74,222,128,0.45)]' : ''}
                      />
                      <g transform={`translate(8, ${rectH / 2 - 12})`}>
                        <NodeIcon type={node.type} />
                      </g>
                      <text
                        x={textStartX}
                        y={textStartY}
                        textAnchor="start"
                        fontSize={box.fontSize}
                        fill="#e2e8f0"
                        style={{ pointerEvents: 'none', fontWeight: 600 }}
                        clipPath={`url(#sg-clip-${node.id})`}
                      >
                        {linesClamped.map((line, i) => (
                          <tspan key={i} x={textStartX} dy={i === 0 ? 0 : LINE_HEIGHT}>
                            {line}
                          </tspan>
                        ))}
                      </text>
                    </g>
                  </g>

                  {visible && (
                    <g className="pointer-events-none">
                      {showDualIn ? (
                        <>
                          <circle
                            cx={node.x - 16}
                            cy={node.y - rectH / 2}
                            r={4.5}
                            fill="#0a0e14"
                            stroke={portStroke}
                            strokeWidth={isOptimal ? 2.2 : 1.8}
                          />
                          <circle
                            cx={node.x + 16}
                            cy={node.y - rectH / 2}
                            r={4.5}
                            fill="#0a0e14"
                            stroke={portStroke}
                            strokeWidth={isOptimal ? 2.2 : 1.8}
                          />
                        </>
                      ) : (
                        <circle
                          cx={node.x}
                          cy={node.y - rectH / 2}
                          r={4.5}
                          fill="#0a0e14"
                          stroke={portStroke}
                          strokeWidth={isOptimal ? 2.2 : 1.8}
                        />
                      )}
                      <circle
                        cx={node.x}
                        cy={node.y + rectH / 2}
                        r={4.5}
                        fill="#0a0e14"
                        stroke={portStroke}
                        strokeWidth={isOptimal ? 2.2 : 1.8}
                      />
                    </g>
                  )}
                </g>
              )
            })}
          </g>
        </svg>

        <div
          className="absolute bottom-3 right-3 z-10 flex flex-col gap-1 rounded-xl border border-slate-700/80 bg-slate-900/92 p-1 shadow-lg"
          data-sg-control
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex gap-1">
            <button
              type="button"
              data-sg-control
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-lg font-medium text-slate-200 hover:bg-slate-700"
              aria-label="Приблизить"
              onClick={zoomIn}
            >
              +
            </button>
            <button
              type="button"
              data-sg-control
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-lg font-medium text-slate-200 hover:bg-slate-700"
              aria-label="Отдалить"
              onClick={zoomOut}
            >
              −
            </button>
          </div>
          <button
            type="button"
            data-sg-control
            className="rounded-lg bg-slate-800 px-2 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-slate-700"
            onClick={fitAllVisible}
          >
            Весь граф
          </button>
          <button
            type="button"
            data-sg-control
            className="rounded-lg bg-emerald-950/80 px-2 py-1.5 text-[11px] font-medium text-emerald-200 hover:bg-emerald-900/80"
            onClick={fitOptimalOnly}
          >
            Лучший сценарий
          </button>
          <div className="pointer-events-none px-1 pb-0.5 text-center text-[10px] text-slate-500">
            {Math.round(zoom * 100)}%
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScenarioGraph