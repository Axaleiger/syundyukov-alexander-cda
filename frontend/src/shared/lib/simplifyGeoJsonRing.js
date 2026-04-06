/**
 * Упрощает кольцо координат [lng, lat][] — меньше вершин = меньше нагрузка на GPU.
 */
export function simplifyRing(ring, maxPoints = 80) {
  if (!Array.isArray(ring) || ring.length <= maxPoints) return ring
  const step = Math.ceil(ring.length / maxPoints)
  const out = []
  for (let i = 0; i < ring.length; i += step) out.push(ring[i])
  const last = ring[ring.length - 1]
  const first = out[0]
  if (last && first && (last[0] !== first[0] || last[1] !== first[1])) out.push(last)
  return out
}

export function simplifyPolygonGeometry(geometry, maxPerRing = 80) {
  if (!geometry || !geometry.type) return geometry
  const clone = { type: geometry.type, coordinates: geometry.coordinates }
  if (geometry.type === 'Polygon') {
    clone.coordinates = geometry.coordinates.map((ring) => simplifyRing(ring, maxPerRing))
  } else if (geometry.type === 'MultiPolygon') {
    clone.coordinates = geometry.coordinates.map((poly) =>
      poly.map((ring) => simplifyRing(ring, maxPerRing))
    )
  }
  return clone
}

/**
 * Упрощает геометрию полигона или линии (для контуров стран / границ).
 */
export function simplifyGeometry(geometry, maxPerRing = 80) {
  if (!geometry?.type) return geometry
  if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
    return simplifyPolygonGeometry(geometry, maxPerRing)
  }
  if (geometry.type === 'LineString') {
    return { type: 'LineString', coordinates: simplifyRing(geometry.coordinates, maxPerRing) }
  }
  if (geometry.type === 'MultiLineString') {
    return {
      type: 'MultiLineString',
      coordinates: geometry.coordinates.map((line) => simplifyRing(line, maxPerRing)),
    }
  }
  return geometry
}

export function simplifyFeatures(features, maxPerRing = 80) {
  if (!Array.isArray(features)) return []
  return features.map((f) => ({
    ...f,
    geometry: simplifyGeometry(f.geometry, maxPerRing),
  }))
}
