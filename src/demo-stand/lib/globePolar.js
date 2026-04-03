import * as THREE from 'three'

/** Совпадает с three-globe GLOBE_RADIUS */
export const GLOBE_RADIUS = 100

/**
 * Как three-globe polar2Cartesian$3: lat/lng в градусах, relAlt — относительная высота над R.
 */
export function polarToCartesian(lat, lng, relAlt = 0) {
  const phi = ((90 - lat) * Math.PI) / 180
  const theta = ((90 - lng) * Math.PI) / 180
  const r = GLOBE_RADIUS * (1 + relAlt)
  const phiSin = Math.sin(phi)
  return new THREE.Vector3(
    r * phiSin * Math.cos(theta),
    r * Math.cos(phi),
    r * phiSin * Math.sin(theta),
  )
}

export function polarToCameraPosition(lat, lng, altitude) {
  const dist = GLOBE_RADIUS * (1 + altitude)
  return polarToCartesian(lat, lng, 0).normalize().multiplyScalar(dist)
}

/** Обратное к polarToCartesian для точки на луче из начала координат (как у three-globe). */
export function cartesianToGeo(v) {
  const r = v.length()
  if (r < 1e-8) {
    return { lat: 0, lng: 0, altitude: -1 }
  }
  const y = THREE.MathUtils.clamp(v.y / r, -1, 1)
  const phi = Math.acos(y)
  const lat = 90 - (phi * 180) / Math.PI
  const sp = Math.sin(phi)
  let lng = 0
  if (sp > 1e-8) {
    const theta = Math.atan2(v.z, v.x)
    lng = 90 - (theta * 180) / Math.PI
  }
  const altitude = r / GLOBE_RADIUS - 1
  return { lat, lng, altitude }
}

/** Центр сцены в 0, масштаб под радиус глобуса, меридиан как three-globe. */
export function normalizeEarthSceneToGlobeRadius(root, globeRadius) {
  const box = new THREE.Box3().setFromObject(root)
  const center = box.getCenter(new THREE.Vector3())
  root.position.sub(center)
  box.setFromObject(root)
  const bs = box.getBoundingSphere(new THREE.Sphere())
  const r = bs.radius > 1e-6 ? bs.radius : 1
  root.scale.multiplyScalar(globeRadius / r)
  root.rotation.y = -Math.PI / 2
}
