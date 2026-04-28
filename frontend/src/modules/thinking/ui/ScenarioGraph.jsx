import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import chrome from './thinkingDrawerChrome.module.css'
import { getCdProgramDisplayName } from '../../../core/data/static/funnelEntities.js'
import {
  optimalScenarioEdgeKeys,
  optimalScenarioNodeIds,
  scenarioGraphDimensions,
  scenarioGraphEdges,
  scenarioGraphNodes,
} from '../lib/scenarioGraphData'
import { getNewDemoThinkingBandLayout } from '../lib/scenarioGraphLayout'
import { generateScenarioSummaryDetailed } from '../lib/llmScenarioSummaryGenerator.js'

const LINE_HEIGHT = 15
const ZOOM_MIN = 0.08
const ZOOM_MAX = 2.8
const FIT_PAD = 56
const FIT_ANIM_MS = 520
const FIT_DEBOUNCE_MS = 220
/**
 * После появления узла в графе: сначала отстройка линии/соседа, затем красный акцент (связь + зачёркивание).
 * Должно быть ≥ длительности `.sg-edge-draw-in` в стилях ниже.
 */
const REVEAL_ACCENT_DELAY_MS = 2000
/** Интервал между этапами гирлянды лучшего и «красного сценария» пути (new-demo), мс */
const BRANCH_GARLAND_STEP_MS = 200

/** Визуальный акцент лучшего сценария: тонкая яркая линия + мягкий ореол */
const OPT_EDGE_GLOW_W = 8.5
const OPT_EDGE_FORE_W = 3.2
const OPT_NODE_STROKE_W = 8.5
const OPT_PORT_STROKE_W = 6.6

/** Подписи над вертикальными полосами этапов (сетка мышления) */
const THINKING_STAGE_BAND_LABELS = [
  'Процесс целеполагания',
  'Анализ причин',
  'Формирование гипотез',
  'Моделирование сценариев',
]

function maxCharsForWidth(innerWidthPx, fontSize) {
  return Math.max(8, Math.floor(innerWidthPx / (fontSize * 0.52)))
}

/** Узлы «Причина n» / «Гипотеза n» — одна строка, подбор шрифта под ширину */
function isCatalogStepNode(node) {
  return /^cause-\d+$/.test(node.id) || /^hyp-\d+$/.test(node.id)
}

/** Столбики «запрос / цели / причины / гипотезы» на new-demo — один размер и шрифт. */
function isNewDemoPillarRectNode(node) {
  return (
    node.id === 'userQuery' ||
    /^scenario-\d+$/.test(node.id) ||
    /^cause-\d+$/.test(node.id) ||
    /^hyp-\d+$/.test(node.id)
  )
}

/** Порядок «сверху вниз, слева направо» для стабильной нумерации подписей на сетке */
function compareThinkingNodeLayoutOrder(a, b) {
  const dy = a.y - b.y
  if (Math.abs(dy) > 0.5) return dy
  return a.x - b.x
}

/**
 * Подписи «Гипотеза 1…», «Сценарий 1…» по позиции на холсте, а не по глобальному id
 * (id остаётся hyp-6 / out-scenario-11 для рёбер и данных).
 */
function buildThinkingSequentialDisplayLabels(nodes) {
  const hypNodes = nodes.filter((n) => /^hyp-\d+$/.test(n.id)).sort(compareThinkingNodeLayoutOrder)
  const outNodes = nodes
    .filter((n) => n.type === 'outcome' || /^out-scenario-\d+$/.test(n.id))
    .sort(compareThinkingNodeLayoutOrder)
  const hypLabelById = new Map()
  const outLabelById = new Map()
  hypNodes.forEach((n, i) => hypLabelById.set(n.id, `Гипотеза ${i + 1}`))
  outNodes.forEach((n, i) => outLabelById.set(n.id, `Сценарий ${i + 1}`))
  return { hypLabelById, outLabelById }
}

/** При семантическом бандле подписи задаются на узлах; иначе — порядковые по раскладке. */
function pickDisplayLabelForNode(node, graphBundle, hypLabelById, outLabelById) {
  if (graphBundle != null && String(node.label ?? '').trim()) {
    return node.label
  }
  return hypLabelById.get(node.id) ?? outLabelById.get(node.id) ?? undefined
}

function formatDigitalTwinPopoverTitle(label) {
  const raw = String(label ?? '').trim()
  if (!raw) return ''
  const expandedProgram = getCdProgramDisplayName(raw)
  if (expandedProgram && expandedProgram !== raw) return expandedProgram
  if (/^ЦД\s+/i.test(raw)) {
    return `Цифровой двойник ${raw.replace(/^ЦД\s+/i, '')}`
  }
  return raw
}

const OUT_SCENARIO_ID_RE = /^out-scenario-\d+$/

/**
 * Узлы оптимального подграфа в порядке обхода от зелёных шаров к корню (BFS по обратным рёбрам).
 * Сами шары out-scenario-* в список не входят — они считаются уже «зажжёнными» для стыковки рёбер.
 */
function buildOptimalGarlandNonOutcomeSequence(
  edges,
  optimalEdgeKeys,
  optimalNodeIds,
  preferredScenarioOutcomeIds,
) {
  if (!optimalEdgeKeys || !optimalNodeIds?.size) return []
  const preds = new Map()
  for (const e of edges) {
    const k = `${e.from}|${e.to}`
    if (!optimalEdgeKeys.has(k)) continue
    if (!optimalNodeIds.has(e.from) || !optimalNodeIds.has(e.to)) continue
    if (!preds.has(e.to)) preds.set(e.to, [])
    preds.get(e.to).push(e.from)
  }
  const seeds = [...preferredScenarioOutcomeIds].filter((id) => optimalNodeIds.has(id))
  if (!seeds.length) return []
  const seen = new Set()
  const q = []
  for (const s of seeds) {
    seen.add(s)
    q.push(s)
  }
  const order = []
  while (q.length) {
    const v = q.shift()
    for (const u of preds.get(v) || []) {
      if (!optimalNodeIds.has(u) || seen.has(u)) continue
      seen.add(u)
      if (!OUT_SCENARIO_ID_RE.test(u)) order.push(u)
      q.push(u)
    }
  }
  return order
}

/**
 * Узлы ветки к нежелательному шару сценария — от красных шаров к корню по рёбрам redLogical,
 * без «обрубков» (dead stub, redTerminalHop на настоящих листах).
 * Рёбра к шару `out-scenario-*` не считаются обрубом: иначе гирлянда не может отойти от красного шара.
 */
function buildRedGarlandNonOutcomeSequence(
  visibleEdges,
  edgeFlagRows,
  redGarlandTerminalSkipByIdx,
  canReachBadScenario,
  badScenarioOutcomeIds,
) {
  const preds = new Map()
  for (let i = 0; i < visibleEdges.length; i++) {
    const e = visibleEdges[i]
    const row = edgeFlagRows[i]
    if (!row?.redLogical || row.isDeadStubEdge || redGarlandTerminalSkipByIdx[i]) continue
    if (!canReachBadScenario.has(e.from) || !canReachBadScenario.has(e.to)) continue
    if (!preds.has(e.to)) preds.set(e.to, [])
    preds.get(e.to).push(e.from)
  }
  const seeds = [...badScenarioOutcomeIds].filter((id) => canReachBadScenario.has(id))
  if (!seeds.length) return []
  const seen = new Set()
  const q = []
  for (const s of seeds) {
    seen.add(s)
    q.push(s)
  }
  const order = []
  while (q.length) {
    const v = q.shift()
    for (const u of preds.get(v) || []) {
      if (!canReachBadScenario.has(u) || seen.has(u)) continue
      seen.add(u)
      if (!OUT_SCENARIO_ID_RE.test(u)) order.push(u)
      q.push(u)
    }
  }
  return order
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

const NEW_DEMO_PILLAR_BOX = { w: 132, h: 42, fontSize: 9.1, maxLines: 2, padY: 8, iconPad: 26 }

function nodeBox(node, isNewDemo = false) {
  if (isNewDemo && isNewDemoPillarRectNode(node)) {
    return { ...NEW_DEMO_PILLAR_BOX }
  }
  if (isNewDemo) {
    if (node.type === 'milestone') return { w: 90, h: 32, fontSize: 8.5, maxLines: 2, padY: 6, iconPad: 18 }
    return { w: 88, h: 32, fontSize: 8.5, maxLines: 2, padY: 6, iconPad: 18 }
  }
  if (node.type === 'start') {
    return { w: 300, h: 64, fontSize: 13, maxLines: 3, padY: 14, iconPad: 36 }
  }
  if (node.type === 'scenario') {
    return { w: 176, h: 58, fontSize: 13, maxLines: 2, padY: 12, iconPad: 34 }
  }
  if (node.type === 'milestone') {
    return { w: 216, h: 60, fontSize: 12, maxLines: 3, padY: 12, iconPad: 32 }
  }
  return { w: 176, h: 58, fontSize: 12, maxLines: 3, padY: 12, iconPad: 34 }
}

function estimateRenderedBox(node, isNewDemo = false, displayLabel) {
  const textSource = displayLabel != null ? displayLabel : node.label
  if (node.type === 'outcome') {
    const label = String(textSource || '')
    const isCdBall = /^cd-\d+$/.test(node.id)
    const D = isNewDemo ? (isCdBall ? 54 : 78) : 94
    const charN = Math.max(1, label.length)
    const fs = Math.min(
      isNewDemo ? (isCdBall ? 9 : 10) : 11.5,
      Math.max(isNewDemo ? (isCdBall ? 6.8 : 7.2) : 8.2, (D * 0.88) / (charN * 0.58)),
    )
    const box = { w: D, h: D, fontSize: fs, maxLines: 1, padY: 0, iconPad: 0 }
    return { w: D, h: D, lines: [label], box }
  }

  const boxBase = nodeBox(node, isNewDemo)

  if (isCatalogStepNode(node)) {
    const label = String(textSource || '')
    if (isNewDemo && isNewDemoPillarRectNode(node)) {
      const w = NEW_DEMO_PILLAR_BOX.w
      const iconPad = NEW_DEMO_PILLAR_BOX.iconPad
      const innerW = w - 12 - iconPad
      const maxChars = maxCharsForWidth(innerW, NEW_DEMO_PILLAR_BOX.fontSize)
      const lines =
        label.trim().length > 0
          ? wrapLabelToLines(label.trim(), maxChars, NEW_DEMO_PILLAR_BOX.maxLines)
          : ['']
      const box = { ...boxBase, w, iconPad, fontSize: NEW_DEMO_PILLAR_BOX.fontSize, maxLines: NEW_DEMO_PILLAR_BOX.maxLines }
      const textBlockH = lines.length * LINE_HEIGHT
      const rectH = Math.max(box.h, textBlockH + box.padY * 2 + 4)
      return { w: box.w, h: rectH, lines, box }
    }
    const w = isNewDemo ? 104 : 216
    const iconPad = isNewDemo ? 16 : 22
    const innerW = w - 12 - iconPad
    const charUnit = 0.55
    const rawFs = innerW / (Math.max(1, label.length) * charUnit)
    const fontSize = Math.min(isNewDemo ? 11.5 : 15, Math.max(isNewDemo ? 8.5 : 11.5, rawFs))
    const box = { ...boxBase, w, iconPad, fontSize, maxLines: 1 }
    const textBlockH = Math.max(LINE_HEIGHT, fontSize * 1.35)
    const rectH = Math.max(box.h, textBlockH + box.padY * 2 + 8)
    return { w: box.w, h: rectH, lines: [label], box }
  }

  const box = boxBase
  const iconPad = box.iconPad ?? 26
  const innerW = box.w - 12 - iconPad
  const maxChars = maxCharsForWidth(innerW, box.fontSize)
  const trimmed = String(textSource ?? '').trim()
  const lines =
    trimmed.length > 0 ? wrapLabelToLines(trimmed, maxChars, box.maxLines) : ['']
  const textBlockH = lines.length * LINE_HEIGHT
  const rectH = Math.max(box.h, textBlockH + box.padY * 2)
  return { w: box.w, h: rectH, lines, box }
}

function nodeStyleByType(type, palette) {
  if (type === 'start') {
    return { fill: palette.startFill, stroke: palette.startStroke, port: palette.startPort }
  }
  if (type === 'scenario') {
    return { fill: palette.scenarioFill, stroke: palette.scenarioStroke, port: palette.scenarioPort }
  }
  if (type === 'milestone') {
    return { fill: palette.milestoneFill, stroke: palette.milestoneStroke, port: palette.milestonePort }
  }
  if (type === 'outcome') {
    return { fill: palette.outcomeFill, stroke: palette.outcomeStroke, port: palette.outcomePort }
  }
  return { fill: palette.defaultFill, stroke: palette.defaultStroke, port: palette.defaultPort }
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
    else if (inPort === 1) ox = 16
    else if (inPort === 2) ox = 0
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

/** Расстояние между двумя активными указателями и середина (в координатах контейнера). */
function twoFingerMidAndDistFromPointerMap(map) {
  const pts = [...map.values()]
  if (pts.length < 2) return null
  const [a, b] = pts
  const dx = b.x - a.x
  const dy = b.y - a.y
  return {
    dist: Math.hypot(dx, dy) || 1,
    midX: (a.x + b.x) / 2,
    midY: (a.y + b.y) / 2,
  }
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

function computeBBoxForNodeIds(ids, nodesById, boxById, viewW, viewH, extraTopY = null) {
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
  if (Number.isFinite(extraTopY)) {
    minY = Math.min(minY, extraTopY)
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: viewW, maxY: viewH, cx: viewW / 2, cy: viewH / 2, bw: viewW, bh: viewH }
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const bw = maxX - minX + FIT_PAD * 2
  const bh = maxY - minY + FIT_PAD * 2
  return { minX, minY, maxX, maxY, cx, cy, bw, bh }
}

function viewFromBBox(bbox, viewW, viewH, fitScale = 0.97) {
  const z = Math.min(viewW / bbox.bw, viewH / bbox.bh) * fitScale
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
  return {
    zoom,
    pan: { x: viewW / 2 - zoom * bbox.cx, y: viewH / 2 - zoom * bbox.cy },
  }
}

const OutcomeBallNode = memo(function OutcomeBallNode({
  node,
  visible,
  layout,
  isEntering,
  isNewDemo = false,
  onNodeClick,
}) {
  const { bw, strokeColor, strokeW, portStroke, portStrokeW, box, linesClamped, bodyOpacity, stubBreakCross } = layout
  const R = bw / 2
  const enterClass = visible && isEntering ? 'sg-node-entering' : ''
  const fs = box.fontSize
  const bodyOp = bodyOpacity != null ? bodyOpacity : 1
  const showDeadScenarioCross = Boolean(stubBreakCross)
  const crossHalf = Math.max(12, R * 0.82)

  return (
    <g>
      <g
        className={enterClass}
        style={{
          opacity: visible ? (isEntering ? undefined : bodyOp) : 0,
          transition: visible && !isEntering ? 'opacity 0.35s ease-out' : undefined,
          transformBox: 'fill-box',
          transformOrigin: `${node.x}px ${node.y}px`,
        }}
      >
        <circle cx={node.x} cy={node.y} r={R} fill="none" stroke={strokeColor} strokeWidth={strokeW} />
        <text
          x={node.x}
          y={node.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={fs}
          fill={isNewDemo ? '#e2e8f0' : '#cbd5e1'}
          style={{ pointerEvents: 'none', fontWeight: 700 }}
        >
          {layout.linesClamped?.[0] ?? node.label}
        </text>
        {visible && onNodeClick ? (
          <circle
            data-sg-node-hit
            cx={node.x}
            cy={node.y}
            r={R}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation()
              onNodeClick(node.id)
            }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : null}
      </g>
      {visible && (
        <g className="pointer-events-none">
          <circle cx={node.x} cy={node.y - R} r={4.5} fill="#0a0e14" stroke={portStroke} strokeWidth={portStrokeW} />
          <circle cx={node.x} cy={node.y + R} r={4.5} fill="#0a0e14" stroke={portStroke} strokeWidth={portStrokeW} />
          <circle cx={node.x - R} cy={node.y} r={4.5} fill="#0a0e14" stroke={portStroke} strokeWidth={portStrokeW} />
          <circle cx={node.x + R} cy={node.y} r={4.5} fill="#0a0e14" stroke={portStroke} strokeWidth={portStrokeW} />
        </g>
      )}
      {visible && showDeadScenarioCross && (
        <g className="sg-stub-cross pointer-events-none" transform={`translate(${node.x},${node.y})`}>
          <line
            x1={-crossHalf}
            y1={-crossHalf}
            x2={crossHalf}
            y2={crossHalf}
            stroke="#ff0f0f"
            strokeWidth={isNewDemo ? 3.6 : 3.2}
            strokeLinecap="round"
          />
          <line
            x1={-crossHalf}
            y1={crossHalf}
            x2={crossHalf}
            y2={-crossHalf}
            stroke="#ff0f0f"
            strokeWidth={isNewDemo ? 3.6 : 3.2}
            strokeLinecap="round"
          />
        </g>
      )}
    </g>
  )
})

const GraphNode = memo(function GraphNode({ node, visible, layout, inc, isEntering, isNewDemo = false, onNodeClick }) {
  const scenarioStub = node.type === 'scenario' && node.scenarioSlotUnused
  const {
    bw,
    rectH,
    box,
    left,
    top,
    textStartX,
    linesClamped,
    textStartY,
    catalogText,
    strokeColor,
    strokeW,
    fillCol,
    portStroke,
    portStrokeW,
    isOptimal,
    nodeType,
    bodyOpacity,
    stubBreakCross,
  } = layout
  const bodyOp = bodyOpacity != null ? bodyOpacity : 1
  const showStubCross = Boolean(stubBreakCross)
  const showDualIn = nodeType === 'milestone' && inc >= 2
  const enterClass = visible && isEntering ? 'sg-node-entering' : ''
  const glowClass = visible && isEntering ? 'sg-node-glow-rect' : ''

  return (
    <g>
      <g transform={`translate(${left}, ${top})`}>
        <g
          className={enterClass}
          style={{
            opacity: visible
              ? (isEntering ? undefined : scenarioStub && !isNewDemo ? 0.24 : bodyOp)
              : 0,
            transition: visible && !isEntering ? 'opacity 0.35s ease-out' : undefined,
            transformBox: 'fill-box',
            transformOrigin: 'center center',
          }}
        >
          <defs>
            <clipPath id={`sg-clip-${node.id}`}>
              <rect x="0" y="0" width={bw} height={rectH} rx={isNewDemo ? "8" : "14"} ry={isNewDemo ? "8" : "14"} />
            </clipPath>
          </defs>
          <rect
            width={bw}
            height={rectH}
            rx={isNewDemo ? "8" : "14"}
            ry={isNewDemo ? "8" : "14"}
            fill={fillCol}
            stroke={strokeColor}
            strokeWidth={strokeW}
            className={glowClass}
          />
          <g transform={`translate(${isNewDemo ? 8 : 12}, ${rectH / 2 - 12})`}>
            <NodeIcon type={nodeType} />
          </g>
          <text
            x={textStartX}
            y={textStartY}
            textAnchor="start"
            dominantBaseline={catalogText ? 'middle' : 'auto'}
            fontSize={box.fontSize}
            fill={isNewDemo ? "#f4fbff" : "#e2e8f0"}
            style={{ pointerEvents: 'none', fontWeight: 600 }}
            clipPath={`url(#sg-clip-${node.id})`}
          >
            {linesClamped.map((line, i) => (
              <tspan key={i} x={textStartX} dy={i === 0 ? 0 : LINE_HEIGHT}>
                {line}
              </tspan>
            ))}
          </text>
          {visible && onNodeClick && !(scenarioStub && !isNewDemo) ? (
            <rect
              data-sg-node-hit
              width={bw}
              height={rectH}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation()
                onNodeClick(node.id)
              }}
              onPointerDown={(e) => e.stopPropagation()}
            />
          ) : null}
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
          <circle
            cx={node.x - bw / 2}
            cy={node.y}
            r={4.5}
            fill="#0a0e14"
            stroke={portStroke}
            strokeWidth={portStrokeW}
          />
          <circle
            cx={node.x + bw / 2}
            cy={node.y}
            r={4.5}
            fill="#0a0e14"
            stroke={portStroke}
            strokeWidth={portStrokeW}
          />
        </g>
      )}
      {visible && showStubCross && (
        <g className="sg-stub-cross pointer-events-none" transform={`translate(${node.x},${node.y})`}>
          <line x1="-17" y1="-17" x2="17" y2="17" stroke="#ff0f0f" strokeWidth="3.6" strokeLinecap="round" />
          <line x1="-17" y1="17" x2="17" y2="-17" stroke="#ff0f0f" strokeWidth="3.6" strokeLinecap="round" />
        </g>
      )}
    </g>
  )
})

const DETAIL_POPOVER_W = 300
const DETAIL_POPOVER_MAX_H = 228
const DETAIL_POPOVER_MAX_H_CD = 340

function NodeDetailPopover({
  node,
  layout,
  graphWidth,
  onClose,
  isNewDemo,
  title: titleOverride,
  detailOverride = null,
  detailLoading = false,
}) {
  const isScenarioGoal = /^scenario-\d+$/.test(node.id)
  const detailText = String(detailOverride ?? node.detailText ?? '').trim()
  const title = String(titleOverride ?? node.label ?? '')
  const detail =
    isScenarioGoal && detailText
      ? detailText
      : String(detailOverride ?? node.detailText ?? node.label ?? '').trim()

  const approxLines = Math.max(2, Math.ceil(detail.length / 40))
  const cap = /^cd-\d+$/.test(node.id) ? DETAIL_POPOVER_MAX_H_CD : DETAIL_POPOVER_MAX_H
  const h = Math.min(cap, Math.max(104, 56 + approxLines * 16))
  const { rectH } = layout
  const half = rectH / 2
  const spaceAbove = node.y - half
  const placeAbove = spaceAbove > h + 16
  let px = node.x - DETAIL_POPOVER_W / 2
  px = Math.max(10, Math.min(px, graphWidth - DETAIL_POPOVER_W - 10))
  const py = placeAbove ? node.y - half - h - 10 : node.y + half + 10

  const shell = isNewDemo
    ? 'border-sky-400/50 bg-slate-950/96 text-slate-50 shadow-[0_8px_28px_rgba(0,0,0,0.45)]'
    : 'border-slate-600/85 bg-[#0f1624]/98 text-slate-100 shadow-[0_10px_32px_rgba(0,0,0,0.5)]'

  return (
    <foreignObject x={px} y={py} width={DETAIL_POPOVER_W} height={h} data-sg-popover>
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        data-sg-popover
        className={`flex h-full flex-col rounded-xl border px-3 py-2 ${shell}`}
        style={{ boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-500/40 pb-2">
          <div className="min-w-0 flex-1 text-[14px] font-semibold leading-snug">{title}</div>
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-500/50 text-lg leading-none text-slate-200 hover:bg-slate-700/50"
            aria-label="Закрыть"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
          >
            ×
          </button>
        </div>
        <div
          className="mt-2 min-h-0 flex-1 overflow-y-auto text-[12.5px] leading-snug text-slate-200/95"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {detail}
        </div>
      </div>
    </foreignObject>
  )
}

function buildIncomingMap(edges) {
  const incoming = new Map()
  for (const e of edges || []) {
    if (!incoming.has(e.to)) incoming.set(e.to, [])
    incoming.get(e.to).push(e.from)
  }
  return incoming
}

function buildScenarioSummaryPayload(nodeId, nodesById, incomingMap) {
  const node = nodesById.get(nodeId)
  if (!node) return null
  const preds = incomingMap.get(nodeId) || []
  const hypIds = new Set()
  const twins = []
  for (const pid of preds) {
    if (/^hyp-\d+$/.test(pid)) {
      hypIds.add(pid)
      continue
    }
    const cd = nodesById.get(pid)
    if (cd?.cdSegment === 'hs') {
      const lbl = String(cd.label || '').trim()
      if (lbl) twins.push(lbl)
      for (const up of incomingMap.get(pid) || []) {
        if (/^hyp-\d+$/.test(up)) hypIds.add(up)
      }
    }
  }
  const hypotheses = [...hypIds]
    .map((id) => String(nodesById.get(id)?.detailText || '').trim())
    .filter(Boolean)
  return {
    scenarioLabel: String(node.label || nodeId),
    hypotheses,
    digitalTwins: [...new Set(twins)],
    baselineSummary: String(node.detailText || '').trim(),
  }
}

function ScenarioGraph({
  visibleNodeIds = new Set(),
  graphComplete = false,
  isNewDemo = false,
  isBoardLayout = false,
  graphBundle = null,
}) {
  const nodes = graphBundle?.nodes ?? scenarioGraphNodes
  const edges = graphBundle?.edges ?? scenarioGraphEdges
  const dimensions = graphBundle?.dimensions ?? scenarioGraphDimensions
  const WIDTH = dimensions.width
  const HEIGHT = dimensions.height
  const optimalEdgeKeys = graphBundle?.optimalEdgeKeys ?? optimalScenarioEdgeKeys
  const optimalNodeIds = graphBundle?.optimalNodeIds ?? optimalScenarioNodeIds
  const visualTone = graphBundle?.visualTone ?? 'default'

  const gridColor =
    visualTone === 'fcf'
      ? 'rgba(251, 191, 36, 0.085)'
      : visualTone === 'opex'
        ? 'rgba(196, 181, 253, 0.09)'
        : 'rgba(47, 180, 233, 0.08)'

  const columnBandFills = useMemo(() => {
    if (!isNewDemo) {
      return {
        b0: 'rgba(51, 65, 85, 0.09)',
        b1: 'rgba(71, 85, 105, 0.1)',
        b2: 'rgba(34, 211, 238, 0.16)',
        b3: 'rgba(16, 185, 129, 0.13)',
      }
    }
    if (visualTone === 'fcf') {
      return {
        b0: 'rgba(234, 179, 8, 0.22)',
        b1: 'rgba(251, 146, 60, 0.26)',
        b2: 'rgba(249, 115, 22, 0.3)',
        b3: 'rgba(52, 211, 153, 0.26)',
      }
    }
    if (visualTone === 'opex') {
      return {
        b0: 'rgba(99, 102, 241, 0.24)',
        b1: 'rgba(129, 140, 248, 0.26)',
        b2: 'rgba(56, 189, 248, 0.28)',
        b3: 'rgba(16, 185, 129, 0.26)',
      }
    }
    /* Полосы этапов: синий → голубой (акцент UI) → оранжевый → зелёный как на new-demo-brain */
    return {
      b0: 'rgba(0, 112, 186, 0.3)',
      b1: 'rgba(47, 180, 233, 0.28)',
      b2: 'rgba(249, 115, 22, 0.3)',
      b3: 'rgba(13, 220, 95, 0.26)',
    }
  }, [isNewDemo, visualTone])

  const palette = isNewDemo
    ? {
        startFill: 'rgba(17, 51, 83, 0.9)',
        startStroke: '#9ff8d4',
        startPort: '#9ff8d4',
        scenarioFill: 'rgba(8, 25, 44, 0.88)',
        scenarioStroke: 'rgba(125, 211, 252, 0.82)',
        scenarioPort: '#6fe8ff',
        milestoneFill: 'rgba(9, 34, 53, 0.88)',
        milestoneStroke: 'rgba(74, 222, 128, 0.85)',
        milestonePort: 'rgba(134, 239, 172, 0.92)',
        defaultFill: 'rgba(8, 24, 43, 0.88)',
        defaultStroke: 'rgba(125, 211, 252, 0.82)',
        defaultPort: '#6fe8ff',
        optimalNodeStroke: '#c6ffe9',
        optimalNodeFill: 'rgba(35, 105, 88, 0.96)',
        optimalNodePort: '#d5fff0',
        edgeGlow: 'rgba(56, 189, 248, 0.36)',
        edgeFore: 'rgba(56, 189, 248, 0.84)',
        optimalEdgeGlow: 'rgba(200, 255, 236, 0.78)',
        optimalEdgeFore: 'rgba(252, 255, 254, 1)',
        deadEdgeGlow: 'rgba(255, 40, 40, 0.95)',
        deadEdgeFore: '#ff1e1e',
        deadScenarioFill: 'rgba(55, 12, 12, 0.9)',
        deadScenarioStroke: '#ff6b6b',
        deadScenarioPort: '#fecaca',
        deadOutcomeStroke: 'rgba(248, 113, 113, 0.88)',
        deadOutcomePort: 'rgba(254, 202, 202, 0.9)',
        canvasGrid: 'rgba(47,180,233,0.08)',
        outcomeFill: 'none',
        outcomeStroke: 'rgba(148, 163, 184, 0.88)',
        outcomePort: 'rgba(203, 213, 225, 0.85)',
        controlBorder: 'border-sky-400/45',
        controlBg: 'bg-slate-900/55',
        controlText: 'text-slate-100',
      }
    : {
        startFill: '#162032',
        startStroke: '#f59e0b',
        startPort: '#fbbf24',
        scenarioFill: '#0c1222',
        scenarioStroke: '#38bdf8',
        scenarioPort: '#7dd3fc',
        milestoneFill: '#0d1f1d',
        milestoneStroke: '#34d399',
        milestonePort: '#6ee7b7',
        defaultFill: '#121826',
        defaultStroke: '#94a3b8',
        defaultPort: '#cbd5e1',
        optimalNodeStroke: '#bbf7d0',
        optimalNodeFill: '#071c12',
        optimalNodePort: '#ecfdf5',
        edgeGlow: 'rgba(56, 189, 248, 0.35)',
        edgeFore: 'rgba(56, 189, 248, 0.42)',
        optimalEdgeGlow: 'rgba(167, 243, 198, 0.75)',
        optimalEdgeFore: 'rgba(252, 255, 254, 1)',
        canvasGrid: 'rgba(51,65,85,0.07)',
        outcomeFill: 'none',
        outcomeStroke: 'rgba(148, 163, 184, 0.82)',
        outcomePort: 'rgba(203, 213, 225, 0.8)',
        controlBorder: 'border-slate-700/80',
        controlBg: 'bg-[#0a0e14]',
        controlText: 'text-slate-100',
      }
  const [openDetailIds, setOpenDetailIds] = useState(() => new Set())
  const [llmSummaryByNodeId, setLlmSummaryByNodeId] = useState(() => new Map())
  const [llmSummaryLoadingIds, setLlmSummaryLoadingIds] = useState(() => new Set())
  const [graphFullscreen, setGraphFullscreen] = useState(false)

  const openNodeDetail = useCallback((id) => {
    setOpenDetailIds((prev) => {
      const n = new Set(prev)
      n.add(id)
      return n
    })
  }, [])

  const closeNodeDetail = useCallback((id) => {
    setOpenDetailIds((prev) => {
      const n = new Set(prev)
      n.delete(id)
      return n
    })
  }, [])

  const closeAllDetails = useCallback(() => {
    setOpenDetailIds(new Set())
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (graphFullscreen) {
        e.preventDefault()
        setGraphFullscreen(false)
        return
      }
      closeAllDetails()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeAllDetails, graphFullscreen])

  useEffect(() => {
    if (!graphFullscreen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [graphFullscreen])

  const containerRef = useRef(null)
  const viewRef = useRef(null)
  const animRef = useRef(null)
  const zoomRef = useRef(0.5)
  const panRef = useRef({ x: 0, y: 0 })
  const dragRef = useRef(null)
  /** Активные указатели на графе (два пальца — pinch-zoom). */
  const pointersRef = useRef(new Map())
  const pinchLastDistRef = useRef(0)
  const prevVisibleRef = useRef(new Set(visibleNodeIds))
  const fitDebounceRef = useRef(null)
  const fullscreenFitOnceRef = useRef(false)

  const enteringNodeIds = useMemo(() => {
    const added = new Set()
    for (const id of visibleNodeIds) {
      if (!prevVisibleRef.current.has(id)) added.add(id)
    }
    return added
  }, [visibleNodeIds])

  /** Узлы, для которых уже можно показывать красный «тупик» (рёбра + зачёркивание). */
  const [revealAccentSettledIds, setRevealAccentSettledIds] = useState(() => new Set())
  /** new-demo: шаг подсветки оптимального пути от зелёных шаров к корню (гирлянда). */
  const [optimalGarlandStep, setOptimalGarlandStep] = useState(0)
  /** new-demo: шаг подсветки красной ветви от «плохих» шаров сценария к корню. */
  const [redGarlandStep, setRedGarlandStep] = useState(0)
  useEffect(() => {
    if (!isNewDemo || enteringNodeIds.size === 0 || graphComplete) return
    const timers = []
    for (const id of enteringNodeIds) {
      setRevealAccentSettledIds((prev) => {
        const n = new Set(prev)
        n.delete(id)
        return n
      })
      timers.push(
        window.setTimeout(() => {
          setRevealAccentSettledIds((prev) => {
            const n = new Set(prev)
            n.add(id)
            return n
          })
        }, REVEAL_ACCENT_DELAY_MS)
      )
    }
    return () => {
      for (const t of timers) window.clearTimeout(t)
    }
  }, [enteringNodeIds, isNewDemo, graphComplete])

  useEffect(() => {
    if (!graphComplete) return
    setRevealAccentSettledIds((prev) => {
      const n = new Set(prev)
      for (const id of visibleNodeIds) n.add(id)
      return n
    })
  }, [graphComplete, visibleNodeIds])

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
    () => nodes.filter((node) => visibleNodeIds.has(node.id)),
    [visibleNodeIds, nodes]
  )
  const visibleIds = visibleNodeIds
  const visibleEdges = useMemo(
    () => edges.filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to)),
    [visibleIds, edges]
  )

  const nodesById = useMemo(() => {
    const m = new Map()
    nodes.forEach((n) => m.set(n.id, n))
    return m
  }, [nodes])
  const incomingMap = useMemo(() => buildIncomingMap(edges), [edges])

  useEffect(() => {
    if (!isNewDemo) return
    const scenarioIds = [...openDetailIds].filter((id) => /^out-scenario-\d+$/.test(id))
    if (!scenarioIds.length) return
    let cancelled = false
    scenarioIds.forEach((id) => {
      if (llmSummaryByNodeId.has(id) || llmSummaryLoadingIds.has(id)) return
      const payload = buildScenarioSummaryPayload(id, nodesById, incomingMap)
      if (!payload) return
      setLlmSummaryLoadingIds((prev) => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
      generateScenarioSummaryDetailed(payload)
        .then((res) => {
          if (cancelled) return
          const summary = String(res?.summary || '').trim()
          if (!summary) return
          setLlmSummaryByNodeId((prev) => {
            const next = new Map(prev)
            next.set(id, summary)
            return next
          })
        })
        .catch(() => {})
        .finally(() => {
          if (cancelled) return
          setLlmSummaryLoadingIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        })
    })
    return () => {
      cancelled = true
    }
  }, [isNewDemo, openDetailIds, llmSummaryByNodeId, llmSummaryLoadingIds, nodesById, incomingMap])

  /** На new-demo первые min(3, N) итоговых сценариев — «лучшие» (зелёные), остальные шары — красные. */
  const preferredScenarioOutcomeIds = useMemo(() => {
    const outs = nodes
      .filter((n) => n.type === 'outcome' && /^out-scenario-\d+$/.test(n.id))
      .sort((a, b) => {
        const ma = /^out-scenario-(\d+)$/.exec(a.id)
        const mb = /^out-scenario-(\d+)$/.exec(b.id)
        return (ma ? parseInt(ma[1], 10) : 0) - (mb ? parseInt(mb[1], 10) : 0)
      })
    const k = Math.min(3, outs.length)
    return new Set(outs.slice(0, k).map((n) => n.id))
  }, [nodes])

  /** Предки по рёбрам: из узла вперёд можно дойти до «зелёного» шара сценария (топ‑3). */
  const reachPreferredScenarioAncestors = useMemo(() => {
    if (!isNewDemo || preferredScenarioOutcomeIds.size === 0) {
      return new Set()
    }
    const preds = new Map()
    for (const e of edges) {
      if (!preds.has(e.to)) preds.set(e.to, [])
      preds.get(e.to).push(e.from)
    }
    const s = new Set(preferredScenarioOutcomeIds)
    const q = [...preferredScenarioOutcomeIds]
    while (q.length) {
      const v = q.shift()
      for (const u of preds.get(v) || []) {
        if (s.has(u)) continue
        s.add(u)
        q.push(u)
      }
    }
    return s
  }, [isNewDemo, edges, preferredScenarioOutcomeIds])

  const optimalGarlandSequence = useMemo(
    () =>
      isNewDemo && graphComplete
        ? buildOptimalGarlandNonOutcomeSequence(
            edges,
            optimalEdgeKeys,
            optimalNodeIds,
            preferredScenarioOutcomeIds,
          )
        : [],
    [isNewDemo, graphComplete, edges, optimalEdgeKeys, optimalNodeIds, preferredScenarioOutcomeIds],
  )

  const optimalGarlandLitIds = useMemo(() => {
    const s = new Set()
    if (!isNewDemo || !graphComplete) return s
    const n = Math.min(optimalGarlandStep, optimalGarlandSequence.length)
    for (let i = 0; i < n; i++) s.add(optimalGarlandSequence[i])
    return s
  }, [isNewDemo, graphComplete, optimalGarlandStep, optimalGarlandSequence])

  /** Стабильный ключ, чтобы не сбрасывать гирлянду из‑за новой ссылки на массив при неизменном пути. */
  const optimalGarlandFingerprint = useMemo(
    () => optimalGarlandSequence.join('\x1e'),
    [optimalGarlandSequence],
  )

  useEffect(() => {
    if (!isNewDemo || !graphComplete) {
      setOptimalGarlandStep(0)
      return
    }
    const seq = optimalGarlandSequence
    const n = seq.length
    if (n === 0) {
      setOptimalGarlandStep(0)
      return
    }
    setOptimalGarlandStep(0)
    // #region agent log
    fetch('http://127.0.0.1:7689/ingest/835d33eb-bbbf-4335-a415-5b77553fca5e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'dbfff3' },
      body: JSON.stringify({
        sessionId: 'dbfff3',
        runId: 'garland',
        hypothesisId: 'H3',
        location: 'ScenarioGraph.jsx:garlandEffect',
        message: 'garland sequence init',
        data: { n, head: seq[0], tail: seq[n - 1] },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    const id = window.setInterval(() => {
      setOptimalGarlandStep((s) => {
        const next = s >= n ? n : s + 1
        // #region agent log
        fetch('http://127.0.0.1:7689/ingest/835d33eb-bbbf-4335-a415-5b77553fca5e', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'dbfff3' },
          body: JSON.stringify({
            sessionId: 'dbfff3',
            runId: 'garland',
            hypothesisId: 'H1',
            location: 'ScenarioGraph.jsx:garlandInterval',
            message: 'garland step',
            data: { prev: s, next, n },
            timestamp: Date.now(),
          }),
        }).catch(() => {})
        // #endregion
        return next
      })
    }, BRANCH_GARLAND_STEP_MS)
    return () => window.clearInterval(id)
  }, [isNewDemo, graphComplete, optimalGarlandFingerprint])

  const { hypLabelById, outLabelById } = useMemo(() => buildThinkingSequentialDisplayLabels(nodes), [nodes])

  const incomingCount = useMemo(() => {
    const c = new Map()
    for (const n of nodes) c.set(n.id, 0)
    for (const e of edges) {
      c.set(e.to, (c.get(e.to) || 0) + 1)
    }
    return c
  }, [nodes, edges])

  const boxById = useMemo(() => {
    const m = new Map()
    for (const n of nodes) {
      const display = pickDisplayLabelForNode(n, graphBundle, hypLabelById, outLabelById)
      m.set(n.id, estimateRenderedBox(n, isNewDemo, display))
    }
    return m
  }, [nodes, isNewDemo, hypLabelById, outLabelById, graphBundle])

  /** Вертикальные полосы этапов. На new-demo — см. getNewDemoThinkingBandLayout (3–4-я полосы шире, см. NEW_DEMO_LAST_TWO_BANDS_SCALE). */
  const columnBandGeometry = useMemo(() => {
    const spanH = HEIGHT * 18
    const y0 = -HEIGHT * 8
    const labelFontSize = isNewDemo ? 24 : 18.5
    let minTopAll = Infinity
    for (const n of nodes) {
      const b = boxById.get(n.id)
      if (!b) continue
      minTopAll = Math.min(minTopAll, n.y - b.h / 2)
    }
    const gapAboveNodes = isNewDemo ? 12 : 14
    const minLabelY = labelFontSize * 0.9 + 8
    const labelY = Number.isFinite(minTopAll)
      ? Math.max(minLabelY, minTopAll - gapAboveNodes)
      : (isNewDemo ? 52 : 46)
    const fitExtraTopY = labelY - labelFontSize * 1.08

    if (isNewDemo && WIDTH > 64) {
      const bl = getNewDemoThinkingBandLayout(WIDTH)
      return {
        band0x: bl.band0x,
        band0w: bl.b0w,
        band1x: bl.band1x,
        band1w: bl.b1w,
        band2x: bl.band2x,
        band2w: bl.b2w,
        band3x: bl.band3x,
        band3w: bl.b3w,
        y0,
        spanH,
        labelY,
        labelFontSize,
        fitExtraTopY,
      }
    }

    const xOf = (pred) => {
      const xs = nodes.filter((n) => pred(n.id)).map((n) => n.x)
      if (!xs.length) return null
      return xs[0]
    }
    const xMean = (pred) => {
      const xs = nodes.filter((n) => pred(n.id)).map((n) => n.x)
      if (!xs.length) return null
      return xs.reduce((a, b) => a + b, 0) / xs.length
    }
    const xUser = xOf((id) => id === 'userQuery')
    const xGoal = xMean((id) => /^scenario-\d+$/.test(id)) ?? xOf((id) => /^scenario-\d+$/.test(id))
    const xCause = xOf((id) => /^cause-\d+$/.test(id))
    const xHyp = xOf((id) => /^hyp-\d+$/.test(id))
    if (xUser == null || xGoal == null || xCause == null || xHyp == null) return null
    const band0w = Math.abs(xGoal - xUser)
    const band1w = Math.abs(xCause - xGoal)
    const band2w = Math.abs(xHyp - xCause)
    if (band0w < 4 || band1w < 4 || band2w < 4) return null

    const band0x = Math.min(xUser, xGoal)
    const band1x = Math.min(xGoal, xCause)
    const band2x = Math.min(xCause, xHyp)
    const band3x = Math.max(xHyp, xCause)
    const band3w = band2w

    return {
      band0x,
      band0w,
      band1x,
      band1w,
      band2x,
      band2w,
      band3x,
      band3w,
      y0,
      spanH,
      labelY,
      labelFontSize,
      fitExtraTopY,
    }
  }, [nodes, HEIGHT, WIDTH, isNewDemo, boxById])

  const { edgeLayouts, dualRedCauseHypIds, redGarlandSequence } = useMemo(() => {
    const isBadScenarioOutcomeId = (id) =>
      isNewDemo &&
      /^out-scenario-\d+$/.test(id) &&
      !preferredScenarioOutcomeIds.has(id)

    const badScenarioOutcomeIds = new Set()
    for (const n of nodesById.values()) {
      if (n.type === 'outcome' && /^out-scenario-\d+$/.test(n.id) && !preferredScenarioOutcomeIds.has(n.id)) {
        badScenarioOutcomeIds.add(n.id)
      }
    }
    const preds = new Map()
    for (const e of visibleEdges) {
      if (!preds.has(e.to)) preds.set(e.to, [])
      preds.get(e.to).push(e.from)
    }
    const canReachBadScenario = new Set(badScenarioOutcomeIds)
    const reachQ = [...badScenarioOutcomeIds]
    while (reachQ.length) {
      const v = reachQ.shift()
      for (const u of preds.get(v) || []) {
        if (canReachBadScenario.has(u)) continue
        canReachBadScenario.add(u)
        reachQ.push(u)
      }
    }

    const weakSemanticTargetIds = new Set()
    if (isNewDemo && graphBundle?.semanticUiChain) {
      for (const n of nodesById.values()) {
        if (
          (/^cause-\d+$/.test(n.id) || /^hyp-\d+$/.test(n.id)) &&
          n.semanticChainActive === false &&
          !reachPreferredScenarioAncestors.has(n.id)
        ) {
          weakSemanticTargetIds.add(n.id)
        }
      }
    }
    const canReachWeakSemanticStep = new Set(weakSemanticTargetIds)
    const weakReachQ = [...weakSemanticTargetIds]
    while (weakReachQ.length) {
      const v = weakReachQ.shift()
      for (const u of preds.get(v) || []) {
        if (canReachWeakSemanticStep.has(u)) continue
        canReachWeakSemanticStep.add(u)
        weakReachQ.push(u)
      }
    }

    const getEdgeBranchFlags = (edge) => {
      const from = nodesById.get(edge.from)
      const to = nodesById.get(edge.to)
      if (!from || !to) return null
      const ekey = `${edge.from}|${edge.to}`
      const feedsBadHypScenarioChain =
        isNewDemo &&
        canReachBadScenario.has(edge.to) &&
        (/^hyp-\d+$/.test(edge.from) || (from.cdSegment === 'hs' && /^cd-\d+$/.test(edge.from)))
      const feedsTowardWeakSemanticStep =
        isNewDemo &&
        Boolean(graphBundle?.semanticUiChain) &&
        canReachWeakSemanticStep.has(edge.to)
      const inOptimalClosure = graphComplete && optimalEdgeKeys.has(ekey)
      const touchesBadScenarioBall = isBadScenarioOutcomeId(edge.from) || isBadScenarioOutcomeId(edge.to)
      const isOptimalStructureEdge =
        inOptimalClosure &&
        !touchesBadScenarioBall &&
        !feedsBadHypScenarioChain &&
        !feedsTowardWeakSemanticStep
      const isDeadStubEdge =
        isNewDemo &&
        edge.from === 'userQuery' &&
        /^scenario-\d+$/.test(edge.to) &&
        !optimalNodeIds.has(edge.to)
      const strongRedEdge =
        isNewDemo &&
        !isDeadStubEdge &&
        ((graphComplete && !isOptimalStructureEdge) ||
          (!graphComplete && (feedsBadHypScenarioChain || feedsTowardWeakSemanticStep)))
      const redLogical = isDeadStubEdge || strongRedEdge
      return {
        edge,
        from,
        to,
        ekey,
        feedsBadHypScenarioChain,
        feedsTowardWeakSemanticStep,
        inOptimalClosure,
        touchesBadScenarioBall,
        isOptimalStructureEdge,
        isDeadStubEdge,
        strongRedEdge,
        redLogical,
      }
    }

    const edgeFlagRows = visibleEdges.map((edge) => getEdgeBranchFlags(edge))
    const redBranchSources = new Set()
    for (let i = 0; i < visibleEdges.length; i++) {
      const row = edgeFlagRows[i]
      if (row?.redLogical) {
        redBranchSources.add(visibleEdges[i].from)
      }
    }

    /** Исходящая степень по видимым рёбрам. */
    const visibleOutDeg = new Map()
    for (const e of visibleEdges) {
      visibleOutDeg.set(e.from, (visibleOutDeg.get(e.from) || 0) + 1)
    }
    /** Полный граф: причина/цель не считаются листом, если дальше в данных есть узлы (ещё не раскрыты на экране). */
    const fullOutDeg = new Map()
    for (const e of edges) {
      fullOutDeg.set(e.from, (fullOutDeg.get(e.from) || 0) + 1)
    }

    const redTerminalHopByIdx = visibleEdges.map((edge, idx) => {
      const row = edgeFlagRows[idx]
      if (!row) return false
      const rl = row.redLogical
      const toVis = visibleOutDeg.get(edge.to) || 0
      const toFull = fullOutDeg.get(edge.to) || 0
      const noStructuralContinuation = toVis === 0 && toFull === 0
      const isGoalNode = /^scenario-\d+$/.test(edge.to)
      return Boolean(rl && noStructuralContinuation && !isGoalNode)
    })

    /** Для топологии гирлянды: не отрезать вход в красный шар сценария (он лист, но не «обруб» ветки). */
    const redGarlandTerminalSkipByIdx = visibleEdges.map((edge, idx) => {
      if (OUT_SCENARIO_ID_RE.test(edge.to)) return false
      return redTerminalHopByIdx[idx]
    })

    const redGarlandSequence =
      isNewDemo && graphComplete
        ? buildRedGarlandNonOutcomeSequence(
            visibleEdges,
            edgeFlagRows,
            redGarlandTerminalSkipByIdx,
            canReachBadScenario,
            badScenarioOutcomeIds,
          )
        : []

    const edgeLayoutsOut = visibleEdges.map((edge, idx) => {
      const g = edgeFlagRows[idx]
      if (!g) return null
      const { from, to, isOptimalStructureEdge, isDeadStubEdge, strongRedEdge, redLogical } = g
      const fb = boxById.get(edge.from)
      const tb = boxById.get(edge.to)
      if (!fb || !tb) return null
      const d = createSmoothBezierPath(from, to, fb, tb, edge)
      const baseW = isNewDemo ? Math.max(1.2, idx % 8 === 0 ? 1.8 : 1.2) : Math.max(2.2, idx % 7 === 0 ? 2.8 : 2.2)
      const isNewEdge = enteringNodeIds.has(edge.to) && visibleNodeIds.has(edge.from)
      const redChainContinuesAtTo = Boolean(redLogical && redBranchSources.has(edge.to))
      const toFull = fullOutDeg.get(edge.to) || 0
      const redTerminalHop = redTerminalHopByIdx[idx]
      const redToBadScenarioChain =
        canReachBadScenario.has(edge.from) && canReachBadScenario.has(edge.to)
      const redGarlandEligible = Boolean(
        redLogical && !isDeadStubEdge && !redTerminalHop && redToBadScenarioChain,
      )
      return {
        d,
        key: `${edge.from}-${edge.to}-${idx}`,
        edgeFrom: edge.from,
        edgeTo: edge.to,
        toFullStructuralOut: toFull,
        isOptimalStructureEdge,
        isDeadStubEdge,
        strongRedEdge,
        redChainContinuesAtTo,
        redTerminalHop,
        redGarlandEligible,
        baseW,
        isNewEdge,
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
        taperIdx: idx,
      }
    })

    const redIncomingTo = new Set()
    const redOutgoingFrom = new Set()
    if (isNewDemo) {
      for (let i = 0; i < visibleEdges.length; i++) {
        if (!edgeFlagRows[i]?.redLogical) continue
        const e = visibleEdges[i]
        redIncomingTo.add(e.to)
        redOutgoingFrom.add(e.from)
      }
    }
    const dualRedCauseHypIds = new Set()
    if (isNewDemo) {
      for (const n of nodes) {
        const id = n.id
        if (!/^cause-\d+$/.test(id) && !/^hyp-\d+$/.test(id)) continue
        if (redIncomingTo.has(id) && redOutgoingFrom.has(id)) dualRedCauseHypIds.add(id)
      }
    }

    return { edgeLayouts: edgeLayoutsOut, dualRedCauseHypIds, redGarlandSequence }
  }, [
    visibleEdges,
    edges,
    graphComplete,
    nodesById,
    boxById,
    enteringNodeIds,
    visibleNodeIds,
    isNewDemo,
    optimalEdgeKeys,
    optimalNodeIds,
    preferredScenarioOutcomeIds,
    graphBundle,
    reachPreferredScenarioAncestors,
    nodes,
  ])

  const redGarlandLitIds = useMemo(() => {
    const s = new Set()
    if (!isNewDemo || !graphComplete) return s
    const n = Math.min(redGarlandStep, redGarlandSequence.length)
    for (let i = 0; i < n; i++) s.add(redGarlandSequence[i])
    return s
  }, [isNewDemo, graphComplete, redGarlandStep, redGarlandSequence])

  const redGarlandFingerprint = useMemo(() => redGarlandSequence.join('\x1e'), [redGarlandSequence])

  useEffect(() => {
    if (!isNewDemo || !graphComplete) {
      setRedGarlandStep(0)
      return
    }
    const seq = redGarlandSequence
    const n = seq.length
    if (n === 0) {
      setRedGarlandStep(0)
      return
    }
    setRedGarlandStep(0)
    // #region agent log
    fetch('http://127.0.0.1:7689/ingest/835d33eb-bbbf-4335-a415-5b77553fca5e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'dbfff3' },
      body: JSON.stringify({
        sessionId: 'dbfff3',
        runId: 'garland-red',
        hypothesisId: 'H4',
        location: 'ScenarioGraph.jsx:redGarlandEffect',
        message: 'red garland sequence init',
        data: { n, head: seq[0], tail: seq[n - 1] },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    const id = window.setInterval(() => {
      setRedGarlandStep((s) => {
        const next = s >= n ? n : s + 1
        // #region agent log
        fetch('http://127.0.0.1:7689/ingest/835d33eb-bbbf-4335-a415-5b77553fca5e', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'dbfff3' },
          body: JSON.stringify({
            sessionId: 'dbfff3',
            runId: 'garland-red',
            hypothesisId: 'H5',
            location: 'ScenarioGraph.jsx:redGarlandInterval',
            message: 'red garland step',
            data: { prev: s, next, n },
            timestamp: Date.now(),
          }),
        }).catch(() => {})
        // #endregion
        return next
      })
    }, BRANCH_GARLAND_STEP_MS)
    return () => window.clearInterval(id)
  }, [isNewDemo, graphComplete, redGarlandFingerprint])

  const nodeLayouts = useMemo(() => {
    const m = new Map()
    for (const node of nodes) {
      const displayLabel = pickDisplayLabelForNode(node, graphBundle, hypLabelById, outLabelById)
      if (node.type === 'outcome') {
        const estimated = estimateRenderedBox(node, isNewDemo, displayLabel)
        const { w: bw, h: rectH, lines: linesClamped, box } = estimated
        const left = node.x - bw / 2
        const top = node.y - rectH / 2
        const styles = nodeStyleByType('outcome', palette)
        const isScenarioBall = /^out-scenario-\d+$/.test(node.id)
        const isCdBall = /^cd-\d+$/.test(node.id)
        const preferredBall =
          isNewDemo && isScenarioBall && preferredScenarioOutcomeIds.has(node.id)
        const optimalLegacy = graphComplete && !isNewDemo && optimalNodeIds.has(node.id)
        const isGreenBall = preferredBall || optimalLegacy
        const isDeadScenarioBall =
          isNewDemo && isScenarioBall && !preferredScenarioOutcomeIds.has(node.id)
        let cdSemanticDead =
          isNewDemo &&
          isCdBall &&
          graphBundle?.semanticUiChain &&
          node.semanticChainActive === false
        if (cdSemanticDead && isNewDemo) {
          if (node.cdSegment === 'hs') {
            const hypUp = edges.find((e) => e.to === node.id && /^hyp-\d+$/.test(e.from))?.from
            if (hypUp && reachPreferredScenarioAncestors.has(hypUp)) cdSemanticDead = false
          } else if (node.cdSegment === 'ch' && node.cdEdgePair) {
            const m = /^(cause-\d+)-(hyp-\d+)$/.exec(String(node.cdEdgePair))
            if (
              m &&
              (reachPreferredScenarioAncestors.has(m[1]) ||
                reachPreferredScenarioAncestors.has(m[2]))
            ) {
              cdSemanticDead = false
            }
          }
        }
        const deadBallVisual = isDeadScenarioBall
        const cdDeadVisual = cdSemanticDead
        const strokeColor = isGreenBall
          ? palette.optimalNodeStroke
          : deadBallVisual || cdDeadVisual
            ? palette.deadOutcomeStroke
            : styles.stroke
        const strokeW = isGreenBall ? (isNewDemo ? 3.2 : OPT_NODE_STROKE_W) : isNewDemo ? 2.2 : 2.6
        const fillCol = 'none'
        const portStroke = isGreenBall
          ? palette.optimalNodePort
          : deadBallVisual || cdDeadVisual
            ? palette.deadOutcomePort
            : styles.port
        const portStrokeW = isGreenBall ? (isNewDemo ? 2.4 : OPT_PORT_STROKE_W) : isNewDemo ? 1.6 : 2
        const stubBreakCross = isNewDemo && (deadBallVisual || cdDeadVisual)
        m.set(node.id, {
          bw,
          rectH,
          box,
          left,
          top,
          textStartX: node.x,
          textStartY: node.y,
          linesClamped,
          catalogText: false,
          outcomeSphere: true,
          strokeColor,
          strokeW,
          fillCol,
          portStroke,
          portStrokeW,
          isOptimal: isGreenBall,
          nodeType: 'outcome',
          bodyOpacity: cdDeadVisual ? 0.42 : 1,
          stubBreakCross,
        })
        continue
      }
      const estimated = estimateRenderedBox(node, isNewDemo, displayLabel)
      const { w: bw, h: rectH, lines: linesClamped, box } = estimated
      const left = node.x - bw / 2
      const top = node.y - rectH / 2
      const iconPad = box.iconPad ?? 26
      const textStartX = iconPad + 6
      const catalog =
        isCatalogStepNode(node) && !(isNewDemo && isNewDemoPillarRectNode(node))
      const textBlockH = catalog
        ? Math.max(LINE_HEIGHT, box.fontSize * 1.35)
        : linesClamped.length * LINE_HEIGHT
      const textStartY = catalog ? rectH / 2 : rectH / 2 - textBlockH / 2 + LINE_HEIGHT * 0.72
      const styles = nodeStyleByType(node.type, palette)
      const dualRedStrong =
        isNewDemo &&
        graphComplete &&
        (/^cause-\d+$/.test(node.id) || /^hyp-\d+$/.test(node.id)) &&
        dualRedCauseHypIds.has(node.id)
      const semanticWeakRaw =
        isNewDemo &&
        graphBundle?.semanticUiChain &&
        node.semanticChainActive === false &&
        (/^cause-\d+$/.test(node.id) || /^hyp-\d+$/.test(node.id)) &&
        !reachPreferredScenarioAncestors.has(node.id)
      /** До полной сборки — не красим слабую семантику (иначе столбики красные, а рёбра ещё синие). */
      const semanticWeakVisual = semanticWeakRaw && !dualRedStrong && (!isNewDemo || graphComplete)
      const isOptimal =
        optimalNodeIds.has(node.id) &&
        !semanticWeakRaw &&
        !dualRedStrong &&
        (!isNewDemo || (graphComplete && optimalGarlandLitIds.has(node.id)))
      const isDeadStubScenario =
        isNewDemo && node.type === 'scenario' && !optimalNodeIds.has(node.id)
      const deadStubVisual = isDeadStubScenario
      /** Цель не ведёт ни к одному «зелёному» шару сценария (топ предпочтительных итогов). */
      const scenarioNoPreferredOutcome =
        isNewDemo &&
        node.type === 'scenario' &&
        preferredScenarioOutcomeIds.size > 0 &&
        !reachPreferredScenarioAncestors.has(node.id)
      const strokeColor = dualRedStrong
        ? palette.deadScenarioStroke
        : semanticWeakVisual
          ? palette.deadScenarioStroke
          : isOptimal
            ? palette.optimalNodeStroke
            : deadStubVisual
              ? palette.deadScenarioStroke
              : styles.stroke
      const strokeW = dualRedStrong
        ? isNewDemo ? 2.85 : 2.2
        : semanticWeakVisual
          ? isNewDemo ? 1.05 : 1.2
          : isOptimal ? (isNewDemo ? 3.2 : OPT_NODE_STROKE_W) : (isNewDemo ? 0.9 : 1.2)
      const fillCol = dualRedStrong
        ? palette.deadScenarioFill
        : semanticWeakVisual
          ? palette.deadScenarioFill
          : isOptimal
            ? palette.optimalNodeFill
            : deadStubVisual
              ? palette.deadScenarioFill
              : styles.fill
      const portStroke = dualRedStrong
        ? palette.deadScenarioPort
        : semanticWeakVisual
          ? palette.deadScenarioPort
          : isOptimal
            ? palette.optimalNodePort
            : deadStubVisual
              ? palette.deadScenarioPort
              : styles.port
      const portStrokeW = dualRedStrong
        ? isNewDemo ? 2.35 : 2
        : semanticWeakVisual
          ? isNewDemo ? 1.1 : 1.5
          : isOptimal ? (isNewDemo ? 2.4 : OPT_PORT_STROKE_W) : (isNewDemo ? 1.2 : 1.8)
      /** Крест сразу с красной стилизацией (без задержки revealAccentSettledIds). */
      const stubBreakCross =
        isNewDemo &&
        ((node.type === 'scenario' &&
          (Boolean(node.scenarioSlotUnused) || scenarioNoPreferredOutcome || isDeadStubScenario)) ||
          semanticWeakVisual ||
          dualRedStrong)
      m.set(node.id, {
        bw,
        rectH,
        box,
        left,
        top,
        textStartX,
        linesClamped,
        textStartY,
        catalogText: catalog,
        strokeColor,
        strokeW,
        fillCol,
        portStroke,
        portStrokeW,
        isOptimal,
        nodeType: node.type,
        bodyOpacity: dualRedStrong ? 1 : semanticWeakVisual ? 0.48 : 1,
        stubBreakCross,
      })
    }
    return m
  }, [
    graphComplete,
    isNewDemo,
    nodes,
    optimalNodeIds,
    hypLabelById,
    outLabelById,
    graphBundle,
    preferredScenarioOutcomeIds,
    reachPreferredScenarioAncestors,
    edges,
    dualRedCauseHypIds,
    optimalGarlandLitIds,
  ])

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

  /** Мгновенный зум относительно центра видимой области (та же геометрия, что у wheel). */
  const zoomAtViewBoxCenterByFactor = useCallback(
    (factor) => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current)
        animRef.current = null
      }
      if (fitDebounceRef.current) {
        clearTimeout(fitDebounceRef.current)
        fitDebounceRef.current = null
      }
      const el = containerRef.current
      const z0 = zoomRef.current
      const p0 = panRef.current
      let nz = z0 * factor
      nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(nz.toFixed(5))))
      if (!el || z0 <= 0) {
        zoomRef.current = nz
        applyViewTransform()
        return
      }
      const rect = el.getBoundingClientRect()
      const sx = (rect.width / 2 / rect.width) * WIDTH
      const sy = (rect.height / 2 / rect.height) * HEIGHT
      const wx = (sx - p0.x) / z0
      const wy = (sy - p0.y) / z0
      zoomRef.current = nz
      panRef.current = { x: sx - wx * nz, y: sy - wy * nz }
      applyViewTransform()
    },
    [applyViewTransform, WIDTH, HEIGHT]
  )

  const stageLabelFitTopY = columnBandGeometry?.fitExtraTopY ?? null

  const fitAllVisible = useCallback(() => {
    const bbox = computeBBoxForNodeIds(visibleIds, nodesById, boxById, WIDTH, HEIGHT, stageLabelFitTopY)
    const fitScale = isNewDemo ? 0.82 : 0.97
    const v = viewFromBBox(bbox, WIDTH, HEIGHT, fitScale)
    animateToView(v.zoom, v.pan)
  }, [visibleIds, nodesById, boxById, animateToView, WIDTH, HEIGHT, stageLabelFitTopY, isNewDemo])

  const fitOptimalOnly = useCallback(() => {
    const ids = [...optimalNodeIds].filter((id) => visibleIds.has(id))
    const bbox = computeBBoxForNodeIds(ids, nodesById, boxById, WIDTH, HEIGHT, stageLabelFitTopY)
    const fitScale = isNewDemo ? 0.82 : 0.97
    const v = viewFromBBox(bbox, WIDTH, HEIGHT, fitScale)
    animateToView(v.zoom, v.pan)
  }, [visibleIds, nodesById, boxById, animateToView, optimalNodeIds, WIDTH, HEIGHT, stageLabelFitTopY, isNewDemo])

  const toggleGraphFullscreen = useCallback(() => {
    setGraphFullscreen((v) => !v)
  }, [])

  useLayoutEffect(() => {
    if (!graphFullscreen) {
      fullscreenFitOnceRef.current = false
      return
    }
    if (fullscreenFitOnceRef.current) return
    fullscreenFitOnceRef.current = true
    fitAllVisible()
  }, [graphFullscreen, fitAllVisible])

  useEffect(() => {
    if (visibleIds.size === 0) return
    if (fitDebounceRef.current) clearTimeout(fitDebounceRef.current)
    fitDebounceRef.current = setTimeout(() => {
      fitDebounceRef.current = null
      const bbox = computeBBoxForNodeIds(visibleIds, nodesById, boxById, WIDTH, HEIGHT, stageLabelFitTopY)
      const fitScale = isNewDemo ? 0.82 : 0.97
      const v = viewFromBBox(bbox, WIDTH, HEIGHT, fitScale)
      animateToView(v.zoom, v.pan)
    }, FIT_DEBOUNCE_MS)
    return () => {
      if (fitDebounceRef.current) clearTimeout(fitDebounceRef.current)
    }
  }, [visibleIds, graphComplete, nodesById, boxById, animateToView, WIDTH, HEIGHT, stageLabelFitTopY, isNewDemo])

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
  }, [applyViewTransform, WIDTH, HEIGHT])

  const zoomIn = () => zoomAtViewBoxCenterByFactor(1.18)
  const zoomOut = () => zoomAtViewBoxCenterByFactor(1 / 1.18)

  return (
    <div className={graphFullscreen ? 'relative z-[90] w-full' : 'w-full'}>
      {!isBoardLayout && !graphFullscreen && (
        <h3 className={`${chrome.drawerTitle} ${chrome.drawerTitleSpaced}`}>Граф сценария</h3>
      )}
      <div
        ref={containerRef}
        className={
          graphFullscreen
            ? `fixed inset-0 z-[100] h-[100dvh] w-full cursor-grab overflow-hidden border active:cursor-grabbing ${isNewDemo ? 'border-sky-400/50' : 'border-slate-600/70'} ${isNewDemo ? 'bg-[#03182d]' : 'bg-[#0a0e14]'} rounded-none shadow-[0_0_0_1px_rgba(0,0,0,0.35)]`
            : `relative ${isBoardLayout ? 'h-[640px]' : 'h-[620px]'} w-full cursor-grab overflow-hidden rounded-2xl border active:cursor-grabbing ${isNewDemo ? 'border-sky-400/40' : 'border-slate-700/50'} ${isNewDemo ? 'bg-[#03182d]' : 'bg-[#0a0e14]'}`
        }
        style={{
          touchAction: 'none',
          backgroundImage:
            `linear-gradient(${gridColor} 1px, transparent 1px), linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`,
          backgroundSize: '28px 28px',
        }}
        onPointerDown={(e) => {
          if (e.target.closest('[data-sg-control]')) return
          if (e.target.closest('[data-sg-node-hit]')) return
          if (e.target.closest('[data-sg-popover]')) return
          const el = e.currentTarget
          const rect = el.getBoundingClientRect()
          const willBeSecondFinger = pointersRef.current.size === 1
          if (!willBeSecondFinger && e.button !== 0) return
          pointersRef.current.set(e.pointerId, {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            clientX: e.clientX,
            clientY: e.clientY,
          })
          if (pointersRef.current.size >= 2) {
            dragRef.current = null
            const pair = twoFingerMidAndDistFromPointerMap(pointersRef.current)
            if (pair) pinchLastDistRef.current = pair.dist
            el.setPointerCapture(e.pointerId)
            return
          }
          el.setPointerCapture(e.pointerId)
          dragRef.current = {
            sx: e.clientX,
            sy: e.clientY,
            px: panRef.current.x,
            py: panRef.current.y,
          }
        }}
        onPointerMove={(e) => {
          const el = e.currentTarget
          const rect = el.getBoundingClientRect()
          if (pointersRef.current.has(e.pointerId)) {
            pointersRef.current.set(e.pointerId, {
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
              clientX: e.clientX,
              clientY: e.clientY,
            })
          }
          if (pointersRef.current.size >= 2) {
            const pair = twoFingerMidAndDistFromPointerMap(pointersRef.current)
            if (!pair || pinchLastDistRef.current <= 0) return
            const ratio = pair.dist / pinchLastDistRef.current
            let nz = zoomRef.current * ratio
            nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(nz.toFixed(5))))
            const sx = (pair.midX / rect.width) * WIDTH
            const sy = (pair.midY / rect.height) * HEIGHT
            const z0 = zoomRef.current
            const p0 = panRef.current
            const wx = (sx - p0.x) / z0
            const wy = (sy - p0.y) / z0
            zoomRef.current = nz
            panRef.current = { x: sx - wx * nz, y: sy - wy * nz }
            pinchLastDistRef.current = pair.dist
            applyViewTransform()
            return
          }
          if (!dragRef.current) return
          panRef.current = {
            x: e.clientX - dragRef.current.sx + dragRef.current.px,
            y: e.clientY - dragRef.current.sy + dragRef.current.py,
          }
          applyViewTransform()
        }}
        onPointerUp={(e) => {
          const el = e.currentTarget
          if (el.hasPointerCapture(e.pointerId)) {
            el.releasePointerCapture(e.pointerId)
          }
          pointersRef.current.delete(e.pointerId)
          if (pointersRef.current.size === 1) {
            const pt = [...pointersRef.current.values()][0]
            dragRef.current = {
              sx: pt.clientX,
              sy: pt.clientY,
              px: panRef.current.x,
              py: panRef.current.y,
            }
          } else if (pointersRef.current.size === 0) {
            dragRef.current = null
          }
          if (pointersRef.current.size < 2) pinchLastDistRef.current = 0
        }}
        onPointerCancel={(e) => {
          const el = e.currentTarget
          if (el.hasPointerCapture(e.pointerId)) {
            el.releasePointerCapture(e.pointerId)
          }
          pointersRef.current.delete(e.pointerId)
          if (pointersRef.current.size === 1) {
            const pt = [...pointersRef.current.values()][0]
            dragRef.current = {
              sx: pt.clientX,
              sy: pt.clientY,
              px: panRef.current.x,
              py: panRef.current.y,
            }
          } else if (pointersRef.current.size === 0) {
            dragRef.current = null
          }
          if (pointersRef.current.size < 2) pinchLastDistRef.current = 0
        }}
      >
        {isNewDemo && (
          <div
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              background:
                visualTone === 'fcf'
                  ? 'radial-gradient(120% 90% at 52% 48%, rgba(180, 83, 9, 0.2) 0%, rgba(55, 28, 6, 0.2) 52%, rgba(18, 10, 4, 0.08) 100%), radial-gradient(65% 45% at 48% 52%, rgba(251, 191, 36, 0.14) 0%, rgba(251, 191, 36, 0.04) 60%, rgba(251, 191, 36, 0) 100%)'
                  : visualTone === 'opex'
                    ? 'radial-gradient(120% 90% at 55% 52%, rgba(109, 40, 217, 0.16) 0%, rgba(30, 15, 55, 0.2) 52%, rgba(8, 6, 22, 0.08) 100%), radial-gradient(65% 45% at 50% 50%, rgba(167, 139, 250, 0.14) 0%, rgba(167, 139, 250, 0.04) 60%, rgba(167, 139, 250, 0) 100%)'
                    : 'radial-gradient(120% 90% at 55% 52%, rgba(25, 110, 186, 0.18) 0%, rgba(5, 33, 66, 0.18) 52%, rgba(3, 18, 37, 0.08) 100%), radial-gradient(65% 45% at 50% 50%, rgba(51, 181, 255, 0.12) 0%, rgba(51, 181, 255, 0.03) 60%, rgba(51, 181, 255, 0) 100%)',
            }}
          />
        )}
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
                  filter: drop-shadow(0 0 1.5px rgba(252, 255, 254, 0.98))
                    drop-shadow(0 0 5px rgba(167, 243, 198, 0.92))
                    drop-shadow(0 0 14px rgba(52, 211, 153, 0.55));
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
                  animation: sg-edge-draw 0.72s ease-out forwards;
                }
                @keyframes sg-stub-cross-blink {
                  0%, 100% {
                    opacity: 1;
                    filter: drop-shadow(0 0 8px rgba(255, 30, 30, 0.95));
                  }
                  50% {
                    opacity: 0.38;
                    filter: drop-shadow(0 0 3px rgba(255, 30, 30, 0.55));
                  }
                }
                .sg-stub-cross {
                  animation: sg-stub-cross-blink 0.82s ease-in-out infinite;
                }
              `}
            </style>
          </defs>
          <g ref={viewRef}>
            <rect
              width={WIDTH}
              height={HEIGHT}
              fill="transparent"
              style={{ pointerEvents: 'auto' }}
              onPointerDown={closeAllDetails}
            />
            {columnBandGeometry ? (
              <g className="pointer-events-none" aria-hidden="true">
                <rect
                  x={columnBandGeometry.band0x}
                  y={columnBandGeometry.y0}
                  width={columnBandGeometry.band0w}
                  height={columnBandGeometry.spanH}
                  fill={columnBandFills.b0}
                />
                <rect
                  x={columnBandGeometry.band1x}
                  y={columnBandGeometry.y0}
                  width={columnBandGeometry.band1w}
                  height={columnBandGeometry.spanH}
                  fill={columnBandFills.b1}
                />
                <rect
                  x={columnBandGeometry.band2x}
                  y={columnBandGeometry.y0}
                  width={columnBandGeometry.band2w}
                  height={columnBandGeometry.spanH}
                  fill={columnBandFills.b2}
                />
                <rect
                  x={columnBandGeometry.band3x}
                  y={columnBandGeometry.y0}
                  width={columnBandGeometry.band3w}
                  height={columnBandGeometry.spanH}
                  fill={columnBandFills.b3}
                />
                {THINKING_STAGE_BAND_LABELS.map((stageLabel, idx) => {
                  const g = columnBandGeometry
                  const bx = [g.band0x, g.band1x, g.band2x, g.band3x][idx]
                  const bw = [g.band0w, g.band1w, g.band2w, g.band3w][idx]
                  const cx = bx + bw / 2
                  return (
                    <text
                      key={stageLabel}
                      x={cx}
                      y={g.labelY}
                      textAnchor="middle"
                      fill={isNewDemo ? 'rgba(248, 250, 252, 0.98)' : 'rgba(241, 245, 249, 0.98)'}
                      fontSize={g.labelFontSize}
                      fontWeight={700}
                    >
                      {stageLabel}
                    </text>
                  )
                })}
              </g>
            ) : null}
            <g className="pointer-events-none">
              {edgeLayouts.map((item) => {
                if (!item) return null
                const {
                  d,
                  key,
                  edgeFrom,
                  edgeTo,
                  toFullStructuralOut,
                  isOptimalStructureEdge,
                  isDeadStubEdge,
                  strongRedEdge,
                  redChainContinuesAtTo,
                  redTerminalHop,
                  redGarlandEligible,
                  baseW,
                  isNewEdge,
                  fromX,
                  fromY,
                  toX,
                  toY,
                  taperIdx,
                } = item
                const garlandEndpointLit = (id) =>
                  optimalGarlandLitIds.has(id) ||
                  (OUT_SCENARIO_ID_RE.test(id) && preferredScenarioOutcomeIds.has(id))
                const isOptimalEdgeVisual =
                  isOptimalStructureEdge &&
                  (!isNewDemo || (garlandEndpointLit(edgeFrom) && garlandEndpointLit(edgeTo)))
                const useDraw = isNewEdge && !isOptimalEdgeVisual
                const redLogical = isDeadStubEdge || strongRedEdge
                const redGarlandEndpointLit = (id) =>
                  redGarlandLitIds.has(id) ||
                  (OUT_SCENARIO_ID_RE.test(id) && !preferredScenarioOutcomeIds.has(id))
                const redAccentGate = !(isNewDemo && useDraw && !revealAccentSettledIds.has(edgeTo))
                /**
                 * Пока граф строится — не красим обычные «сценарные» ветки (strongRed до complete),
                 * иначе красный → сброс при complete → гирлянда. Тупик user→цель и redTerminalHop — сразу.
                 */
                const suppressRedDuringIncompleteBuild =
                  isNewDemo && !graphComplete && !isDeadStubEdge && !redTerminalHop
                const useRedGarlandStaging =
                  isNewDemo &&
                  graphComplete &&
                  redGarlandEligible &&
                  redGarlandSequence.length > 0
                const redShownVisual =
                  redLogical &&
                  !suppressRedDuringIncompleteBuild &&
                  (useRedGarlandStaging
                    ? redGarlandEndpointLit(edgeFrom) && redGarlandEndpointLit(edgeTo) && redAccentGate
                    : graphComplete || !redGarlandEligible || !isNewDemo
                      ? redAccentGate
                      : false)
                const deadRedBoost = isNewDemo && redShownVisual
                const stripRedTaperMask =
                  deadRedBoost &&
                  toFullStructuralOut > 0 &&
                  (/^scenario-\d+$/.test(edgeTo) || /^cause-\d+$/.test(edgeTo))
                const junctionDampen = deadRedBoost && redTerminalHop
                const glowStroke = isOptimalEdgeVisual
                  ? palette.optimalEdgeGlow
                  : redShownVisual
                    ? palette.deadEdgeGlow
                    : palette.edgeGlow
                const foreStroke = isOptimalEdgeVisual
                  ? palette.optimalEdgeFore
                  : redShownVisual
                    ? palette.deadEdgeFore
                    : palette.edgeFore
                const glowW = isOptimalEdgeVisual
                  ? Math.max(OPT_EDGE_GLOW_W, baseW * 1.75 + 4)
                  : deadRedBoost
                    ? junctionDampen
                      ? Math.max(4, baseW * 1.12)
                      : Math.max(8, baseW * 2.6)
                    : baseW
                const foreW = isOptimalEdgeVisual
                  ? OPT_EDGE_FORE_W
                  : deadRedBoost
                    ? junctionDampen
                      ? Math.max(1.2, baseW * 0.46)
                      : Math.max(2, baseW * 0.88)
                    : baseW * 0.55
                const taperMaskId =
                  deadRedBoost && !stripRedTaperMask ? `sg-red-taper-mask-${taperIdx}` : null
                const taperGradId =
                  deadRedBoost && !stripRedTaperMask ? `sg-red-taper-grad-${taperIdx}` : null
                return (
                  <g key={key}>
                    {deadRedBoost && !stripRedTaperMask ? (
                      <defs>
                        <linearGradient
                          id={taperGradId}
                          gradientUnits="userSpaceOnUse"
                          x1={fromX}
                          y1={fromY}
                          x2={toX}
                          y2={toY}
                        >
                          {redTerminalHop ? (
                            <>
                              <stop offset="0%" stopColor="white" stopOpacity="1" />
                              <stop offset="28%" stopColor="white" stopOpacity="1" />
                              <stop offset="55%" stopColor="white" stopOpacity="0.5" />
                              <stop offset="78%" stopColor="white" stopOpacity="0.16" />
                              <stop offset="100%" stopColor="white" stopOpacity="0" />
                            </>
                          ) : redChainContinuesAtTo ? (
                            <>
                              <stop offset="0%" stopColor="white" stopOpacity="1" />
                              <stop offset="72%" stopColor="white" stopOpacity="1" />
                              <stop offset="88%" stopColor="white" stopOpacity="0.52" />
                              <stop offset="100%" stopColor="white" stopOpacity="0.18" />
                            </>
                          ) : (
                            <>
                              <stop offset="0%" stopColor="white" stopOpacity="0.12" />
                              <stop offset="34%" stopColor="white" stopOpacity="0.68" />
                              <stop offset="66%" stopColor="white" stopOpacity="0.68" />
                              <stop offset="100%" stopColor="white" stopOpacity="0.12" />
                            </>
                          )}
                        </linearGradient>
                        <mask id={taperMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width={WIDTH} height={HEIGHT}>
                          <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill={`url(#${taperGradId})`} />
                        </mask>
                      </defs>
                    ) : null}
                    <path
                      d={d}
                      fill="none"
                      stroke={glowStroke}
                      strokeWidth={glowW}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      pathLength={useDraw ? 1 : undefined}
                      className={useDraw ? 'sg-edge-draw-in' : undefined}
                      mask={taperMaskId ? `url(#${taperMaskId})` : undefined}
                    />
                    <path
                      d={d}
                      fill="none"
                      stroke={foreStroke}
                      strokeWidth={foreW}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      pathLength={useDraw ? 1 : undefined}
                      strokeDasharray={isOptimalEdgeVisual ? '11 30' : undefined}
                      className={isOptimalEdgeVisual ? 'sg-opt-flow' : useDraw ? 'sg-edge-draw-in' : undefined}
                      mask={taperMaskId ? `url(#${taperMaskId})` : undefined}
                    />
                  </g>
                )
              })}
            </g>

            {nodes.map((node) => {
              const visible = visibleIds.has(node.id)
              const layout = nodeLayouts.get(node.id)
              if (!layout) return null
              const inc = incomingCount.get(node.id) || 0
              if (node.type === 'outcome') {
                return (
                  <OutcomeBallNode
                    key={node.id}
                    node={node}
                    visible={visible}
                    layout={layout}
                    isEntering={enteringNodeIds.has(node.id)}
                    isNewDemo={isNewDemo}
                    onNodeClick={openNodeDetail}
                  />
                )
              }
              return (
                <GraphNode
                  key={node.id}
                  node={node}
                  visible={visible}
                  layout={layout}
                  inc={inc}
                  isEntering={enteringNodeIds.has(node.id)}
                  isNewDemo={isNewDemo}
                  onNodeClick={openNodeDetail}
                />
              )
            })}
            {[...openDetailIds].map((id) => {
              const node = nodesById.get(id)
              const layout = nodeLayouts.get(id)
              if (!node || !layout) return null
              const popoverTitle =
                id === 'userQuery'
                  ? 'Пользовательский запрос'
                  : /^cd-\d+$/.test(id) && String(node.label ?? '').trim()
                    ? formatDigitalTwinPopoverTitle(node.label)
                    : String(node.label ?? '').trim() ||
                      (hypLabelById.get(id) ??
                        outLabelById.get(id) ??
                        layout.linesClamped?.[0] ??
                        '')
              return (
                <NodeDetailPopover
                  key={`detail-${id}`}
                  node={node}
                  layout={layout}
                  graphWidth={WIDTH}
                  isNewDemo={isNewDemo}
                  title={popoverTitle}
                  detailOverride={llmSummaryByNodeId.get(id) ?? null}
                  detailLoading={llmSummaryLoadingIds.has(id)}
                  onClose={() => closeNodeDetail(id)}
                />
              )
            })}
          </g>
        </svg>

        <div
          className="absolute top-3 right-3 z-10"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            data-sg-control
            className={`flex h-10 w-10 items-center justify-center rounded-lg border shadow-none transition-colors hover:bg-slate-900/60 active:bg-slate-800/60 ${palette.controlBorder} ${palette.controlBg} ${palette.controlText}`}
            aria-label={graphFullscreen ? 'Свернуть граф' : 'Развернуть граф на весь экран'}
            title={graphFullscreen ? 'Свернуть' : 'На весь экран'}
            onClick={toggleGraphFullscreen}
          >
            {graphFullscreen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 14v4h4" />
                <path d="M20 10V6h-4" />
                <path d="M14 20h4v-4" />
                <path d="M10 4H6v4" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                <path d="M16 3h3a2 2 0 0 1 2 2v3" />
                <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
                <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            )}
          </button>
        </div>

        <div className="absolute bottom-3 right-3 z-10 grid grid-cols-2 gap-2" onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            data-sg-control
            className={`flex h-10 w-10 items-center justify-center rounded-lg border shadow-none transition-colors hover:bg-slate-900/60 active:bg-slate-800/60 ${palette.controlBorder} ${palette.controlBg} ${palette.controlText}`}
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
            className={`flex h-10 w-10 items-center justify-center rounded-lg border shadow-none transition-colors hover:bg-slate-900/60 active:bg-slate-800/60 ${palette.controlBorder} ${palette.controlBg} ${palette.controlText}`}
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
            className={`flex h-10 w-10 items-center justify-center rounded-lg border shadow-none transition-colors hover:bg-slate-900/60 active:bg-slate-800/60 ${palette.controlBorder} ${palette.controlBg} ${palette.controlText}`}
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
            className={`flex h-10 w-10 items-center justify-center rounded-lg border shadow-none transition-colors hover:bg-slate-900/60 active:bg-slate-800/60 ${isNewDemo ? "border-orange-500/60 text-orange-300 bg-slate-900/55" : "border-emerald-700/50 bg-[#0a0e14] text-emerald-300"}`}
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
