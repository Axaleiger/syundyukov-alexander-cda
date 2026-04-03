/**
 * Convert GeoJSON Polygon/MultiPolygon features into react-globe.gl `pathsData`.
 * Each path item: { kind, points: [{ lat, lng, alt }] }.
 */
function downsampleRing(ring, maxPoints) {
  if (!Array.isArray(ring) || ring.length === 0) return []
  if (!maxPoints || ring.length <= maxPoints) return ring
  const step = Math.ceil(ring.length / maxPoints)
  const out = []
  for (let i = 0; i < ring.length; i += step) out.push(ring[i])
  // Close to first sampled point (prevents huge closing diagonals after downsample).
  const first = out[0]
  const last = out[out.length - 1]
  if (first && last && (last[0] !== first[0] || last[1] !== first[1])) out.push(first)
  return out
}

function safeCoord(p) {
  return Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) ? p : null
}

function splitRingByDateline(ring, { datelineJumpDeg = 180 } = {}) {
  // Splits a ring into segments when longitude jumps across the dateline.
  // This avoids drawing world-spanning diagonals for polygons that cross ±180°.
  const coords = (Array.isArray(ring) ? ring : []).map(safeCoord).filter(Boolean)
  if (coords.length < 2) return []

  const segments = []
  let cur = [coords[0]]
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1]
    const next = coords[i]
    const dLng = Math.abs(next[0] - prev[0])
    if (dLng > datelineJumpDeg) {
      if (cur.length >= 2) segments.push(cur)
      cur = [next]
    } else {
      cur.push(next)
    }
  }
  if (cur.length >= 2) segments.push(cur)
  return segments
}

function ringSegmentToPoints(seg, { alt = 0.003, maxPointsPerRing = 140 } = {}) {
  const sampled = downsampleRing(seg, maxPointsPerRing)
  return sampled
    .map(safeCoord)
    .filter(Boolean)
    .map(([lng, lat]) => ({ lat, lng, alt }))
}

function ringToPathItems(ring, opts, kind) {
  const segs = splitRingByDateline(ring, opts)
  const items = []
  for (const seg of segs) {
    const points = ringSegmentToPoints(seg, opts)
    if (points.length >= 2) items.push({ kind, points })
  }
  return items
}

function geometryToPaths(geometry, opts, kind) {
  if (!geometry?.type || !geometry.coordinates) return []
  if (geometry.type === 'LineString') {
    return ringToPathItems(geometry.coordinates, opts, kind)
  }
  if (geometry.type === 'MultiLineString') {
    const out = []
    for (const line of geometry.coordinates) {
      out.push(...ringToPathItems(line, opts, kind))
    }
    return out
  }
  if (geometry.type === 'Polygon') {
    const [outer] = geometry.coordinates
    if (!outer) return []
    return ringToPathItems(outer, opts, kind)
  }
  if (geometry.type === 'MultiPolygon') {
    const out = []
    for (const poly of geometry.coordinates) {
      const [outer] = poly || []
      if (!outer) continue
      out.push(...ringToPathItems(outer, opts, kind))
    }
    return out
  }
  return []
}

export function geojsonFeaturesToPaths(features, opts = {}, kind = 'path') {
  if (!Array.isArray(features)) return []
  const out = []
  for (const f of features) {
    out.push(...geometryToPaths(f?.geometry, opts, kind))
  }
  return out
}

