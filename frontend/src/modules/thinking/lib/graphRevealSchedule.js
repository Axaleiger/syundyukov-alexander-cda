/**
 * Псевдослучайная задержка раскрытия узла графа (детерминированно от seed + id).
 * Несколько уровней + джиттер, чтобы ветки жили асинхронно и «размышляли».
 */

function mulberry32(seed) {
  return function next() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashNodeId(nodeId) {
  let h = 0
  const s = String(nodeId)
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0
  }
  return h
}

export function revealDelayMs(sessionSeed, nodeId) {
  const rng = mulberry32((sessionSeed ^ hashNodeId(nodeId)) >>> 0)
  const jitter = () => Math.round(rng() * 420)
  const r = rng()
  if (r < 0.42) {
    return Math.max(40, Math.round(50 + rng() * 920) + jitter())
  }
  if (r < 0.68) {
    return Math.round(280 + rng() * 1200) + jitter()
  }
  if (r < 0.86) {
    return Math.round(900 + rng() * 1600) + jitter()
  }
  if (r < 0.96) {
    return Math.round(1800 + rng() * 2400) + jitter()
  }
  return Math.round(3200 + rng() * 2800) + jitter()
}

export function buildPredsOuts(nodeIds, edges) {
  const preds = new Map()
  const outs = new Map()
  for (const id of nodeIds) {
    preds.set(id, [])
    outs.set(id, [])
  }
  for (const e of edges) {
    if (outs.has(e.from) && preds.has(e.to)) {
      outs.get(e.from).push(e.to)
      preds.get(e.to).push(e.from)
    }
  }
  return { preds, outs }
}
