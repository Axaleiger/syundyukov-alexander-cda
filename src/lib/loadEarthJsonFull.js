import * as THREE from 'three'
import { GLOBE_RADIUS, normalizeEarthSceneToGlobeRadius } from './globePolar.js'

const TONE_BY_NUM = {
  0: THREE.NoToneMapping,
  1: THREE.LinearToneMapping,
  2: THREE.ReinhardToneMapping,
  3: THREE.CineonToneMapping,
  4: THREE.ACESFilmicToneMapping,
  5: THREE.CustomToneMapping,
  6: THREE.AgXToneMapping,
  7: THREE.NeutralToneMapping,
}

/**
 * @param {import('three').WebGLRenderer} gl
 * @param {object} project
 */
export function applyEarthJsonProjectToRenderer(gl, project) {
  if (!gl || !project) return
  const tm = project.toneMapping
  if (tm !== undefined && TONE_BY_NUM[tm] !== undefined) {
    gl.toneMapping = TONE_BY_NUM[tm]
  } else if (tm !== undefined && typeof tm === 'number') {
    gl.toneMapping = THREE.ACESFilmicToneMapping
  }
  if (project.toneMappingExposure != null && Number.isFinite(project.toneMappingExposure)) {
    gl.toneMappingExposure = project.toneMappingExposure
  }
  if (project.shadows === true) {
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFSoftShadowMap
  }
  if (THREE.SRGBColorSpace && 'outputColorSpace' in gl) {
    gl.outputColorSpace = THREE.SRGBColorSpace
  }
}

/**
 * Удаляет камеры из распарсенной сцены (активная камера — из Canvas R3F).
 */
export function stripCamerasFromObject3D(root) {
  const toRemove = []
  root.traverse((o) => {
    if (o.isCamera) toRemove.push(o)
  })
  for (const o of toRemove) {
    o.parent?.remove(o)
  }
}

/**
 * @returns {Promise<{
 *   sceneRoot: THREE.Object3D,
 *   full: object,
 *   orbitTarget: THREE.Vector3,
 *   cameraMatrix: number[] | null,
 * }>}
 */
export async function loadEarthJsonFull(jsonUrl) {
  const res = await fetch(jsonUrl)
  if (!res.ok) throw new Error(`Earth сцена HTTP ${res.status}`)
  const full = await res.json()
  if (!full?.scene) throw new Error('Earth: в JSON нет scene')

  const loader = new THREE.ObjectLoader()
  const sceneRoot = await loader.parseAsync(full.scene)
  stripCamerasFromObject3D(sceneRoot)

  const center = full.controls?.center
  const orbitTarget = Array.isArray(center) && center.length >= 3
    ? new THREE.Vector3(center[0], center[1], center[2])
    : new THREE.Vector3(0, 0, 0)

  let cameraMatrix = null
  try {
    const m = full.camera?.object?.matrix
    if (Array.isArray(m) && m.length >= 16) cameraMatrix = [...m]
  } catch (_) { /* ignore */ }

  sceneRoot.updateMatrixWorld(true)
  const m0 = sceneRoot.matrixWorld.clone()
  normalizeEarthSceneToGlobeRadius(sceneRoot, GLOBE_RADIUS)
  sceneRoot.updateMatrixWorld(true)
  const m1 = sceneRoot.matrixWorld.clone()
  const invM0 = new THREE.Matrix4().copy(m0).invert()
  const delta = new THREE.Matrix4().multiplyMatrices(m1, invM0)
  orbitTarget.applyMatrix4(delta)
  if (cameraMatrix) {
    const camM = new THREE.Matrix4().fromArray(cameraMatrix)
    camM.premultiply(delta)
    cameraMatrix = camM.toArray()
  }

  return { sceneRoot, full, orbitTarget, cameraMatrix }
}
