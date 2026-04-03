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
 * Процедурная сфера + equirect-текстура; тот же normalizeEarthSceneToGlobeRadius и контракт, что у старого JSON.
 *
 * @returns {Promise<{
 *   sceneRoot: THREE.Object3D,
 *   full: object,
 *   orbitTarget: THREE.Vector3,
 *   cameraMatrix: number[] | null,
 * }>}
 */
export async function loadEarthGlobeScene(textureUrl) {
  if (!textureUrl || typeof textureUrl !== 'string') {
    throw new Error('Earth: не задан URL текстуры глобуса')
  }

  const loader = new THREE.TextureLoader()
  loader.setCrossOrigin('anonymous')

  const tex = await new Promise((resolve, reject) => {
    loader.load(
      textureUrl,
      (t) => resolve(t),
      undefined,
      (err) => reject(err instanceof Error ? err : new Error(String(err))),
    )
  })

  if (THREE.SRGBColorSpace && 'colorSpace' in tex) {
    tex.colorSpace = THREE.SRGBColorSpace
  }
  tex.anisotropy = 8

  const sceneRoot = new THREE.Group()
  const geom = new THREE.SphereGeometry(GLOBE_RADIUS, 96, 96)
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.55,
    metalness: 0.06,
  })
  const mesh = new THREE.Mesh(geom, mat)
  mesh.receiveShadow = true
  sceneRoot.add(mesh)

  const orbitTarget = new THREE.Vector3(0, 0, 0)

  normalizeEarthSceneToGlobeRadius(sceneRoot, GLOBE_RADIUS)

  const full = {
    project: {
      toneMapping: 4,
      toneMappingExposure: 1,
      shadows: false,
    },
    controls: { center: [0, 0, 0] },
  }

  return { sceneRoot, full, orbitTarget, cameraMatrix: null }
}
