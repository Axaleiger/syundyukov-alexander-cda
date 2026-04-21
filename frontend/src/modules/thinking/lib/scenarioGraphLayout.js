/**
 * Раскладка графа «мышление»: детерминированная сетка (колонки, ровные шаги по Y).
 * Для графа с узлом generation — прежняя схема веера + d3-симуляция.
 */

import { forceSimulation, forceCollide, forceManyBody } from 'd3-force'

const FAN_RADIUS = 138
const FAN_KX = 1.72
const FAN_KY = 0.48
const FAN_SPREAD_FACTOR = 0.72

const MERGE_STEP_X = 198
const CHAIN_STEP_X = 228

const POST_Y_DAMP = 0.74

/** Сетка без generation: шаги по вертикали и горизонтали между колонками (растянуто под читаемость) */
const GRID_TOP = 210
const GRID_CAUSE_DY = 310
/** Одинаковая ширина «колонок» между центрами: user → goals → causes → hyp → зона сценариев */
export const THINKING_GRID_COL_SPAN = 400
const GRID_X_USER = 200
const GRID_X_GOAL = GRID_X_USER + THINKING_GRID_COL_SPAN
const GRID_X_CAUSE = GRID_X_GOAL + THINKING_GRID_COL_SPAN
const GRID_X_HYP = GRID_X_CAUSE + THINKING_GRID_COL_SPAN
const GRID_HYP_DY = 310
/** Зона шаров сценариев справа от гипотез — расширена, чтобы шары реже налезали друг на друга */
const GRID_BALL_ZONE_W = THINKING_GRID_COL_SPAN * 1.55
const GRID_BALL_PAD_XL = 88
const GRID_BALL_PAD_XR = 72
const GRID_BALL_X_EXTRA = THINKING_GRID_COL_SPAN * 0.35

/** Вертикальные оси столбиков — по середине между «якорями» этапов (шов цветных полос). */
export function getThinkingGridPillarSeamXs() {
	const ballZoneInnerLeft = GRID_X_HYP + GRID_BALL_PAD_XL - GRID_BALL_X_EXTRA * 0.2
	return {
		xUser: (GRID_X_USER + GRID_X_GOAL) / 2,
		xGoal: (GRID_X_GOAL + GRID_X_CAUSE) / 2,
		xCause: (GRID_X_CAUSE + GRID_X_HYP) / 2,
		xHyp: (GRID_X_HYP + ballZoneInnerLeft) / 2,
		ballZoneInnerLeft,
	}
}

/** Ширина столбика new-demo — как `NEW_DEMO_PILLAR_BOX.w` в ScenarioGraph.jsx */
const NEW_DEMO_THINKING_PILLAR_W = 132

/**
 * Насколько шире (вместе) две последние полосы относительно базы 1/3+1/3 при фиксированных первых двух 1/6+1/6.
 * N=1 — как раньше (1/6,1/6,1/3,1/3); N>1 — 3–4-я полосы шире, доли 1–2-х пересчитаны так, чтобы сумма = W.
 */
export const NEW_DEMO_LAST_TWO_BANDS_SCALE = 1.28

/**
 * Полосы new-demo: первые две узкие доли f0, 3–4-я — одинаковые f2 = N/(1+2N) каждая.
 */
export function getNewDemoThinkingBandLayout(W, lastTwoScale = NEW_DEMO_LAST_TWO_BANDS_SCALE) {
	const width = Math.max(Number(W) || 0, 64)
	const N = Math.max(1, Number(lastTwoScale) || 1)
	const denom = 1 + 2 * N
	const f0 = 0.5 / denom
	const f2 = N / denom
	const b0w = width * f0
	const b1w = width * f0
	const b2w = width * f2
	const b3w = width * f2
	const band1x = b0w
	const band2x = b0w + b1w
	const band3x = band2x + b2w
	return {
		width,
		b0w,
		b1w,
		b2w,
		b3w,
		band0x: 0,
		band1x,
		band2x,
		band3x,
		seamGoal: b0w,
		seamCause: band2x,
		seamHyp: band3x,
	}
}

/**
 * Центры прямоугольных нод на вертикалях границ полос new-demo (см. getNewDemoThinkingBandLayout).
 */
export function getBandBoundaryPillarXs(viewWidth) {
	const W = Math.max(Number(viewWidth) || 0, 16)
	const { seamGoal, seamCause, seamHyp, b0w } = getNewDemoThinkingBandLayout(W)
	const halfPillar = NEW_DEMO_THINKING_PILLAR_W / 2
	/** Ось на x=0; если первая полоса слишком узкая — центр внутри неё. */
	const xUser = b0w < halfPillar + 8 ? Math.round(b0w / 2) : 0
	return {
		xUser,
		xGoal: Math.round(seamGoal),
		xCause: Math.round(seamCause),
		xHyp: Math.round(seamHyp),
		bandW: b0w,
	}
}

function hashGraphStr(id) {
	let h = 2166136261 >>> 0
	for (let i = 0; i < id.length; i++) {
		h ^= id.charCodeAt(i)
		h = Math.imul(h, 16777619)
	}
	return h >>> 0
}

/** Детерминированное [0,1) от строки и соли (стабильная «случайность» без Math.random). */
function u01FromSeed(seed) {
	const x = Math.sin(seed * 12.9898) * 43758.5453123
	return x - Math.floor(x)
}

function approxRadius(node) {
  if (/^cd-\d+$/.test(node.id)) return 34
  if (node.id === 'userQuery') return 66
  const t = node.type
  if (t === 'start') return 104
  if (t === 'scenario') return 86
  if (t === 'milestone') return 96
  if (t === 'outcome') return 64
  return 84
}

/** Радиус прямоугольного столбика для отталкивания шаров сценариев (new-demo, с запасом по диагонали). */
function pillarRadiusForScenarioBallRepel(node) {
  if (node.id === 'userQuery') return 100
  if (/^scenario-\d+$/.test(node.id)) return 108
  if (/^cause-\d+$/.test(node.id) || /^hyp-\d+$/.test(node.id)) return 104
  return approxRadius(node)
}

const SCENARIO_OUTCOME_BALL_CLEARANCE_R = 52

/**
 * Дополнительно отодвигает шары out-scenario-* от столбиков и ЦД (после релакса/сдвигов ЦД).
 */
export function repelScenarioOutcomeBallsAwayFromGraphNodes(nodes, { passes = 44 } = {}) {
  const balls = nodes.filter((n) => n.type === 'outcome' && /^out-scenario-\d+$/.test(n.id))
  if (!balls.length) return
  const pillarBodies = nodes.filter(
    (n) =>
      n.id === 'userQuery' ||
      /^scenario-\d+$/.test(n.id) ||
      /^cause-\d+$/.test(n.id) ||
      /^hyp-\d+$/.test(n.id),
  )
  const cdNodes = nodes.filter((n) => /^cd-\d+$/.test(n.id))
  const ballR = SCENARIO_OUTCOME_BALL_CLEARANCE_R
  for (let p = 0; p < passes; p++) {
    for (const b of balls) {
      for (const pl of pillarBodies) {
        const pr = pillarRadiusForScenarioBallRepel(pl)
        const dx = b.x - pl.x
        const dy = b.y - pl.y
        const d = Math.hypot(dx, dy) || 1
        const need = pr + ballR + 44 - d
        if (need <= 0) continue
        const ux = dx / d
        const uy = dy / d
        b.x += ux * need
        b.y += uy * need
      }
      for (const cd of cdNodes) {
        const cr = approxRadius(cd) + 10
        const dx = b.x - cd.x
        const dy = b.y - cd.y
        const d = Math.hypot(dx, dy) || 1
        const need = cr + ballR + 40 - d
        if (need <= 0) continue
        const ux = dx / d
        const uy = dy / d
        b.x += ux * need
        b.y += uy * need
      }
    }
  }
  for (const b of balls) {
    b.x = Math.round(b.x)
    b.y = Math.round(b.y)
  }
}

/** Жёсткие горизонтальные границы семантической сетки мышления (до normalizeGraphBounds). */
export function getSemanticThinkingLayoutXBounds() {
  return {
    minX: GRID_X_USER - THINKING_GRID_COL_SPAN * 0.4,
    maxX: GRID_X_HYP + GRID_BALL_ZONE_W + GRID_BALL_X_EXTRA + THINKING_GRID_COL_SPAN * 0.22,
  }
}

export function clampSemanticNodesToThinkingXBounds(nodes, pad = 34) {
  const { minX, maxX } = getSemanticThinkingLayoutXBounds()
  const lo = minX + pad
  const hi = maxX - pad
  for (const n of nodes) {
    /** Прямоугольные столбики — только `pinThinkingGridPillarSeamXs` по ширине полос. */
    if (n.id === 'userQuery' || /^scenario-\d+$/.test(n.id) || /^cause-\d+$/.test(n.id) || /^hyp-\d+$/.test(n.id)) {
      continue
    }
    n.x = Math.round(Math.min(hi, Math.max(lo, n.x)))
  }
}

/**
 * Узлы ЦД не заходят на столбики и на шары сценариев (out-scenario-*).
 */
export function repelCdNodesFromPillarBodies(nodes, { passes = 16, margin = 52 } = {}) {
  const cds = nodes.filter((n) => /^cd-\d+$/.test(n.id))
  if (!cds.length) return
  const obstacles = nodes.filter(
    (n) =>
      n.id === 'userQuery' ||
      /^scenario-\d+$/.test(n.id) ||
      /^cause-\d+$/.test(n.id) ||
      /^hyp-\d+$/.test(n.id) ||
      (n.type === 'outcome' && /^out-scenario-\d+$/.test(n.id)),
  )
  if (!obstacles.length) return
  for (let p = 0; p < passes; p++) {
    for (const cd of cds) {
      const cr = approxRadius(cd)
      for (const pl of obstacles) {
        const pr = approxRadius(pl)
        const dx = cd.x - pl.x
        const dy = cd.y - pl.y
        const d = Math.hypot(dx, dy) || 1
        const need = pr + cr + margin - d
        if (need <= 0) continue
        const ux = dx / d
        const uy = dy / d
        cd.x += ux * need * 0.72
        cd.y += uy * need * 0.72
      }
    }
  }
  for (const cd of cds) {
    cd.x = Math.round(cd.x)
    cd.y = Math.round(cd.y)
  }
}

/** Не выводить центры узлов за пределы цветных полос этапов (горизонтально). */
export function clampThinkingGridNodesIntoStageBands(nodes) {
  const seam = getThinkingGridPillarSeamXs()
  const xBallHi =
    GRID_X_HYP + GRID_BALL_ZONE_W - GRID_BALL_PAD_XR + GRID_BALL_X_EXTRA - 40
  const pad = 8
  const clampX = (n, lo, hi) => {
    n.x = Math.round(Math.min(hi - pad, Math.max(lo + pad, n.x)))
  }
  for (const n of nodes) {
    /** Столбики выравниваются только `pinThinkingGridPillarSeamXs`, иначе relax даёт разный X у hyp-*. */
    if (n.id === 'userQuery' || /^scenario-\d+$/.test(n.id) || /^cause-\d+$/.test(n.id) || /^hyp-\d+$/.test(n.id)) {
      continue
    }
    if (/^cd-\d+$/.test(n.id)) {
      /** Позиция ЦД задаётся `nudgeCdNodesIntoEqualStageBands` под равные полосы. */
      continue
    }
    if (n.type === 'outcome' && /^out-scenario-\d+$/.test(n.id)) {
      clampX(n, seam.ballZoneInnerLeft, xBallHi + 40)
    }
  }
}

/**
 * Круглые узлы ЦД — внутри своего цветового этапа (равные четверти ширины холста), не на границе полос.
 * ch → этап «Формирование гипотез» (3-я четверть), hs → «Моделирование сценариев» (4-я).
 */
export function nudgeCdNodesIntoEqualStageBands(nodes, viewWidth, { margin = 18 } = {}) {
  if (!viewWidth || viewWidth < 200) return
  const { band2x, band3x, width: W } = getNewDemoThinkingBandLayout(viewWidth)
  const cdR = 40
  const hashId = (id) => {
    let hh = 2166136261 >>> 0
    const s = String(id)
    for (let i = 0; i < s.length; i++) {
      hh ^= s.charCodeAt(i)
      hh = Math.imul(hh, 16777619)
    }
    return hh >>> 0
  }
  const u01 = (seed) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453123
    return x - Math.floor(x)
  }
  for (const n of nodes) {
    if (!/^cd-\d+$/.test(n.id)) continue
    /** hs-цепочки позиционируются между hyp и шаром сценария (`layoutTwinChains`), не по полосам. */
    if (n.cdSegment === 'hs') continue
    const h = hashId(n.id)
    if (n.cdSegment === 'ch') {
      const lo = band2x + Math.max(margin, cdR)
      const hi = band3x - Math.max(margin, cdR)
      if (hi > lo) n.x = Math.round(lo + (hi - lo) * (0.04 + u01(h ^ 0x33a2) * 0.92))
    }
    n.y = Math.round(n.y)
  }
  for (const n of nodes) {
    if (!/^cd-\d+$/.test(n.id)) continue
    if (n.cdSegment === 'hs') continue
    if (n.cdSegment === 'ch') {
      const lo = band2x + cdR
      const hi = band3x - cdR
      n.x = Math.round(Math.min(hi, Math.max(lo, n.x)))
    }
  }
}

/**
 * Строго фиксирует центр X прямоугольных столбиков на вертикалях границ цветных зон.
 * Если передан `viewWidth` (ширина viewBox после normalize) — совпадает с четвертями полос в UI.
 * Иначе — прежняя сетка по GRID (fallback).
 */
export function pinThinkingGridPillarSeamXs(
  nodes,
  { viewWidth = null, scenarioJitterMax = null, edgeInset: _edgeInset = 52 } = {},
) {
  const useBands = viewWidth != null && viewWidth > 128
  const seam = useBands
    ? getBandBoundaryPillarXs(viewWidth)
    : getThinkingGridPillarSeamXs()
  const jMax =
    scenarioJitterMax != null
      ? scenarioJitterMax
      : useBands
        ? 0
        : 18
  for (const n of nodes) {
    if (n.id === 'userQuery') {
      n.x = Math.round(seam.xUser)
      continue
    }
    if (/^scenario-\d+$/.test(n.id)) {
      const raw = n.x - seam.xGoal
      const j = Math.max(-jMax, Math.min(jMax, Math.round(raw)))
      n.x = Math.round(seam.xGoal + j)
      continue
    }
    if (/^cause-\d+$/.test(n.id)) {
      n.x = Math.round(seam.xCause)
      continue
    }
    if (/^hyp-\d+$/.test(n.id)) {
      n.x = Math.round(seam.xHyp)
      continue
    }
  }
}

function vecFromSegmentToPoint(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay
  const abLen2 = abx * abx + aby * aby || 1
  let t = (apx * abx + apy * aby) / abLen2
  t = Math.max(0, Math.min(1, t))
  const qx = ax + t * abx
  const qy = ay + t * aby
  const dx = px - qx
  const dy = py - qy
  const dist = Math.hypot(dx, dy) || 1e-6
  return { dist, nx: dx / dist, ny: dy / dist }
}

/**
 * Отталкивание узлов от хорд рёбер (приближение к дуге Безье), чтобы шары ЦД реже пересекали линии.
 */
export function repelNodesFromChordEdges(nodes, edges, { passes = 8, minClear = 36, strength = 0.62 } = {}) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const list = [...nodes]
  for (let p = 0; p < passes; p++) {
    for (const e of edges) {
      const A = byId.get(e.from)
      const B = byId.get(e.to)
      if (!A || !B) continue
      for (const n of list) {
        if (n.id === e.from || n.id === e.to) continue
        const r = approxRadius(n)
        const { dist, nx, ny } = vecFromSegmentToPoint(n.x, n.y, A.x, A.y, B.x, B.y)
        const need = minClear + r - dist
        if (need <= 0) continue
        n.x += nx * need * strength
        n.y += ny * need * strength
      }
    }
  }
  for (const n of list) {
    n.x = Math.round(n.x)
    n.y = Math.round(n.y)
  }
}

function buildMaps(nodes, edges) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const outs = new Map()
  const preds = new Map()
  for (const n of nodes) {
    outs.set(n.id, [])
    preds.set(n.id, [])
  }
  for (const e of edges) {
    if (!outs.has(e.from)) outs.set(e.from, [])
    if (!preds.has(e.to)) preds.set(e.to, [])
    outs.get(e.from).push(e.to)
    preds.get(e.to).push(e.from)
  }
  return { byId, outs, preds }
}

function placeFan(parent, childIds, byId, placed, spreadFactor = 1) {
  const ch = childIds.filter((id) => !placed.has(id))
  if (!ch.length || !parent) return
  const n = ch.length
  const spread =
    Math.min(Math.PI * 0.72, Math.PI * 0.2 * Math.max(n, 2) * spreadFactor) * FAN_SPREAD_FACTOR
  const mid = 0
  ch.sort((a, b) => a.localeCompare(b))
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1)
    const ang = mid - spread / 2 + t * spread
    const node = byId.get(ch[i])
    node.x = parent.x + FAN_RADIUS * Math.cos(ang) * FAN_KX
    node.y = parent.y + FAN_RADIUS * Math.sin(ang) * FAN_KY
    placed.add(ch[i])
  }
}

function sweepMerges(nodes, preds, byId, placed) {
  let changed = false
  for (const n of nodes) {
    if (placed.has(n.id)) continue
    const ps = preds.get(n.id) || []
    if (ps.length !== 2) continue
    if (!ps.every((p) => placed.has(p))) continue
    const parents = ps.map((p) => byId.get(p))
    const cx = Math.max(...parents.map((p) => p.x)) + MERGE_STEP_X
    const cy = parents.reduce((s, p) => s + p.y, 0) / 2
    n.x = cx
    n.y = cy
    placed.add(n.id)
    changed = true
  }
  return changed
}

function visitSubtree(rootId, byId, outs, preds, placed) {
  const parent = byId.get(rootId)
  if (!parent || !placed.has(rootId)) return
  const children = outs.get(rootId) || []
  const singles = children.filter((cid) => (preds.get(cid) || []).length === 1)
  placeFan(parent, singles, byId, placed, 1.08)
  let g = 0
  while (g < 12 && sweepMerges(nodesArray(byId), preds, byId, placed)) {
    g += 1
  }
  for (const cid of singles) {
    if (placed.has(cid)) visitSubtree(cid, byId, outs, preds, placed)
  }
}

function nodesArray(byId) {
  return [...byId.values()]
}

/** У цели три исходящих ребра к глобальным узлам cause-* */
function isThinkingGridGraph(outs, scenarios) {
  if (!scenarios.length) return false
  const ch = outs.get(scenarios[0]) || []
  return (
    ch.length >= 3 &&
    ch.every((id) => /^cause-\d+$/.test(id))
  )
}

/** Геометрический центр по Y для набора узлов (bounding box) */
function columnCenterY(nodeList) {
  if (!nodeList.length) return null
  let lo = Infinity
  let hi = -Infinity
  for (const n of nodeList) {
    const r = approxRadius(n)
    lo = Math.min(lo, n.y - r)
    hi = Math.max(hi, n.y + r)
  }
  return (lo + hi) / 2
}

/**
 * Ровная сетка: причины и гипотезы в столбцы; цели — столбец слева от причин.
 * Центры столбиков (первая нода, цели, причины, гипотезы) выравниваются по одной горизонтали (один Y).
 */
function layoutThinkingGrid(nodes, byId, scenarios) {
  const nGoals = scenarios.length
  let sumMidY = 0
  const seam = getThinkingGridPillarSeamXs()

  let maxCauseNum = 0
  for (const n of nodes) {
    const mc = /^cause-(\d+)$/.exec(n.id)
    if (mc) maxCauseNum = Math.max(maxCauseNum, parseInt(mc[1], 10))
  }
  const causeNodes = []
  for (let num = 1; num <= maxCauseNum; num += 1) {
    const cn = byId.get(`cause-${num}`)
    if (cn) {
      cn.x = seam.xCause
      cn.y = GRID_TOP + (num - 1) * GRID_CAUSE_DY
      causeNodes.push(cn)
    }
  }

  let maxHypNum = 0
  for (const n of nodes) {
    const mh = /^hyp-(\d+)$/.exec(n.id)
    if (mh) maxHypNum = Math.max(maxHypNum, parseInt(mh[1], 10))
  }
  const hypNodes = []
  for (let num = 1; num <= maxHypNum; num += 1) {
    const hn = byId.get(`hyp-${num}`)
    if (hn) {
      hn.x = seam.xHyp
      hn.y = GRID_TOP + (num - 1) * GRID_HYP_DY
      hypNodes.push(hn)
    }
  }

  const goalNodes = []
  for (let i = 0; i < nGoals; i++) {
    const sid = scenarios[i]

    /** Цели по Y ближе друг к другу: тот же шаг, что и между причинами (GRID_CAUSE_DY). */
    const midY = GRID_TOP + GRID_CAUSE_DY + i * GRID_CAUSE_DY

    const sg = byId.get(sid)
    if (sg) {
      const hj = hashGraphStr(sid)
      sg.x = seam.xGoal + (u01FromSeed(hj ^ 0x51ec) - 0.5) * 44
      sg.y = midY + (u01FromSeed(hj ^ 0xa17e) - 0.5) * 92
      goalNodes.push(sg)
    }

    sumMidY += midY
  }

  const uq = byId.get('userQuery')
  if (uq) {
    uq.x = seam.xUser
    uq.y = nGoals > 0 ? sumMidY / nGoals : GRID_TOP + GRID_CAUSE_DY
  }

  const cUser = uq ? columnCenterY([uq]) : null
  const cGoal = columnCenterY(goalNodes)
  const cCause = columnCenterY(causeNodes)
  const cHyp = columnCenterY(hypNodes)

  const centers = [cUser, cGoal, cCause, cHyp].filter((y) => y != null && Number.isFinite(y))
  if (centers.length === 0) return

  const yAlign = centers.reduce((s, y) => s + y, 0) / centers.length

  const shiftGroup = (list, centerBefore) => {
    if (centerBefore == null) return
    const d = yAlign - centerBefore
    if (d === 0) return
    for (const n of list) n.y += d
  }

  if (uq && cUser != null) uq.y += yAlign - cUser
  shiftGroup(goalNodes, cGoal)
  shiftGroup(causeNodes, cCause)
  shiftGroup(hypNodes, cHyp)

  layoutOutcomeBalls(nodes, hypNodes, null)
}

/**
 * Шары сценариев справа: без жёсткой сетки — «облако» с детерминированным шумом и лёгким разведением пересечений.
 * @param {number | null | undefined} viewWidth — ширина viewBox (new-demo полосы); иначе эвристика по hyp.x.
 */
function layoutOutcomeBalls(nodes, hypNodes, viewWidth = null) {
  const balls = nodes.filter(
    (n) => n.type === 'outcome' && /^out-scenario-\d+$/.test(n.id),
  )
  if (!balls.length || !hypNodes.length) return

  balls.sort((a, b) => {
    const ma = /^out-scenario-(\d+)$/.exec(a.id)
    const mb = /^out-scenario-(\d+)$/.exec(b.id)
    const ia = ma ? parseInt(ma[1], 10) : 0
    const ib = mb ? parseInt(mb[1], 10) : 0
    return ia - ib
  })

  let yLo = Infinity
  let yHi = -Infinity
  for (const h of hypNodes) {
    yLo = Math.min(yLo, h.y)
    yHi = Math.max(yHi, h.y)
  }
  const yPad = 440
  yLo -= yPad
  yHi += yPad

  const hypXMax = hypNodes.reduce((m, h) => Math.max(m, h.x), -Infinity)
  const hypXMin = hypNodes.reduce((m, h) => Math.min(m, h.x), Infinity)
  const hypAnchorX = Number.isFinite(hypXMax) ? Math.max(hypXMax, hypXMin) : GRID_X_HYP
  const xLo = hypAnchorX + GRID_BALL_PAD_XL + 64
  const inferCanvasW = () => {
    if (viewWidth != null && viewWidth > 200) return viewWidth
    if (Number.isFinite(hypAnchorX) && hypAnchorX > 120) {
      return Math.max(400, Math.ceil(hypAnchorX * 1.5001 + 140))
    }
    return null
  }
  const canvasW = inferCanvasW()
  const xHi =
    canvasW != null
      ? canvasW - 72
      : GRID_X_HYP + GRID_BALL_ZONE_W - GRID_BALL_PAD_XR + GRID_BALL_X_EXTRA
  if (xHi <= xLo + 120) return

  const rw = xHi - xLo
  const rh = yHi - yLo
  const n = balls.length
  const sepR = rw > 820 ? 176 : rw > 520 ? 154 : 128
  const pairMinMult = rw > 820 ? 3.68 : rw > 520 ? 3.48 : 3.28

  balls.forEach((b, i) => {
    const h0 = hashGraphStr(b.id)
    const t = n <= 1 ? 0.5 : i / (n - 1 || 1)
    const Golden = 2.39996322972865332
    const spiralA = Math.min(rw, rh) * 0.36
    const cx =
      xLo +
      rw * (0.02 + 0.96 * u01FromSeed(h0 ^ 0xc0de)) +
      Math.cos(i * Golden) * spiralA * 1.22 +
      (u01FromSeed(h0 ^ 0x1ee) - 0.5) * rw * 0.58
    const cy =
      yLo +
      rh * (0.02 + t * 0.96) +
      (u01FromSeed(h0 ^ 0x70d) - 0.5) * rh * 0.62 +
      Math.sin(i * Golden * 1.07) * (rh / Math.max(n, 2)) * 0.78
    b.x = cx
    b.y = cy
  })

  const clampBall = () => {
    for (const b of balls) {
      b.x = Math.max(xLo + sepR, Math.min(xHi - sepR, b.x))
      b.y = Math.max(yLo + sepR, Math.min(yHi - sepR, b.y))
    }
  }
  clampBall()

  for (let iter = 0; iter < (rw > 520 ? 58 : 44); iter++) {
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i]
        const c = balls[j]
        const dx = c.x - a.x
        const dy = c.y - a.y
        const dist = Math.hypot(dx, dy) || 1
        const minD = sepR * pairMinMult
        if (dist < minD) {
          const push = ((minD - dist) / 2) * 0.97
          const ux = dx / dist
          const uy = dy / dist
          a.x -= ux * push
          a.y -= uy * push
          c.x += ux * push
          c.y += uy * push
        }
      }
    }
    clampBall()
  }

  const pillarBodies = nodes.filter(
    (n) =>
      n.id === 'userQuery' ||
      /^scenario-\d+$/.test(n.id) ||
      /^cause-\d+$/.test(n.id) ||
      /^hyp-\d+$/.test(n.id),
  )
  const cdNodes = nodes.filter((n) => /^cd-\d+$/.test(n.id))
  const ballR = SCENARIO_OUTCOME_BALL_CLEARANCE_R
  for (let p = 0; p < 68; p++) {
    for (const b of balls) {
      for (const pl of pillarBodies) {
        const pr = pillarRadiusForScenarioBallRepel(pl)
        const dx = b.x - pl.x
        const dy = b.y - pl.y
        const d = Math.hypot(dx, dy) || 1
        const need = pr + ballR + 46 - d
        if (need <= 0) continue
        const ux = dx / d
        const uy = dy / d
        b.x += ux * need
        b.y += uy * need
      }
      for (const cd of cdNodes) {
        const cr = approxRadius(cd) + 10
        const dx = b.x - cd.x
        const dy = b.y - cd.y
        const d = Math.hypot(dx, dy) || 1
        const need = cr + ballR + 42 - d
        if (need <= 0) continue
        const ux = dx / d
        const uy = dy / d
        b.x += ux * need
        b.y += uy * need
      }
    }
    clampBall()
  }

  for (let iter = 0; iter < 28; iter++) {
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i]
        const c = balls[j]
        const dx = c.x - a.x
        const dy = c.y - a.y
        const dist = Math.hypot(dx, dy) || 1
        const minD = sepR * (pairMinMult + 0.2)
        if (dist < minD) {
          const push = ((minD - dist) / 2) * 0.98
          const ux = dx / dist
          const uy = dy / dist
          a.x -= ux * push
          a.y -= uy * push
          c.x += ux * push
          c.y += uy * push
        }
      }
    }
    clampBall()
  }

  repelScenarioOutcomeBallsAwayFromGraphNodes(nodes, { passes: 36 })

  for (const b of balls) {
    b.x = Math.round(b.x)
    b.y = Math.round(b.y)
  }
}

/**
 * Итеративно разводит узлы, если их окружности (approxRadius) пересекаются.
 */
export function relaxGraphNodeCollisions(nodes, { iterations = 28, margin = 38 } = {}) {
  const list = [...nodes]
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        const ra = approxRadius(a)
        const rb = approxRadius(b)
        const minD = ra + rb + margin
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.hypot(dx, dy) || 1
        if (dist < minD) {
          const push = (minD - dist) / 2
          const ux = dx / dist
          const uy = dy / dist
          a.x -= ux * push
          a.y -= uy * push
          b.x += ux * push
          b.y += uy * push
        }
      }
    }
  }
  for (const n of list) {
    n.x = Math.round(n.x)
    n.y = Math.round(n.y)
  }
}

/** Ширина/высота viewBox по текущим координатам без сдвига узлов. */
export function measureGraphBounds(nodes, pad = 96) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    const r = approxRadius(n)
    minX = Math.min(minX, n.x - r)
    minY = Math.min(minY, n.y - r)
    maxX = Math.max(maxX, n.x + r)
    maxY = Math.max(maxY, n.y + r)
  }
  return {
    width: Math.ceil(maxX - minX + pad * 2),
    height: Math.ceil(maxY - minY + pad * 2),
  }
}

export function normalizeGraphBounds(nodes) {
  const pad = 96
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    const r = approxRadius(n)
    minX = Math.min(minX, n.x - r)
    minY = Math.min(minY, n.y - r)
    maxX = Math.max(maxX, n.x + r)
    maxY = Math.max(maxY, n.y + r)
  }
  const width = Math.ceil(maxX - minX + pad * 2)
  const height = Math.ceil(maxY - minY + pad * 2)
  const ox = pad - minX
  const oy = pad - minY
  for (const n of nodes) {
    n.x = Math.round(n.x + ox)
    n.y = Math.round(n.y + oy)
  }
  return { width, height }
}

export function applyWorkflowLayout(nodes, edges) {
  const { byId, outs, preds } = buildMaps(nodes, edges)
  const uq = byId.get('userQuery')
  const gen = byId.get('generation')

  const scenarios = nodes
    .map((n) => n.id)
    .filter((id) => /^scenario-\d+$/.test(id))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  const useGrid = !gen && uq && scenarios.length > 0 && isThinkingGridGraph(outs, scenarios)

  if (useGrid) {
    layoutThinkingGrid(nodes, byId, scenarios)
    assignMergeInputPorts(edges, preds)
    const dim = normalizeGraphBounds(nodes)
    const pinOpts = { scenarioJitterMax: 0, edgeInset: 52 }
    pinThinkingGridPillarSeamXs(nodes, { viewWidth: dim.width, ...pinOpts })
    relayoutScenarioOutcomeBalls(nodes, dim.width)
    assignMergeInputPorts(edges, preds)
    const dim2 = normalizeGraphBounds(nodes)
    pinThinkingGridPillarSeamXs(nodes, { viewWidth: dim2.width, ...pinOpts })
    relayoutScenarioOutcomeBalls(nodes, dim2.width)
    assignMergeInputPorts(edges, preds)
    const m = measureGraphBounds(nodes)
    return {
      width: dim2.width,
      height: Math.max(dim2.height, m.height),
    }
  }

  const placed = new Set()

  if (uq) {
    uq.x = 120
    uq.y = 320
    placed.add('userQuery')
  }
  if (gen) {
    gen.x = 520
    gen.y = 320
    placed.add('generation')
  }

  const scenarioFanOrigin =
    gen && scenarios.length
      ? { x: gen.x, y: gen.y }
      : uq && scenarios.length
        ? { x: uq.x + 400, y: uq.y }
        : null

  if (scenarioFanOrigin && scenarios.length) {
    const n = scenarios.length
    const colX = scenarioFanOrigin.x + 620
    const spanY = (n > 1 ? n - 1 : 0) * 102
    const baseY = scenarioFanOrigin.y - spanY / 2
    for (let i = 0; i < n; i++) {
      const sn = byId.get(scenarios[i])
      sn.x = colX
      sn.y = baseY + i * 102
      placed.add(scenarios[i])
    }
  }

  for (const sid of scenarios) {
    visitSubtree(sid, byId, outs, preds, placed)
  }

  let g = 0
  while (g < 24 && sweepMerges(nodesArray(byId), preds, byId, placed)) {
    g += 1
  }

  for (const n of nodes) {
    if (!placed.has(n.id)) {
      const ps = preds.get(n.id) || []
      if (ps.length === 1 && placed.has(ps[0])) {
        const p = byId.get(ps[0])
        n.x = p.x + CHAIN_STEP_X
        n.y = p.y
        placed.add(n.id)
      } else {
        n.x = 1200
        n.y = 500
      }
    }
  }

  const simNodes = nodes.map((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
    r: approxRadius(n) + 18,
    fx: null,
    fy: null,
  }))
  for (const s of simNodes) {
    if (s.id === 'userQuery' || s.id === 'generation') {
      s.fx = s.x
      s.fy = s.y
    }
  }
  const idToSim = new Map(simNodes.map((s) => [s.id, s]))
  const sim = forceSimulation(simNodes)
    .force('collide', forceCollide((d) => d.r).strength(1))
    .force('charge', forceManyBody().strength(-18).distanceMax(560))
    .alphaDecay(0.18)
    .velocityDecay(0.72)

  sim.alpha(1)
  for (let i = 0; i < 420; i++) sim.tick()

  for (const n of nodes) {
    const s = idToSim.get(n.id)
    if (s) {
      n.x = Math.round(s.x)
      n.y = Math.round(s.y)
    }
  }

  const pinned = new Set(['userQuery'])
  if (gen) pinned.add('generation')
  let sumY = 0
  let cntY = 0
  for (const n of nodes) {
    if (pinned.has(n.id)) continue
    sumY += n.y
    cntY += 1
  }
  const meanY = cntY > 0 ? sumY / cntY : 0
  for (const n of nodes) {
    if (pinned.has(n.id)) continue
    n.y = Math.round(meanY + (n.y - meanY) * POST_Y_DAMP)
  }

  assignMergeInputPorts(edges, preds)
  return normalizeGraphBounds(nodes)
}

export function assignMergeInputPorts(edges, preds) {
  for (const e of edges) e.inPort = undefined
  const toPreds = new Map()
  for (const e of edges) {
    if (!toPreds.has(e.to)) toPreds.set(e.to, [])
    toPreds.get(e.to).push(e.from)
  }
  for (const [to, froms] of toPreds) {
    if (froms.length === 2) {
      const sorted = [...froms].sort(sortEdgeFromIds)
      const [a, b] = sorted
      for (const e of edges) {
        if (e.to !== to) continue
        if (e.from === a) e.inPort = 0
        else if (e.from === b) e.inPort = 1
      }
    } else if (froms.length === 3) {
      const sorted = [...froms].sort(sortEdgeFromIds)
      for (const e of edges) {
        if (e.to !== to) continue
        const idx = sorted.indexOf(e.from)
        if (idx >= 0) e.inPort = idx
      }
    }
  }
}

function sortEdgeFromIds(a, b) {
  const ca = /^cause-(\d+)$/.exec(a)
  const cb = /^cause-(\d+)$/.exec(b)
  if (ca && cb) return parseInt(ca[1], 10) - parseInt(cb[1], 10)
  const ha = /^hyp-(\d+)$/.exec(a)
  const hb = /^hyp-(\d+)$/.exec(b)
  if (ha && hb) return parseInt(ha[1], 10) - parseInt(hb[1], 10)
  return a.localeCompare(b)
}

/** После добавления узлов ЦД — пересчёт полосы шаров сценариев справа. */
export function relayoutScenarioOutcomeBalls(nodes, viewWidth) {
  const hypNodes = nodes
    .filter((n) => /^hyp-\d+$/.test(n.id))
    .sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x))
  layoutOutcomeBalls(nodes, hypNodes, viewWidth)
}

/** Нормализация холста и портов слияний после правки рёбер. */
export function finalizeThinkingLayout(nodes, edges) {
  const { preds } = buildMaps(nodes, edges)
  assignMergeInputPorts(edges, preds)
  return normalizeGraphBounds(nodes)
}
