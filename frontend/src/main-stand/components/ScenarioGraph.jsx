import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
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
const FIT_DEBOUNCE_MS = 220

/** Визуальный акцент лучшего сценария: ~×3 толще/ярче базовых значений */
const OPT_EDGE_GLOW_W = 18
const OPT_EDGE_FORE_W = 7.2
const OPT_NODE_STROKE_W = 8.5
const OPT_PORT_STROKE_W = 6.6

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

const NodeIcon = memo(function NodeIcon({ type }) {
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
})

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

const GraphNode = memo(function GraphNode({ node, visible, layout, inc, isEntering }) {
  const {
    bw,
    rectH,
    box,
    left,
    top,
    textStartX,
    linesClamped,
    textStartY,
    strokeColor,
    strokeW,
    fillCol,
    portStroke,
    portStrokeW,
    isOptimal,
    nodeType,
  } = layout
  const showDualIn = nodeType === 'milestone' && inc >= 2
  const enterClass = visible && isEntering ? 'sg-node-entering' : ''
  const glowClass = visible && isEntering ? 'sg-node-glow-rect' : ''

  return (
    <g>
      <g transform={`translate(${left}, ${top})`}>
        <g
          className={enterClass}
          style={{
            opacity: visible ? (isEntering ? undefined : 1) : 0,
            transition: visible && !isEntering ? 'opacity 0.35s ease-out' : undefined,
            transformBox: 'fill-box',
            transformOrigin: 'center center',
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
            className={glowClass}
          />
          <g transform={`translate(8, ${rectH / 2 - 12})`}>
            <NodeIcon type={nodeType} />
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
                strokeWidth={portStrokeW}
              />
              <circle
                cx={node.x + 16}
                cy={node.y - rectH / 2}
                r={4.5}
                fill="#0a0e14"
                stroke={portStroke}
                strokeWidth={portStrokeW}
              />
            </>
          ) : (
            <circle
              cx={node.x}
              cy={node.y - rectH / 2}
              r={4.5}
              fill="#0a0e14"
              stroke={portStroke}
              strokeWidth={portStrokeW}
            />
          )}
          <circle
            cx={node.x}
            cy={node.y + rectH / 2}
            r={4.5}
            fill="#0a0e14"
            stroke={portStroke}
            strokeWidth={portStrokeW}
          />
        </g>
      )}
    </g>
  )
})

function ScenarioGraph({ visibleNodeIds = new Set(), graphComplete = false }) {
  const containerRef = useRef(null)
  const viewRef = useRef(null)
  const animRef = useRef(null)
  const zoomRef = useRef(0.5)
  const panRef = useRef({ x: 0, y: 0 })
  const dragRef = useRef(null)
  const prevVisibleRef = useRef(new Set(visibleNodeIds))
  const fitDebounceRef = useRef(null)

  const enteringNodeIds = useMemo(() => {
    const added = new Set()
    for (const id of visibleNodeIds) {
      if (!prevVisibleRef.current.has(id)) added.add(id)
    }
    return added
  }, [visibleNodeIds])

  useLayoutEffect(() => {
    prevVisibleRef.current = new Set(visibleNodeIds)
  }, [visibleNodeIds])

  const applyViewTransform = useCallback(() => {
    const g = viewRef.current
    if (!g) return
    const { x, y } = panRef.current
    const z = zoomRef.current
    g.setAttribute('transform', `translate(${x},${y}) scale(${z})`)
  }, [])

  /** После любого ре-рендера синхронизируем pan/zoom в DOM (React не должен затирать transform). */
  useLayoutEffect(() => {
    applyViewTransform()
  })

  const visibleNodes = useMemo(
    () => scenarioGraphNodes.filter((node) => visibleNodeIds.has(node.id)),
    [visibleNodeIds]
  )
  const visibleIds = visibleNodeIds
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

  const edgeLayouts = useMemo(() => {
    return visibleEdges.map((edge, idx) => {
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
      const isNewEdge = enteringNodeIds.has(edge.to) && visibleNodeIds.has(edge.from)
      return {
        d,
        key: `${edge.from}-${edge.to}-${idx}`,
        isOptimalEdge,
        baseW,
        isNewEdge,
      }
    })
  }, [visibleEdges, graphComplete, nodesById, boxById, enteringNodeIds, visibleNodeIds])

  const nodeLayouts = useMemo(() => {
    const m = new Map()
    for (const node of scenarioGraphNodes) {
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
      const styles = nodeStyleByType(node.type)
      const isOptimal = graphComplete && optimalScenarioNodeIds.has(node.id)
      const strokeColor = isOptimal ? '#bbf7d0' : styles.stroke
      const strokeW = isOptimal ? OPT_NODE_STROKE_W : 1.2
      const fillCol = isOptimal ? '#071c12' : styles.fill
      const portStroke = isOptimal ? '#ecfdf5' : styles.port
      const portStrokeW = isOptimal ? OPT_PORT_STROKE_W : 1.8
      m.set(node.id, {
        bw,
        rectH,
        box,
        left,
        top,
        textStartX,
        linesClamped,
        textStartY,
        strokeColor,
        strokeW,
        fillCol,
        portStroke,
        portStrokeW,
        isOptimal,
        nodeType: node.type,
      })
    }
    return m
  }, [graphComplete])

  const animateToView = useCallback(
    (targetZoom, targetPan) => {
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
        applyViewTransform()
        if (t < 1) animRef.current = requestAnimationFrame(step)
        else animRef.current = null
      }
      animRef.current = requestAnimationFrame(step)
    },
    [applyViewTransform]
  )

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
    if (visibleIds.size === 0) return
    if (fitDebounceRef.current) clearTimeout(fitDebounceRef.current)
    fitDebounceRef.current = setTimeout(() => {
      fitDebounceRef.current = null
      const bbox = computeBBoxForNodeIds(visibleIds, nodesById, boxById)
      const v = viewFromBBox(bbox)
      animateToView(v.zoom, v.pan)
    }, FIT_DEBOUNCE_MS)
    return () => {
      if (fitDebounceRef.current) clearTimeout(fitDebounceRef.current)
    }
  }, [visibleIds, graphComplete, nodesById, boxById, animateToView])

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
      zoomRef.current = nz
      panRef.current = { x: sx - wx * nz, y: sy - wy * nz }
      applyViewTransform()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [applyViewTransform])

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
      <h3 className="app-thinking-drawer-title mb-4">Граф сценария</h3>
      <div
        ref={containerRef}
        className="relative h-[560px] w-full cursor-grab overflow-hidden rounded-2xl border border-slate-700/50 bg-[#0a0e14] active:cursor-grabbing"
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
          dragRef.current = {
            sx: e.clientX,
            sy: e.clientY,
            px: panRef.current.x,
            py: panRef.current.y,
          }
        }}
        onPointerMove={(e) => {
          if (!dragRef.current) return
          panRef.current = {
            x: e.clientX - dragRef.current.sx + dragRef.current.px,
            y: e.clientY - dragRef.current.sy + dragRef.current.py,
          }
          applyViewTransform()
        }}
        onPointerUp={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId)
          }
          dragRef.current = null
        }}
        onPointerCancel={() => {
          dragRef.current = null
        }}
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full select-none" preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="sg-node-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#000000" floodOpacity="0.45" />
            </filter>
            <filter id="sg-node-shadow-opt" x="-40%" y="-40%" width="180%" height="180%">
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
                @keyframes sg-flow-opt {
                  to { stroke-dashoffset: -132; }
                }
                .sg-opt-flow {
                  animation: sg-flow-opt 0.62s linear infinite;
                  filter: drop-shadow(0 0 4px rgba(240, 253, 244, 1))
                    drop-shadow(0 0 12px rgba(134, 239, 172, 0.95))
                    drop-shadow(0 0 22px rgba(34, 197, 94, 0.65));
                }
                @keyframes sg-node-enter {
                  from {
                    opacity: 0;
                    transform: scale(0.88);
                  }
                  to {
                    opacity: 1;
                    transform: scale(1);
                  }
                }
                .sg-node-entering {
                  animation: sg-node-enter 0.52s cubic-bezier(0.22, 1, 0.36, 1) forwards;
                }
                @keyframes sg-node-glow-fade {
                  from {
                    filter: drop-shadow(0 0 10px rgba(125, 211, 252, 0.55));
                  }
                  to {
                    filter: drop-shadow(0 0 0 rgba(125, 211, 252, 0));
                  }
                }
                .sg-node-glow-rect {
                  animation: sg-node-glow-fade 0.65s ease-out forwards;
                }
                @keyframes sg-edge-draw {
                  to {
                    stroke-dashoffset: 0;
                  }
                }
                .sg-edge-draw-in {
                  stroke-dasharray: 1;
                  stroke-dashoffset: 1;
                  animation: sg-edge-draw 0.48s ease-out forwards;
                }
              `}
            </style>
          </defs>
          <g ref={viewRef}>
            <g className="pointer-events-none">
              {edgeLayouts.map((item) => {
                if (!item) return null
                const { d, key, isOptimalEdge, baseW, isNewEdge } = item
                const useDraw = isNewEdge && !isOptimalEdge
                return (
                  <g key={key}>
                    <path
                      d={d}
                      fill="none"
                      stroke={
                        isOptimalEdge ? 'rgba(134, 239, 172, 0.72)' : 'rgba(56, 189, 248, 0.35)'
                      }
                      strokeWidth={isOptimalEdge ? Math.max(OPT_EDGE_GLOW_W, baseW * 3 + 9) : baseW}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      pathLength={useDraw ? 1 : undefined}
                      className={useDraw ? 'sg-edge-draw-in' : undefined}
                    />
                    <path
                      d={d}
                      fill="none"
                      stroke={
                        isOptimalEdge ? 'rgba(240, 253, 244, 0.98)' : 'rgba(56, 189, 248, 0.42)'
                      }
                      strokeWidth={isOptimalEdge ? OPT_EDGE_FORE_W : baseW * 0.55}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      pathLength={useDraw ? 1 : undefined}
                      strokeDasharray={isOptimalEdge ? '18 42' : undefined}
                      className={isOptimalEdge ? 'sg-opt-flow' : useDraw ? 'sg-edge-draw-in' : undefined}
                    />
                  </g>
                )
              })}
            </g>

            {scenarioGraphNodes.map((node) => {
              const visible = visibleIds.has(node.id)
              const layout = nodeLayouts.get(node.id)
              if (!layout) return null
              const inc = incomingCount.get(node.id) || 0
              return (
                <GraphNode
                  key={node.id}
                  node={node}
                  visible={visible}
                  layout={layout}
                  inc={inc}
                  isEntering={enteringNodeIds.has(node.id)}
                />
              )
            })}
          </g>
        </svg>

        <div className="absolute bottom-3 right-3 z-10 grid grid-cols-2 gap-2" onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            data-sg-control
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700/80 bg-[#0a0e14] text-slate-100 shadow-none transition-colors hover:bg-slate-900/60 active:bg-slate-800/60"
            aria-label="Zoom in"
            onClick={zoomIn}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </button>
          <button
            type="button"
            data-sg-control
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700/80 bg-[#0a0e14] text-slate-100 shadow-none transition-colors hover:bg-slate-900/60 active:bg-slate-800/60"
            aria-label="Zoom out"
            onClick={zoomOut}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
            </svg>
          </button>
          <button
            type="button"
            data-sg-control
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700/80 bg-[#0a0e14] text-slate-100 shadow-none transition-colors hover:bg-slate-900/60 active:bg-slate-800/60"
            aria-label="Center graph"
            onClick={fitAllVisible}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3.1" />
              <path d="M12 2v4" />
              <path d="M12 18v4" />
              <path d="M2 12h4" />
              <path d="M18 12h4" />
              <path d="M4.6 4.6l2.8 2.8" />
              <path d="M16.6 16.6l2.8 2.8" />
            </svg>
          </button>
          <button
            type="button"
            data-sg-control
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-700/50 bg-[#0a0e14] text-emerald-300 shadow-none transition-colors hover:bg-slate-900/60 active:bg-slate-800/60"
            aria-label="Fit best scenario"
            onClick={fitOptimalOnly}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 21h8" />
              <path d="M12 17v4" />
              <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
              <path d="M7 6H5a2 2 0 0 0 2 2" />
              <path d="M17 6h2a2 2 0 0 1-2 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default memo(ScenarioGraph)
