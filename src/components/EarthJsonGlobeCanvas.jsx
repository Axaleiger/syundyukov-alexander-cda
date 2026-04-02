import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line, OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import {
  applyEarthJsonProjectToRenderer,
  loadEarthJsonFull,
} from '../lib/loadEarthJsonFull'
import {
  GLOBE_RADIUS,
  cartesianToGeo,
  polarToCameraPosition,
  polarToCartesian,
} from '../lib/globePolar'

const STARFIELD_URL = 'https://unpkg.com/three-globe@2.45.1/example/img/night-sky.png'

/**
 * После успешного StandHudWidthFit — не затирать FOV из ImmersiveOverrides / прочих хуков.
 * Сбрасывается, когда стенд выключен (StandHudWidthFit active=false).
 */
let __standFovLocked = false

function logFovOverride(label) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console -- трассировка перезаписей FOV
    console.log('FOV OVERRIDE HERE', label, new Error().stack)
  }
}

/** ?demo=stand + immersive: смещение корня сцены по Y (отрицательное — шар ниже в кадре). */
const IMMERSIVE_STAND_WORLD_OFFSET_Y = -6

/**
 * Стенд: FOV подбирает «зум» без захода внутрь шара (R=100).
 * После ~0.92° (экстрем. крупно) — ~×15 «отдаления»: tan(h/2) → 15·tan(0.46°) → h≈13.8°.
 */
const STAND_CAMERA_FOV = 13.8
/** Целевая ширина силуэта в пикселях = ширина canvas × коэффициент (immersiveStandLayout / ?demo=stand#face). */
const STAND_GLOBE_WIDTH_OVERSHOOT = 7.2
/**
 * После подбора дистанции — дополнительно подвести камеру ближе (1 = как по ширине силуэта).
 * Измерение span часто упирается в ширину canvas, тогда без множителя зум не меняется от overshoot.
 */
const STAND_POST_FIT_DISTANCE_SCALE = 0.09
/** Мин. расстояние камера–центр орбиты (ближе к поверхности ≈ сильнее зум; ниже — риск клиппинга). */
const STAND_MIN_CAMERA_DISTANCE = GLOBE_RADIUS * 1.003
/** Доп. множитель к дистанции после bisect+scale (×15 к прошлой итерации — дальше от шара). */
const STAND_DISTANCE_FINAL_MUL = (0.34 / 30) * 15
/** Запасная дистанция, если project не даёт ширину (см. шаг 3). */
const STAND_DISTANCE_FALLBACK = Math.max(
  STAND_MIN_CAMERA_DISTANCE,
  GLOBE_RADIUS * 1.35 * STAND_POST_FIT_DISTANCE_SCALE * STAND_DISTANCE_FINAL_MUL,
)
/** Включить true — в конце эффекта принудительно подтянуть камеру (проверка, что зум = distance). */
const STAND_FORCE_CAMERA_DISTANCE_TEST = false
/**
 * Включить true — камера в (0,0, R*2.5), lookAt(0,0,0). Сцена может быть не в начале координат;
 * цель — проверить, что меняется именно эта PerspectiveCamera, а не «другая».
 */
const STAND_DEBUG_CAMERA_ORIGIN_OVERRIDE = false

/** Подъём купола в кадре (сумма с pull задаёт вертикаль). */
const STAND_IMMERSIVE_CAMERA_LIFT = 18
const STAND_IMMERSIVE_SCREEN_UP_EXTRA = 28
const STAND_IMMERSIVE_WORLD_Y_PULL = 44

/** Горизонталь центровки под ось lifecycle (px). Не через CSS translateX — иначе слева полоса без canvas. */
const STAND_HUD_TARGET_CX_OFFSET_PX = 262

function worldOrbitCenter(root, orbitTargetLocal) {
  const wc = orbitTargetLocal.clone()
  root.updateWorldMatrix(true, true)
  root.localToWorld(wc)
  return wc
}

/** Камера: локально orbitTarget + polar offset, затем в мир (учитывает immersiveEuler и сдвиг стенда). */
function worldCameraPosition(root, orbitTargetLocal, lat, lng, alt) {
  const p = polarToCameraPosition(lat, lng, alt)
  const camLocal = orbitTargetLocal.clone().add(p)
  root.updateWorldMatrix(true, true)
  root.localToWorld(camLocal)
  return camLocal
}

/** Локальный +Y корня Земли — ось север–юг (долгота: Владивосток ↔ СПб), после normalizeEarthSceneToGlobeRadius */
const STAND_SPIN_GEO_POLE_LOCAL = new THREE.Vector3(0, 1, 0)

/**
 * ?demo=stand: вращение вокруг географической оси (север–юг) без смещения центра шара.
 * Не использовать rotateOnWorldAxis на дочернем объекте при повёрнутых родителях —
 * в Three.js для rotateOnWorldAxis указано «assumes no rotated parent», иначе центр «уезжает»
 * по дуге (маятник / за горизонт). Ось полюса в мире → в локаль spinGroup → rotateOnAxis.
 */
function StandGlobeYawSpin({ active, spinGroupRef, earthRoot, gl, invalidate }) {
  const spinAxisPoolRef = useRef({
    axisWorld: new THREE.Vector3(),
    axisLocal: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    posBefore: new THREE.Vector3(),
    posAfter: new THREE.Vector3(),
    invMw: new THREE.Matrix4(),
  })
  const moveLogCountRef = useRef(0)
  useEffect(() => {
    if (!active) return
    const el = gl.domElement
    let down = false
    let lastX = 0
    let capId = null
    const sens = 0.0033
    const onDown = (e) => {
      if (e.button !== 0) return
      down = true
      lastX = e.clientX
      capId = e.pointerId
      try {
        el.setPointerCapture(e.pointerId)
      } catch (_) { /* ignore */ }
    }
    const onMove = (e) => {
      if (!down || !spinGroupRef.current || !earthRoot) return
      const dx = e.clientX - lastX
      lastX = e.clientX
      const angle = -dx * sens
      const sg = spinGroupRef.current
      const p = spinAxisPoolRef.current
      earthRoot.updateWorldMatrix(true, true)
      earthRoot.getWorldPosition(p.posBefore)
      earthRoot.getWorldQuaternion(p.quat)
      p.axisWorld.copy(STAND_SPIN_GEO_POLE_LOCAL).applyQuaternion(p.quat)
      if (p.axisWorld.lengthSq() < 1e-12) return
      p.axisWorld.normalize()
      sg.updateWorldMatrix(true, true)
      p.invMw.copy(sg.matrixWorld).invert()
      p.axisLocal.copy(p.axisWorld).transformDirection(p.invMw)
      if (p.axisLocal.lengthSq() < 1e-12) return
      p.axisLocal.normalize()
      sg.rotateOnAxis(p.axisLocal, angle)
      earthRoot.updateWorldMatrix(true, true)
      earthRoot.getWorldPosition(p.posAfter)
      const drift = p.posAfter.distanceTo(p.posBefore)
      moveLogCountRef.current += 1
      // #region agent log
      if (moveLogCountRef.current <= 30 && moveLogCountRef.current % 5 === 0) {
        fetch('http://127.0.0.1:7436/ingest/211ab724-0b9d-43d2-b8ad-555efba1a9a8', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'fd2585' },
          body: JSON.stringify({
            sessionId: 'fd2585',
            location: 'EarthJsonGlobeCanvas:StandGlobeYawSpin',
            message: 'spin drift earthRoot world pos',
            data: {
              drift,
              moveN: moveLogCountRef.current,
              axL: p.axisLocal.toArray(),
            },
            timestamp: Date.now(),
            hypothesisId: 'H1-noRotatedParent',
            runId: 'rotateOnAxis-fix',
          }),
        }).catch(() => {})
      }
      // #endregion
      invalidate()
    }
    const release = (e) => {
      down = false
      if (capId != null) {
        try {
          if (el.hasPointerCapture?.(capId)) el.releasePointerCapture(capId)
        } catch (_) { /* ignore */ }
        capId = null
      }
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', release)
    el.addEventListener('pointercancel', release)
    el.addEventListener('lostpointercapture', release)
    return () => {
      release({})
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', release)
      el.removeEventListener('pointercancel', release)
      el.removeEventListener('lostpointercapture', release)
    }
  }, [active, earthRoot, gl, invalidate, spinGroupRef])
  return null
}

function greatCirclePoints(lat0, lng0, lat1, lng1, segs = 28) {
  const v0 = polarToCartesian(lat0, lng0, 0.001).normalize()
  const v1 = polarToCartesian(lat1, lng1, 0.001).normalize()
  const dots = Math.acos(Math.min(1, Math.max(-1, v0.dot(v1))))
  const pts = []
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    let p
    if (dots < 1e-5) p = v0.clone()
    else {
      const s0 = Math.sin((1 - t) * dots) / Math.sin(dots)
      const s1 = Math.sin(t * dots) / Math.sin(dots)
      p = new THREE.Vector3().addScaledVector(v0, s0).addScaledVector(v1, s1)
    }
    pts.push(p.normalize().multiplyScalar(GLOBE_RADIUS * 1.003))
  }
  return pts
}

function EquirectBackground({ url }) {
  const { scene } = useThree()
  useEffect(() => {
    const loader = new THREE.TextureLoader()
    const tex = loader.load(url, () => {
      tex.colorSpace = THREE.SRGBColorSpace
      scene.background = tex
    })
    return () => {
      scene.background = null
      tex.dispose()
    }
  }, [scene, url])
  return null
}

/** ?demo=stand#face: без звёзд/эквиректа — прозрачный clear, фон страницы (CSS-градиент). */
function StandTransparentScene({ active }) {
  const { gl, scene } = useThree()
  useLayoutEffect(() => {
    if (!active) return
    scene.background = null
    const prevColor = gl.getClearColor(new THREE.Color())
    const prevAlpha = gl.getClearAlpha()
    gl.setClearColor(0x000000, 0)
    return () => {
      gl.setClearColor(prevColor, prevAlpha)
    }
  }, [active, gl, scene])
  return null
}

function ApplyProject({ project }) {
  const { gl } = useThree()
  useLayoutEffect(() => {
    applyEarthJsonProjectToRenderer(gl, project || {})
  }, [gl, project])
  return null
}

/** Поверх настроек из экспорта сцены — как прежний configureImmersiveScene (камера/рендерер/свет). */
function ImmersiveOverrides({ enabled, sceneRoot, wideHorizontalFraming }) {
  const { camera, gl, scene } = useThree()
  useLayoutEffect(() => {
    /* R3F/Three: допустимая мутация камеры, рендерера и сцены в рантайме */
    /* eslint-disable react-hooks/immutability -- Three.js objects are mutated by design */
    if (!enabled) return
    if (camera) {
      /* Портретный иммерсив: широкий FOV. Стенд: фикс. FOV в StandHudWidthFit, зум — дистанция. */
      if (!wideHorizontalFraming && !__standFovLocked) {
        logFovOverride('ImmersiveOverrides:immersive-non-stand-fov58')
        camera.fov = 58
      }
      camera.near = Math.min(camera.near, 0.06)
      camera.updateProjectionMatrix()
    }
    if (wideHorizontalFraming) {
      if (gl) gl.shadowMap.enabled = false
      return
    }
    if (gl) {
      gl.toneMapping = THREE.ACESFilmicToneMapping
      gl.toneMappingExposure = 1.1
      if (THREE.SRGBColorSpace && 'outputColorSpace' in gl) {
        gl.outputColorSpace = THREE.SRGBColorSpace
      }
    }
    if (scene && sceneRoot && !sceneRoot.userData.__cdaImmersiveLit) {
      sceneRoot.userData.__cdaImmersiveLit = true
      sceneRoot.traverse((obj) => {
        if (obj.isDirectionalLight) {
          obj.intensity *= 1.3
          obj.position.set(-4.5, 3.2, 2.8)
        }
        if (obj.isAmbientLight) obj.intensity *= 0.72
      })
    }
    if (scene && !scene.userData.__cdaImmersiveHemi) {
      scene.userData.__cdaImmersiveHemi = true
      scene.add(new THREE.HemisphereLight(0x8ec5ff, 0x020814, 0.5))
    }
    /* eslint-enable react-hooks/immutability */
  }, [enabled, camera, gl, scene, sceneRoot, wideHorizontalFraming])
  return null
}

function projectOrbitCenterScreenX(camera, gl, root, orbitTarget, vW) {
  root.updateWorldMatrix(true, false)
  vW.copy(worldOrbitCenter(root, orbitTarget))
  vW.project(camera)
  const rect = gl.domElement.getBoundingClientRect()
  return rect.left + (vW.x * 0.5 + 0.5) * rect.width
}

/**
 * Ширина силуэта шара в пикселях: выборка точек на сфере (локально orbitTarget + polar → world),
 * project → minX/maxX по canvas. vPt / vDelta / vFwd — рабочие векторы без аллокаций.
 */
function measureGlobeHorizontalSpanPxSampled(camera, gl, root, orbitTarget, vPt, vDelta, vFwd) {
  root.updateWorldMatrix(true, false)
  const cw = gl.domElement.getBoundingClientRect().width
  camera.getWorldDirection(vFwd)
  let minX = Infinity
  let maxX = -Infinity
  for (let lat = -88; lat <= 88; lat += 5) {
    for (let lng = 0; lng < 360; lng += 10) {
      vPt.copy(orbitTarget).add(polarToCartesian(lat, lng, 0))
      root.localToWorld(vPt)
      vDelta.copy(vPt).sub(camera.position)
      if (vDelta.dot(vFwd) < 0.02) continue
      vPt.project(camera)
      const sx = (vPt.x * 0.5 + 0.5) * cw
      if (Number.isFinite(sx)) {
        minX = Math.min(minX, sx)
        maxX = Math.max(maxX, sx)
      }
    }
  }
  if (!Number.isFinite(minX) || maxX <= minX) return 0
  return maxX - minX
}

const HUD_FIT_EPS_PX = 1.5

/**
 * Стенд: подгонка **дистанции** камеры под целевую экранную ширину шара (project), FOV постоянный;
 * затем горизонтальное центрирование и сдвиг «купола».
 */
function StandHudWidthFit({ active, root, orbitTarget, invalidate, povRevision = 0 }) {
  const { camera, gl } = useThree()
  const vW = useMemo(() => new THREE.Vector3(), [])
  const vCam = useMemo(() => new THREE.Vector3(), [])
  const vRight = useMemo(() => new THREE.Vector3(), [])
  const lastAppliedRef = useRef({ cx: NaN, rev: -1, layout: -1, targetW: NaN })
  const [canvasLayoutStamp, setCanvasLayoutStamp] = useState(0)

  useLayoutEffect(() => {
    if (!active) {
      __standFovLocked = false
    }
  }, [active])

  useLayoutEffect(() => {
    if (!active || !gl?.domElement) return
    const el = gl.domElement
    const ro = new ResizeObserver(() => setCanvasLayoutStamp((n) => n + 1))
    ro.observe(el)
    return () => ro.disconnect()
  }, [active, gl])

  useLayoutEffect(() => {
    if (!active || !root || !camera?.isPerspectiveCamera || !gl?.domElement) return
    const cr = gl.domElement.getBoundingClientRect()
    const targetCx = cr.left + cr.width / 2 + STAND_HUD_TARGET_CX_OFFSET_PX
    const targetW = cr.width * STAND_GLOBE_WIDTH_OVERSHOOT
    if (!Number.isFinite(cr.width) || cr.width < 80) return

    /* После pointOfView и onStandFitAfterPov — revision ≥ 1 */
    if (povRevision < 1) return

    const prev = lastAppliedRef.current
    if (
      prev.rev === povRevision
      && prev.layout === canvasLayoutStamp
      && Math.abs(prev.cx - targetCx) < HUD_FIT_EPS_PX
      && Math.abs(prev.targetW - targetW) < HUD_FIT_EPS_PX
    ) {
      return
    }
    prev.cx = targetCx
    prev.rev = povRevision
    prev.layout = canvasLayoutStamp
    prev.targetW = targetW

    logFovOverride('StandHudWidthFit:fixed-fov')
    camera.fov = STAND_CAMERA_FOV
    camera.updateProjectionMatrix()

    let wcLift = worldOrbitCenter(root, orbitTarget)
    const centerPov = wcLift.clone()
    vW.subVectors(camera.position, centerPov)
    if (vW.lengthSq() < 1e-10) {
      vW.set(0, 0.2, 1).normalize()
    } else {
      vW.normalize()
    }
    const dirFromPov = vW.clone()

    const widthAtDistance = (dist) => {
      const c = worldOrbitCenter(root, orbitTarget)
      camera.fov = STAND_CAMERA_FOV
      camera.updateProjectionMatrix()
      camera.position.copy(c.clone().addScaledVector(dirFromPov, dist))
      camera.lookAt(c)
      camera.updateProjectionMatrix()
      return measureGlobeHorizontalSpanPxSampled(camera, gl, root, orbitTarget, vW, vCam, vRight)
    }

    let lo = STAND_MIN_CAMERA_DISTANCE
    let hi = GLOBE_RADIUS * 120
    for (let i = 0; i < 35; i++) {
      const mid = (lo + hi) / 2
      const spanPx = widthAtDistance(mid)
      const cIter = worldOrbitCenter(root, orbitTarget)
      const distIter = camera.position.distanceTo(cIter)
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console -- сходимость бинарного поиска по дистанции
        console.log('[STAND FIT ITER]', {
          distance: distIter,
          spanPx,
          targetW,
          error: spanPx - targetW,
          lo,
          hi,
        })
      }
      if (!Number.isFinite(spanPx) || spanPx <= 0) {
        hi = mid
        continue
      }
      if (spanPx < targetW) hi = mid
      else lo = mid
      if (hi - lo < GLOBE_RADIUS * 0.002) break
    }

    const rawBisectDist = (lo + hi) / 2
    let finalDistance =
      rawBisectDist * STAND_POST_FIT_DISTANCE_SCALE * STAND_DISTANCE_FINAL_MUL
    finalDistance = Math.max(STAND_MIN_CAMERA_DISTANCE, finalDistance)
    wcLift = worldOrbitCenter(root, orbitTarget)
    camera.fov = STAND_CAMERA_FOV
    camera.updateProjectionMatrix()
    /* Сначала ставим по известному лучу из POV, затем явное применение как в спецификации */
    camera.position.copy(wcLift.clone().addScaledVector(dirFromPov, finalDistance))
    camera.lookAt(wcLift)
    camera.updateProjectionMatrix()
    const dir = new THREE.Vector3().subVectors(camera.position, wcLift).normalize()
    if (dir.lengthSq() < 1e-12) dir.copy(dirFromPov)
    camera.position.copy(wcLift.clone().add(dir.multiplyScalar(finalDistance)))
    camera.lookAt(wcLift)
    camera.updateProjectionMatrix()

    let finalSpanPx = measureGlobeHorizontalSpanPxSampled(camera, gl, root, orbitTarget, vW, vCam, vRight)
    if (!Number.isFinite(finalSpanPx) || finalSpanPx <= 0) {
      finalDistance = Math.max(STAND_MIN_CAMERA_DISTANCE, STAND_DISTANCE_FALLBACK)
      camera.position.copy(wcLift.clone().addScaledVector(dirFromPov, finalDistance))
      camera.lookAt(wcLift)
      camera.updateProjectionMatrix()
      const dirFb = new THREE.Vector3().subVectors(camera.position, wcLift).normalize()
      if (dirFb.lengthSq() < 1e-12) dirFb.copy(dirFromPov)
      camera.position.copy(wcLift.clone().add(dirFb.multiplyScalar(finalDistance)))
      camera.lookAt(wcLift)
      camera.updateProjectionMatrix()
      finalSpanPx = measureGlobeHorizontalSpanPxSampled(camera, gl, root, orbitTarget, vW, vCam, vRight)
    }

    // eslint-disable-next-line no-console -- итог подбора дистанции (сверка targetW / span)
    console.log('[STAND FIT RESULT]', {
      finalDistance,
      finalSpanPx,
      targetW,
    })

    for (let j = 0; j < 14; j++) {
      wcLift = worldOrbitCenter(root, orbitTarget)
      const cx = projectOrbitCenterScreenX(camera, gl, root, orbitTarget, vCam)
      const err = targetCx - cx
      if (Math.abs(err) < 1.5) break
      vCam.copy(wcLift).sub(camera.position).normalize()
      vRight.crossVectors(vCam, camera.up).normalize()
      camera.position.addScaledVector(vRight, err * 0.0018)
      camera.lookAt(wcLift)
    }

    wcLift = worldOrbitCenter(root, orbitTarget)
    camera.lookAt(wcLift)
    vW.copy(wcLift).sub(camera.position).normalize()
    const worldUp = new THREE.Vector3(0, 1, 0)
    vRight.crossVectors(vW, worldUp)
    if (vRight.lengthSq() < 1e-10) vRight.set(1, 0, 0)
    else vRight.normalize()
    vCam.crossVectors(vRight, vW).normalize()
    camera.position.addScaledVector(vCam, STAND_IMMERSIVE_CAMERA_LIFT + STAND_IMMERSIVE_SCREEN_UP_EXTRA)
    camera.position.y -= STAND_IMMERSIVE_WORLD_Y_PULL
    camera.lookAt(wcLift)

    if (STAND_FORCE_CAMERA_DISTANCE_TEST) {
      const c = worldOrbitCenter(root, orbitTarget)
      const d = new THREE.Vector3().subVectors(camera.position, c).normalize()
      camera.position.copy(c.clone().addScaledVector(d, GLOBE_RADIUS * 1.2))
      camera.lookAt(c)
      camera.updateProjectionMatrix()
      // eslint-disable-next-line no-console -- обязательный тест шага 1
      console.log('FORCED CAMERA DISTANCE MOVE')
    }

    if (STAND_DEBUG_CAMERA_ORIGIN_OVERRIDE) {
      const centerDbg = new THREE.Vector3(0, 0, 0)
      camera.position.set(0, 0, GLOBE_RADIUS * 2.5)
      camera.lookAt(centerDbg)
      camera.updateProjectionMatrix()
      // eslint-disable-next-line no-console -- проверка, что двигается эта камера
      console.log('[STAND DEBUG] camera at origin test (0,0,R*2.5) lookAt 0')
    }

    __standFovLocked = true

    if (import.meta.env.DEV) {
      const cEnd = worldOrbitCenter(root, orbitTarget)
      // eslint-disable-next-line no-console -- итог кадра
      console.log('STAND APPLY', {
        fov: camera.fov,
        distanceToCenter: camera.position.distanceTo(cEnd),
        finalDistance,
        finalSpanPx,
      })
    }

    invalidate()
    // Константы зума в deps — иначе при смене только чисел эффект не перезапускается (HMR / правки).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- invalidate не в deps намеренно
  }, [
    active,
    root,
    orbitTarget,
    canvasLayoutStamp,
    povRevision,
    STAND_GLOBE_WIDTH_OVERSHOOT,
    STAND_CAMERA_FOV,
    STAND_POST_FIT_DISTANCE_SCALE,
    STAND_MIN_CAMERA_DISTANCE,
    STAND_DISTANCE_FINAL_MUL,
    STAND_HUD_TARGET_CX_OFFSET_PX,
  ])

  return null
}

function PulseRing({ lat, lng, innerColor, speed, offset }) {
  const meshRef = useRef(null)
  const matRef = useRef(null)
  const pos = useMemo(() => polarToCartesian(lat, lng, 0.008), [lat, lng])
  const normal = useMemo(() => pos.clone().normalize(), [pos])
  const quat = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal),
    [normal],
  )
  useEffect(() => {
    let raf = 0
    let alive = true
    const tick = () => {
      if (!alive) return
      raf = requestAnimationFrame(tick)
      const t = performance.now() / 1000 * speed + offset
      const phase = (t % 1.4) / 1.4
      const s = 0.25 + phase * 1.1
      if (meshRef.current) meshRef.current.scale.setScalar(s)
      if (matRef.current) matRef.current.opacity = 0.42 * (1 - phase)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [speed, offset])
  return (
    <mesh ref={meshRef} position={pos} quaternion={quat}>
      <ringGeometry args={[0.12, 0.55, 40]} />
      <meshBasicMaterial
        ref={matRef}
        color={innerColor}
        transparent
        opacity={0.4}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

function BudgetPolygon({ outerRing, capColor, altitude, visible }) {
  const geom = useMemo(() => {
    if (!outerRing || outerRing.length < 3) return null
    const alt = altitude
    const pts = outerRing.map(([lng, lat]) => polarToCartesian(lat, lng, alt))
    const positions = []
    const n = pts.length
    const o = pts[0]
    for (let i = 1; i < n - 1; i++) {
      positions.push(o.x, o.y, o.z, pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.computeVertexNormals()
    return g
  }, [outerRing, altitude])

  const capMat = useMemo(() => {
    const c = new THREE.Color()
    c.set(capColor)
    return new THREE.MeshPhongMaterial({
      color: c,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  }, [capColor])

  if (!geom || !visible) return null
  return <mesh geometry={geom} material={capMat} />
}

function ArrowHead({ endLat, endLng, startLat, startLng, hovered, onPointerOver, onPointerOut }) {
  const end = useMemo(() => polarToCartesian(endLat, endLng, 0), [endLat, endLng])
  const start = useMemo(() => polarToCartesian(startLat, startLng, 0), [startLat, startLng])
  const dir = useMemo(() => end.clone().sub(start).normalize(), [end, start])
  const quat = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir),
    [dir],
  )
  const pos = useMemo(() => end.clone().addScaledVector(dir, 0.35), [end, dir])
  return (
    <mesh
      position={pos}
      quaternion={quat}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <coneGeometry args={[0.5, 1.5, 10, 1]} />
      <meshBasicMaterial color={hovered ? '#f97316' : '#22d3ee'} />
    </mesh>
  )
}

function GlobeScene({
  loaded,
  immersiveBackground,
  immersiveStandLayout,
  standPovRevision = 0,
  onStandFitAfterPov,
  immersiveEuler,
  polarLimits,
  orbitTarget,
  apiRef,
  readyFiredRef,
  onReady,
  mapPointsData,
  arcsData,
  showCFArrows,
  showBudgetFill,
  budgetZoneFeatures,
  polygonCapColor,
  selectedAssetId,
  hoveredAssetId,
  hoveredArcIndex,
  keyAssetIds,
  ringsData,
  onPointClick,
  onPointHover,
  onArcHover,
}) {
  const orbitRef = useRef(null)
  const orbitTargetRef = useRef(orbitTarget.clone())
  const standSpinGroupRef = useRef(null)
  const { camera, gl, scene, invalidate } = useThree()

  const standWorldOffsetY = immersiveStandLayout ? IMMERSIVE_STAND_WORLD_OFFSET_Y : 0
  orbitTargetRef.current.copy(orbitTarget)

  const root = loaded.sceneRoot

  /* OrbitControls.target — в мировых координатах (учёт group rotation + сдвиг стенда). */
  useFrame(() => {
    const c = orbitRef.current
    if (!c || !root) return
    const wc = worldOrbitCenter(root, orbitTarget)
    c.target.copy(wc)
  })

  useEffect(() => {
    apiRef.current.camera = camera
    apiRef.current.gl = gl
    apiRef.current.scene = scene
    apiRef.current.controls = () => orbitRef.current
    apiRef.current.getCoords = (lat, lng, alt) => {
      const v = polarToCartesian(lat, lng, alt ?? 0)
      return { x: v.x, y: v.y, z: v.z }
    }
    apiRef.current.orbitTarget = orbitTarget.clone()
    apiRef.current.pointOfView = (...args) => {
      if (args.length === 0) {
        const cam = apiRef.current.camera
        if (!cam?.position || !root) return { lat: 0, lng: 0, altitude: 1 }
        const camLoc = cam.position.clone()
        root.worldToLocal(camLoc)
        const rel = camLoc.sub(orbitTargetRef.current)
        return cartesianToGeo(rel)
      }
      const [pov] = args
      const lat = pov?.lat ?? 50
      const lng = pov?.lng ?? 60
      const alt = Number.isFinite(pov?.altitude) ? pov.altitude : 0.88
      const wc = worldOrbitCenter(root, orbitTarget)
      const camW = worldCameraPosition(root, orbitTarget, lat, lng, alt)
      camera.position.copy(camW)
      camera.lookAt(wc)
      if (import.meta.env.DEV && immersiveStandLayout && args.length > 0) {
        // eslint-disable-next-line no-console -- диагностика после pointOfView (стенд)
        console.log('CAMERA DEBUG', {
          fov: camera.fov,
          distance: camera.position.length(),
          distanceToOrbit: camera.position.distanceTo(wc),
          altitudeArg: alt,
        })
      }
      if (orbitRef.current) {
        orbitRef.current.target.copy(wc)
        /* Стенд: не вызывать update() — OrbitControls может пересобрать внутреннее состояние и сбить камеру после StandHudWidthFit */
        if (!immersiveStandLayout) {
          orbitRef.current.update()
        }
      }
      apiRef.current.orbitTarget = wc.clone()
      /* standFitRevision ≥ 1 — иначе StandHudWidthFit всегда выходит на povRevision < 1 */
      if (immersiveStandLayout && onStandFitAfterPov) {
        onStandFitAfterPov()
      }
    }
  }, [apiRef, camera, gl, scene, orbitTarget, root, immersiveStandLayout, onStandFitAfterPov])

  useEffect(() => {
    if (readyFiredRef.current) return
    const id = requestAnimationFrame(() => {
      if (readyFiredRef.current) return
      readyFiredRef.current = true
      onReady?.()
    })
    return () => cancelAnimationFrame(id)
  }, [onReady, readyFiredRef])

  const { polarLo, polarHi } = polarLimits

  return (
    <>
      <StandGlobeYawSpin
        active={!!immersiveStandLayout}
        spinGroupRef={standSpinGroupRef}
        earthRoot={root}
        gl={gl}
        invalidate={invalidate}
      />
      <ApplyProject project={loaded.full?.project} />
      {immersiveBackground ? (
        <ImmersiveOverrides
          enabled
          sceneRoot={loaded.sceneRoot}
          wideHorizontalFraming={!!immersiveStandLayout}
        />
      ) : null}
      {immersiveStandLayout ? <StandTransparentScene active /> : null}
      {immersiveStandLayout ? (
        <StandHudWidthFit
          active
          root={root}
          orbitTarget={orbitTarget}
          invalidate={invalidate}
          povRevision={standPovRevision}
        />
      ) : null}
      {immersiveBackground && !immersiveStandLayout ? <EquirectBackground url={STARFIELD_URL} /> : null}
      <ambientLight intensity={immersiveBackground && immersiveStandLayout ? 0.52 : immersiveBackground ? 0.2 : 0.35} />
      {immersiveBackground && !immersiveStandLayout ? (
        <Stars radius={420} depth={80} count={6000} factor={3} fade speed={0.3} />
      ) : null}
      <group rotation={immersiveEuler}>
        <group position={[0, standWorldOffsetY, 0]}>
        <group ref={standSpinGroupRef}>
        <primitive object={loaded.sceneRoot} />
        {budgetZoneFeatures.map((feat, i) => {
          const g = feat?.geometry
          if (!g || g.type !== 'Polygon') return null
          const outer = g.coordinates?.[0]
          if (!outer?.length) return null
          return (
            <BudgetPolygon
              key={feat.id ?? i}
              outerRing={outer}
              capColor={polygonCapColor(feat)}
              altitude={showBudgetFill ? 0.012 : 0.01}
              visible={showBudgetFill}
            />
          )
        })}
        {mapPointsData.map((p) => (
          <mesh
            key={p.id}
            position={polarToCartesian(p.lat, p.lon, 0)}
            onClick={(e) => {
              e.stopPropagation()
              onPointClick?.(p)
            }}
            onPointerOver={(e) => {
              e.stopPropagation()
              onPointHover?.(p)
            }}
            onPointerOut={(e) => {
              e.stopPropagation()
              onPointHover?.(null)
            }}
          >
            <sphereGeometry args={[
              selectedAssetId === p.id ? 0.32 : hoveredAssetId === p.id ? 0.29 : 0.22,
              10,
              10,
            ]}
            />
            <meshStandardMaterial
              color={selectedAssetId === p.id
                ? '#22d3ee'
                : hoveredAssetId === p.id
                  ? '#38bdf8'
                  : keyAssetIds.has(p.id)
                    ? '#ef4444'
                    : '#0ea5e9'}
              emissive={selectedAssetId === p.id ? '#0891b2' : '#000000'}
              emissiveIntensity={0.25}
              metalness={0.2}
              roughness={0.45}
            />
          </mesh>
        ))}
        {ringsData.map((d) => (
          <PulseRing
            key={`${d.id}-${d.__ringIdx}`}
            lat={d.lat}
            lng={d.lon}
            innerColor={keyAssetIds.has(d.id) ? '#ef4444' : '#22d3ee'}
            speed={d.__ringIdx === 0 ? 1.15 : 0.95}
            offset={d.__ringIdx * 0.55}
          />
        ))}
        {showCFArrows && arcsData.map((a, idx) => {
          const pts = greatCirclePoints(a.startLat, a.startLng, a.endLat, a.endLng)
          const col = idx === hoveredArcIndex ? '#f97316' : '#22d3ee'
          return (
            <group key={idx}>
              <Line points={pts} color={col} lineWidth={1.2} />
              <ArrowHead
                endLat={a.endLat}
                endLng={a.endLng}
                startLat={a.startLat}
                startLng={a.startLng}
                hovered={idx === hoveredArcIndex}
                onPointerOver={() => onArcHover?.(a)}
                onPointerOut={() => onArcHover?.(null)}
              />
            </group>
          )
        })}
        </group>
        </group>
      </group>
      {/* Стенд: enabled=false — не двигает камеру; target всё равно синхронизируется в useFrame для API */}
      <OrbitControls
        ref={orbitRef}
        makeDefault
        target={[0, 0, 0]}
        enabled={!immersiveStandLayout}
        enablePan={false}
        enableZoom={!immersiveStandLayout}
        enableRotate={!immersiveStandLayout}
        minPolarAngle={polarLo}
        maxPolarAngle={polarHi}
        minAzimuthAngle={-Infinity}
        maxAzimuthAngle={Infinity}
      />
    </>
  )
}

const EarthJsonGlobeCanvas = forwardRef(function EarthJsonGlobeCanvas(
  {
    width,
    height,
    immersiveBackground,
    immersiveStandLayout,
    immersivePitchXDeg,
    immersiveYawZDeg,
    immersivePolarExtraDeg,
    mapPointsData,
    arcsData,
    showCFArrows,
    showBudgetFill,
    budgetZoneFeatures,
    polygonCapColor,
    selectedAssetId,
    hoveredAssetId,
    hoveredArcIndex,
    keyAssetIds,
    ringsData,
    onPointClick,
    onPointHover,
    onArcHover,
    jsonUrl,
    onLoadError,
    onReady,
    dprCap = 1.25,
    standPovRevision = 0,
    onStandFitAfterPov,
  },
  ref,
) {
  const apiRef = useRef({
    camera: null,
    gl: null,
    scene: null,
    controls: () => null,
    getCoords: () => ({ x: 0, y: 0, z: 0 }),
    pointOfView: () => ({ lat: 0, lng: 0, altitude: 0 }),
    orbitTarget: new THREE.Vector3(),
  })
  const readyFiredRef = useRef(false)

  const [loaded, setLoaded] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let cancelled = false
    setErr(null)
    readyFiredRef.current = false
    loadEarthJsonFull(jsonUrl)
      .then((data) => {
        if (!cancelled) setLoaded(data)
      })
      .catch((e) => {
        if (!cancelled) {
          setErr(e)
          onLoadError?.(e)
        }
      })
    return () => {
      cancelled = true
    }
  }, [jsonUrl, onLoadError])

  useImperativeHandle(ref, () => ({
    camera: () => apiRef.current.camera,
    renderer: () => apiRef.current.gl,
    scene: () => apiRef.current.scene,
    controls: () => apiRef.current.controls(),
    getCoords: (lat, lng, alt) => apiRef.current.getCoords(lat, lng, alt),
    pointOfView: (...args) => apiRef.current.pointOfView(...args),
  }))

  const immersiveEuler = useMemo(() => {
    if (!immersiveBackground) return new THREE.Euler(0, 0, 0)
    const ex = THREE.MathUtils.degToRad(immersivePitchXDeg)
    const ez = THREE.MathUtils.degToRad(immersiveYawZDeg)
    return new THREE.Euler(ex, 0, ez, 'YXZ')
  }, [immersiveBackground, immersivePitchXDeg, immersiveYawZDeg])

  const polarLimits = useMemo(() => {
    const polarLo = 0.04
    const polarHi = Math.PI - 0.04
    if (immersiveBackground) {
      const extra = THREE.MathUtils.degToRad(immersivePolarExtraDeg || 0)
      return { polarLo: polarLo + extra, polarHi: polarHi + extra }
    }
    return { polarLo, polarHi }
  }, [immersiveBackground, immersivePolarExtraDeg])

  const setPixelRatio = useCallback(
    (gl) => {
      if (!gl?.setPixelRatio) return
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
      const cap = immersiveBackground ? Math.min(2, dprCap) : Math.min(dprCap, dpr)
      gl.setPixelRatio(cap)
    },
    [immersiveBackground, dprCap],
  )

  if (err) {
    return (
      <div className="globe-error" style={{ width, height: Math.max(240, height) }}>
        Не удалось загрузить сцену Земли: {String(err?.message || err)}
      </div>
    )
  }

  const standNoSky = !!immersiveStandLayout

  if (!loaded) {
    return (
      <div
        className="globe-earth-loading globe-earth-loading--silent"
        style={{
          width,
          height: Math.max(240, height),
          background: standNoSky ? 'transparent' : '#020617',
        }}
        aria-busy="true"
      />
    )
  }

  const canvasCssBg = standNoSky ? 'transparent' : immersiveBackground ? '#020617' : undefined

  return (
    <Canvas
      style={{ width, height: Math.max(240, height), display: 'block', background: canvasCssBg }}
      camera={{
        position: [0, 0, 280],
        near: 0.05,
        far: 1e7,
        fov: standNoSky ? 60 : 50,
      }}
      gl={{ antialias: true, alpha: true, powerPreference: immersiveBackground ? 'high-performance' : 'low-power' }}
      onCreated={({ gl, scene }) => {
        setPixelRatio(gl)
        if (standNoSky) {
          gl.setClearColor(0x000000, 0)
          scene.background = null
        }
      }}
      dpr={[1, immersiveBackground ? 2 : 1.25]}
    >
      <GlobeScene
        loaded={loaded}
        immersiveBackground={immersiveBackground}
        immersiveStandLayout={immersiveStandLayout}
        standPovRevision={standPovRevision}
        onStandFitAfterPov={onStandFitAfterPov}
        immersiveEuler={immersiveEuler}
        polarLimits={polarLimits}
        orbitTarget={loaded.orbitTarget}
        apiRef={apiRef}
        readyFiredRef={readyFiredRef}
        onReady={onReady}
        mapPointsData={mapPointsData}
        arcsData={arcsData}
        showCFArrows={showCFArrows}
        showBudgetFill={showBudgetFill}
        budgetZoneFeatures={budgetZoneFeatures}
        polygonCapColor={polygonCapColor}
        selectedAssetId={selectedAssetId}
        hoveredAssetId={hoveredAssetId}
        hoveredArcIndex={hoveredArcIndex}
        keyAssetIds={keyAssetIds}
        ringsData={ringsData}
        onPointClick={onPointClick}
        onPointHover={onPointHover}
        onArcHover={onArcHover}
      />
    </Canvas>
  )
})

export default EarthJsonGlobeCanvas
