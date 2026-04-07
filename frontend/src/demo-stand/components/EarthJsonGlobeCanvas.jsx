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
  loadEarthGlobeScene,
} from '../lib/loadEarthJsonFull'
import {
  GLOBE_RADIUS,
  cartesianToGeo,
  polarToCameraPosition,
  polarToCartesian,
} from '../lib/globePolar'

const STARFIELD_URL = 'https://unpkg.com/three-globe@2.45.1/example/img/night-sky.png'

/** Все оверлеи (точки/кольца) чуть над поверхностью, чтобы не ловить z-fighting с мешем Земли. */
const SURFACE_REL_ALT = 0.002
/** Дуга чуть выше поверхности; соответствует greatCirclePoints: GLOBE_RADIUS * 1.003. */
const ARC_REL_ALT = 0.003
/** Дефолтная дистанция камеры для initial Canvas + pointOfView без altitude. */
const DEFAULT_CAMERA_DISTANCE = GLOBE_RADIUS * 3
/** `altitude` в API — относительная (как three-globe): dist = R * (1 + altitude). */
const DEFAULT_POV_ALTITUDE = DEFAULT_CAMERA_DISTANCE / GLOBE_RADIUS - 1

/** Референс stand-face: широкий FOV, чтобы при сильном pitch не резался купол. */
const STAND_DOME_CAMERA_FOV = 25
/**
 * Сдвиг корня Земли по локальному Y (с орбитой камеры частично «съезжает» вместе — см. pitch + CSS padding).
 */
const STAND_EARTH_SHIFT_Y_FACTOR = -2.5
/** Сильный наклон: широкая часть диска и «пояс» к нижней трети canvas. */
const STAND_DOME_PITCH_DEG = 3

const CAMERA_Y_OFFSET = -GLOBE_RADIUS * -0.4

const standDomePitchScratch = {
  view: new THREE.Vector3(),
  horiz: new THREE.Vector3(),
  offset: new THREE.Vector3(),
}

function worldOrbitCenter(root, orbitTargetLocal) {
  const wc = orbitTargetLocal.clone()
  root.updateWorldMatrix(true, true)
  root.localToWorld(wc)

   wc.y += CAMERA_Y_OFFSET

  return wc
}

/** Камера: локально orbitTarget + polar offset, затем в мир (учитывает immersiveEuler и сдвиг стенда). */
function worldCameraPosition(root, orbitTargetLocal, lat, lng, alt) {
  const p = polarToCameraPosition(lat, lng, alt)
  const camLocal = orbitTargetLocal.clone().add(p)

  camLocal.y += CAMERA_Y_OFFSET

  root.updateWorldMatrix(true, true)
  root.localToWorld(camLocal)
  return camLocal
}

/** Стенд: мировой «верх» = север (ось Y сцены); не меняет position, только ориентацию камеры. */
function applyStandCameraNorthUp(camera, wc) {
  if (!camera?.isPerspectiveCamera || !wc) return
  camera.up.set(0, 1, 0)
  camera.lookAt(wc)
  camera.updateProjectionMatrix()
}

/** Стенд: north-up + вертикальный pitch (экватор к нижнему краю viewport). */
function applyStandDomeCameraFrame(camera, wc) {
  if (!camera?.isPerspectiveCamera || !wc) return
  applyStandCameraNorthUp(camera, wc)
  if (STAND_DOME_PITCH_DEG === 0) return
  const { view, horiz, offset } = standDomePitchScratch
  view.copy(camera.position).sub(wc)
  const dist = view.length()
  if (dist < 1e-6) return
  view.multiplyScalar(1 / dist)
  horiz.crossVectors(camera.up, view)
  if (horiz.lengthSq() < 1e-12) return
  horiz.normalize()
  offset.copy(camera.position).sub(wc)
  offset.applyAxisAngle(horiz, THREE.MathUtils.degToRad(STAND_DOME_PITCH_DEG))
  camera.position.copy(wc).add(offset)
  applyStandCameraNorthUp(camera, wc)
}

/** Полный кадр стенда: позиция из lat/lng/alt + pitch (вызывать при resize, чтобы не «залипал» lookAt без pitch). */
function setStandDomeCameraFromPov(camera, root, orbitTarget, lat, lng, alt) {
  if (!camera?.isPerspectiveCamera || !root) return
  const wc = worldOrbitCenter(root, orbitTarget)
  camera.position.copy(worldCameraPosition(root, orbitTarget, lat, lng, alt))
  applyStandDomeCameraFrame(camera, wc)
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
    invMw: new THREE.Matrix4(),
  })
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
      /* Портретный иммерсив: широкий FOV. Стенд: FOV задаёт StandDomeCamera (STAND_DOME_CAMERA_FOV). */
      if (!wideHorizontalFraming) {
        camera.fov = 58
      }
      camera.near = Math.min(camera.near, 0.06)
      camera.updateProjectionMatrix()
    }
    if (wideHorizontalFraming) {
      if (gl) gl.shadowMap.enabled = false
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

/** ?demo=stand#face: фиксированный FOV и север вверх после pointOfView; resize — повторная привязка. */
function StandDomeCamera({ active, root, orbitTarget, standPov, standEarthLiftY, invalidate }) {
  const { camera, gl } = useThree()
  const [resizeStamp, setResizeStamp] = useState(0)

  useLayoutEffect(() => {
    if (!active || !gl?.domElement) return
    const el = gl.domElement
    const ro = new ResizeObserver(() => setResizeStamp((n) => n + 1))
    ro.observe(el)
    return () => ro.disconnect()
  }, [active, gl])

  useLayoutEffect(() => {
    if (!active || !root || !camera?.isPerspectiveCamera) return
    camera.fov = STAND_DOME_CAMERA_FOV
    camera.updateProjectionMatrix()
    const wc = worldOrbitCenter(root, orbitTarget)
    if (standPov && Number.isFinite(standPov.lat) && Number.isFinite(standPov.lng) && Number.isFinite(standPov.altitude)) {
      setStandDomeCameraFromPov(camera, root, orbitTarget, standPov.lat, standPov.lng, standPov.altitude)
    } else {
      applyStandCameraNorthUp(camera, wc)
    }
    invalidate()
  }, [
    active,
    root,
    orbitTarget,
    camera,
    invalidate,
    resizeStamp,
    standEarthLiftY,
    standPov?.lat,
    standPov?.lng,
    standPov?.altitude,
    STAND_DOME_CAMERA_FOV,
    STAND_DOME_PITCH_DEG,
  ])

  return null
}

function PulseRing({ lat, lng, innerColor, speed, offset }) {
  const meshRef = useRef(null)
  const matRef = useRef(null)
  const basePos = useMemo(() => {
    return polarToCartesian(lat, lng, 0)
  }, [lat, lng])

  const pos = useMemo(() => {
    return polarToCartesian(lat, lng, SURFACE_REL_ALT)
  }, [lat, lng])
  
  const normal = useMemo(() => {
    return basePos.clone().normalize()
  }, [basePos])

  const quat = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal),
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
  const end = useMemo(() => polarToCartesian(endLat, endLng, ARC_REL_ALT), [endLat, endLng])
  const start = useMemo(() => polarToCartesian(startLat, startLng, ARC_REL_ALT), [startLat, startLng])
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
  standCameraPov,
}) {
  const orbitRef = useRef(null)
  const orbitTargetRef = useRef(orbitTarget.clone())
  const standSpinGroupRef = useRef(null)
  const { camera, gl, scene, invalidate } = useThree()

  /* Стенд: сдвиг шара по мировому Y — в паре с applyStandDomeCameraFrame (экватор к низу полосы). */
  const standEarthLiftY = immersiveStandLayout ? GLOBE_RADIUS * STAND_EARTH_SHIFT_Y_FACTOR : 0
  orbitTargetRef.current.copy(orbitTarget)

  const root = loaded.sceneRoot

  const normalizedRef = useRef(false)

  useEffect(() => {
  if (!root || normalizedRef.current) return

  let maxRadius = 0

  root.traverse((obj) => {
    if (obj.isMesh && obj.geometry?.attributes?.position) {
      const pos = obj.geometry.attributes.position

      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i)
        const y = pos.getY(i)
        const z = pos.getZ(i)

        const r = Math.sqrt(x * x + y * y + z * z)
        if (r > maxRadius) maxRadius = r
      }
    }
  })

  if (maxRadius === 0) return

  const scale = GLOBE_RADIUS / maxRadius
  root.scale.setScalar(scale)

  normalizedRef.current = true
}, [root])

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
      const alt = Number.isFinite(pov?.altitude) ? pov.altitude : DEFAULT_POV_ALTITUDE
      const wc = worldOrbitCenter(root, orbitTarget)
      if (immersiveStandLayout) {
        setStandDomeCameraFromPov(camera, root, orbitTarget, lat, lng, alt)
      } else {
        camera.position.copy(worldCameraPosition(root, orbitTarget, lat, lng, alt))
        camera.lookAt(wc)
      }
      if (orbitRef.current) {
        orbitRef.current.target.copy(wc)
        if (!immersiveStandLayout) {
          orbitRef.current.update()
        }
      }
      apiRef.current.orbitTarget = wc.clone()
    }
  }, [apiRef, camera, gl, scene, orbitTarget, root, immersiveStandLayout])

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
        <StandDomeCamera
          active
          root={root}
          orbitTarget={orbitTarget}
          standPov={standCameraPov}
          standEarthLiftY={standEarthLiftY}
          invalidate={invalidate}
        />
      ) : null}
      {immersiveBackground && !immersiveStandLayout ? <EquirectBackground url={STARFIELD_URL} /> : null}
      <ambientLight intensity={immersiveBackground && immersiveStandLayout ? 0.52 : immersiveBackground ? 0.2 : 0.35} />
      {immersiveBackground && !immersiveStandLayout ? (
        <Stars radius={420} depth={80} count={6000} factor={3} fade speed={0.3} />
      ) : null}
      <group rotation={immersiveEuler}>
        <group position={[0, standEarthLiftY, 0]}>
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
            position={polarToCartesian(
              p.lat,
              p.lon,
              SURFACE_REL_ALT
            )}
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
    globeTextureUrl,
    onLoadError,
    onReady,
    dprCap = 1.25,
    /** Стенд: дефолтный POV для камеры при каждом resize (иначе сдвиг/pitch не переустанавливаются). */
    standCameraPov,
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

  const resolvedGlobeTextureUrl = useMemo(() => {
    if (globeTextureUrl) return globeTextureUrl
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
    return `${base}/earth-globe-equirect.jpg`
  }, [globeTextureUrl])

  useEffect(() => {
    let cancelled = false
    setErr(null)
    readyFiredRef.current = false
    loadEarthGlobeScene(resolvedGlobeTextureUrl)
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
  }, [resolvedGlobeTextureUrl, onLoadError])

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
    const errMinH = immersiveStandLayout ? 160 : 240
    return (
      <div className="globe-error" style={{ width, height: Math.max(errMinH, height) }}>
        Не удалось загрузить сцену Земли: {String(err?.message || err)}
      </div>
    )
  }

  const standNoSky = !!immersiveStandLayout
  const layoutMinCanvasH = immersiveStandLayout ? 160 : 240

  if (!loaded) {
    return (
      <div
        className="globe-earth-loading globe-earth-loading--silent"
        style={{
          width,
          height: Math.max(layoutMinCanvasH, height),
          background: standNoSky ? 'transparent' : '#020617',
        }}
        aria-busy="true"
      />
    )
  }

  const canvasCssBg = standNoSky ? 'transparent' : immersiveBackground ? '#020617' : undefined

  return (
    <Canvas
      style={{ width, height: Math.max(layoutMinCanvasH, height), display: 'block', background: canvasCssBg }}
      camera={{
        position: [0, 0, DEFAULT_CAMERA_DISTANCE],
        near: 0.05,
        far: 1e7,
        fov: standNoSky ? STAND_DOME_CAMERA_FOV : 50,
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
        standCameraPov={standCameraPov}
      />
    </Canvas>
  )
})

export default EarthJsonGlobeCanvas
