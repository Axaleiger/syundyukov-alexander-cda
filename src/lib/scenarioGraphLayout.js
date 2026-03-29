/**
 * Раскладка workflow: основной поток слева направо, веер с отклонением по Y, merge и коллизии.
 */

import { forceSimulation, forceCollide, forceManyBody } from 'd3-force'

function approxRadius(node) {
  const t = node.type
  if (t === 'start') return 88
  if (t === 'scenario') return 64
  if (t === 'milestone') return 74
  return 64
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

/** Веер в сторону +X (угол 0 — вправо), разброс по вертикали */
function placeFan(parent, childIds, byId, placed, spreadFactor = 1) {
  const R = 128
  const ch = childIds.filter((id) => !placed.has(id))
  if (!ch.length || !parent) return
  const n = ch.length
  const spread = Math.min(Math.PI * 0.72, Math.PI * 0.2 * Math.max(n, 2) * spreadFactor)
  const mid = 0
  ch.sort((a, b) => a.localeCompare(b))
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1)
    const ang = mid - spread / 2 + t * spread
    const node = byId.get(ch[i])
    node.x = parent.x + R * Math.cos(ang)
    node.y = parent.y + R * Math.sin(ang)
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
    const cx = Math.max(...parents.map((p) => p.x)) + 118
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

export function applyWorkflowLayout(nodes, edges) {
  const { byId, outs, preds } = buildMaps(nodes, edges)
  const placed = new Set()

  const uq = byId.get('userQuery')
  const gen = byId.get('generation')
  if (uq) {
    uq.x = 140
    uq.y = 320
    placed.add('userQuery')
  }
  if (gen) {
    gen.x = 420
    gen.y = 320
    placed.add('generation')
  }

  const scenarios = nodes
    .map((n) => n.id)
    .filter((id) => /^scenario-\d+$/.test(id))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  if (gen && scenarios.length) {
    const n = scenarios.length
    const R = 400
    const spread = Math.min(Math.PI * 0.78, 0.16 * Math.PI * n)
    const mid = 0
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1)
      const ang = mid - spread / 2 + t * spread
      const sn = byId.get(scenarios[i])
      sn.x = gen.x + R * Math.cos(ang)
      sn.y = gen.y + R * Math.sin(ang)
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
        n.x = p.x + 130
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
    .force('charge', forceManyBody().strength(-22).distanceMax(520))
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

  assignMergeInputPorts(edges, preds)

  const pad = 120
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
    n.x += ox
    n.y += oy
  }

  return { width, height }
}

function assignMergeInputPorts(edges, preds) {
  for (const e of edges) e.inPort = undefined
  const toPreds = new Map()
  for (const e of edges) {
    if (!toPreds.has(e.to)) toPreds.set(e.to, [])
    toPreds.get(e.to).push(e.from)
  }
  for (const [to, froms] of toPreds) {
    if (froms.length !== 2) continue
    const [a, b] = [...froms].sort((x, y) => x.localeCompare(y))
    for (const e of edges) {
      if (e.to !== to) continue
      if (e.from === a) e.inPort = 0
      else if (e.from === b) e.inPort = 1
    }
  }
}
