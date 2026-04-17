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
const GRID_TOP = 96
const GRID_CAUSE_DY = 124
const GRID_GAP_ROW = 72
const GRID_BLOCK_H = 3 * GRID_CAUSE_DY + GRID_GAP_ROW
/** Одинаковая ширина «колонок» между центрами: user → goals → causes → hyp → зона сценариев */
export const THINKING_GRID_COL_SPAN = 400
const GRID_X_USER = 200
const GRID_X_GOAL = GRID_X_USER + THINKING_GRID_COL_SPAN
const GRID_X_CAUSE = GRID_X_GOAL + THINKING_GRID_COL_SPAN
const GRID_X_HYP = GRID_X_CAUSE + THINKING_GRID_COL_SPAN
const GRID_HYP_DY = 124
/** Зона шаров сценариев справа от гипотез — та же ширина, что и между соседними колонками */
const GRID_BALL_ZONE_W = THINKING_GRID_COL_SPAN
const GRID_BALL_PAD_XL = 72
const GRID_BALL_PAD_XR = 72

function approxRadius(node) {
  const t = node.type
  if (t === 'start') return 104
  if (t === 'scenario') return 86
  if (t === 'milestone') return 96
  if (t === 'outcome') return 50
  return 84
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

  let maxCauseNum = 0
  for (const n of nodes) {
    const mc = /^cause-(\d+)$/.exec(n.id)
    if (mc) maxCauseNum = Math.max(maxCauseNum, parseInt(mc[1], 10))
  }
  const causeNodes = []
  for (let num = 1; num <= maxCauseNum; num += 1) {
    const cn = byId.get(`cause-${num}`)
    if (cn) {
      cn.x = GRID_X_CAUSE
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
      hn.x = GRID_X_HYP
      hn.y = GRID_TOP + (num - 1) * GRID_HYP_DY
      hypNodes.push(hn)
    }
  }

  const goalNodes = []
  for (let i = 0; i < nGoals; i++) {
    const sid = scenarios[i]

    const anchor = GRID_TOP + i * GRID_BLOCK_H
    const midY = anchor + GRID_CAUSE_DY

    const sg = byId.get(sid)
    if (sg) {
      sg.x = GRID_X_GOAL
      sg.y = midY
      goalNodes.push(sg)
    }

    sumMidY += midY
  }

  const uq = byId.get('userQuery')
  if (uq) {
    uq.x = GRID_X_USER
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

  layoutOutcomeBalls(nodes, hypNodes)
}

/** Равномерная сетка позиций шаров в полосе справа от гипотез (порядок по номеру сценария). */
function layoutOutcomeBalls(nodes, hypNodes) {
  const balls = nodes.filter((n) => n.type === 'outcome')
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
  const yPad = 72
  yLo -= yPad
  yHi += yPad

  const xLo = GRID_X_HYP + GRID_BALL_PAD_XL
  const xHi = GRID_X_HYP + GRID_BALL_ZONE_W - GRID_BALL_PAD_XR
  if (xHi <= xLo + 40) return

  const rw = xHi - xLo
  const rh = yHi - yLo
  const n = balls.length
  const aspect = rw / Math.max(rh, 1e-6)
  let cols = Math.max(1, Math.round(Math.sqrt(n * aspect)))
  let rows = Math.ceil(n / cols)
  while (cols < n && rows > 1 && rh / rows < rw / cols) {
    cols += 1
    rows = Math.ceil(n / cols)
  }

  const cellW = rw / cols
  const cellH = rh / rows

  balls.forEach((b, i) => {
    const row = Math.floor(i / cols)
    const col = i % cols
    const cx = xLo + (col + 0.5) * cellW
    const cy = yLo + (row + 0.5) * cellH
    b.x = Math.round(cx)
    b.y = Math.round(cy)
  })
}

function normalizeGraphBounds(nodes) {
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
    return normalizeGraphBounds(nodes)
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

function assignMergeInputPorts(edges, preds) {
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
