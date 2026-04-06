import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
import './DigitalBrain.css'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing'
import * as THREE from 'three'

/** Плотность облака точек: меньше вершин = меньше нагрузка на CPU в useFrame */
const ROWS = 44
const COLS = 72

function buildBlobSurface() {
  const points = []
  for (let r = 0; r < ROWS; r += 1) {
    const v = r / (ROWS - 1)
    const phi = v * Math.PI
    const sinPhi = Math.sin(phi)
    const cosPhi = Math.cos(phi)
    for (let c = 0; c < COLS; c += 1) {
      const u = c / COLS
      const theta = u * Math.PI * 2
      const sx = Math.sin(theta)
      const cx = Math.cos(theta)

      const baseRadius = 1.16
      const fold1 = Math.sin(theta * 2.1 + phi * 1.45) * 0.11
      const fold2 = Math.cos(theta * 1.65 - phi * 2.4) * 0.08
      const lowerBulge = Math.max(0, v - 0.54) * 0.42
      const radius = baseRadius + fold1 + fold2 + lowerBulge

      points.push({
        base: new THREE.Vector3(
          radius * sinPhi * cx,
          radius * cosPhi * 0.82,
          radius * sinPhi * sx
        ),
        v,
        phase: (theta * 0.77 + phi * 0.63) % (Math.PI * 2),
      })
    }
  }
  return points
}

function toPositions(points) {
  const out = new Float32Array(points.length * 3)
  points.forEach((p, i) => {
    out[i * 3] = p.base.x
    out[i * 3 + 1] = p.base.y
    out[i * 3 + 2] = p.base.z
  })
  return out
}

function toColors(points) {
  const out = new Float32Array(points.length * 3)
  points.forEach((p, i) => {
    const lower = Math.max(0, (p.v - 0.58) / 0.42)
    // Нижняя «шапка» яйца: насыщенный переход к верху (поверх идёт слой белой базы)
    const c1 = new THREE.Color().setHSL(0.55, 0.95, 0.72)
    const c2 = new THREE.Color().setHSL(0.83, 1, 0.82)
    const c = c1.lerp(c2, lower * 0.75)
    out[i * 3] = c.r
    out[i * 3 + 1] = c.g
    out[i * 3 + 2] = c.b
  })
  return out
}

/** Яркая белая основа под цветным слоем (>1 для сильного вклада в additive + bloom). */
function toBaseWhiteColors(pointCount) {
  const out = new Float32Array(pointCount * 3)
  for (let i = 0; i < pointCount; i += 1) {
    const j = i * 3
    out[j] = 1.55
    out[j + 1] = 1.58
    out[j + 2] = 1.65
  }
  return out
}

/** Линейная интерполяция цвета в HSL по кратчайшему пути по оттенку (плавный синий → бирюза → зелёный). */
function lerpColorHSLShort(out, cFrom, cTo, t) {
  const a = { h: 0, s: 0, l: 0 }
  const b = { h: 0, s: 0, l: 0 }
  cFrom.getHSL(a)
  cTo.getHSL(b)
  let dh = b.h - a.h
  if (dh > 0.5) dh -= 1
  if (dh < -0.5) dh += 1
  const h = (a.h + dh * t + 1) % 1
  const s = a.s + (b.s - a.s) * t
  const l = a.l + (b.l - a.l) * t
  out.setHSL(h, s, l)
}

const BrightBlob = memo(function BrightBlob({ isThinking }) {
  const pointsRef = useRef(null)
  const pointsBaseRef = useRef(null)
  const glowRef = useRef(null)
  const groupRef = useRef(null)
  const matRef = useRef(null)
  const keyLightRef = useRef(null)
  const fillLightRef = useRef(null)

  const pts = useMemo(() => buildBlobSurface(), [])
  const positions = useMemo(() => toPositions(pts), [pts])
  const colors = useMemo(() => toColors(pts), [pts])
  const baseWhiteColors = useMemo(() => toBaseWhiteColors(pts.length), [pts.length])

  /** 0 = «думает» (яркий синий), 1 = готово (зелёный); сглаживается во времени */
  const moodBlendRef = useRef(isThinking ? 0 : 1)

  const thinking = useMemo(() => new THREE.Color().setHSL(0.58, 1, 0.52), [])
  const done = useMemo(() => new THREE.Color().setHSL(0.37, 1, 0.52), [])
  const keyThinking = useMemo(() => new THREE.Color().setHSL(0.57, 1, 0.55), [])
  const keyDone = useMemo(() => new THREE.Color().setHSL(0.36, 1, 0.55), [])
  const fillThinking = useMemo(() => new THREE.Color().setHSL(0.72, 0.55, 0.62), [])
  const fillDone = useMemo(() => new THREE.Color().setHSL(0.44, 0.72, 0.62), [])
  const scratchKey = useMemo(() => new THREE.Color(), [])
  const scratchFill = useMemo(() => new THREE.Color(), [])
  /** Обновляем сетку вершин не каждый кадр — основная стоимость CPU */
  const vertexFrameRef = useRef(0)

  const state = useRef(null)
  if (state.current === null) {
    state.current = {
      color: new THREE.Color().copy(isThinking ? thinking : done),
      pulse: 0.06,
      spin: 0.45,
      wobble: 0.06,
    }
  }

  useFrame((_, delta) => {
    const targetMood = isThinking ? 0 : 1
    const moodRate = Math.min(1, delta * 0.95)
    moodBlendRef.current += (targetMood - moodBlendRef.current) * moodRate
    const u = moodBlendRef.current

    lerpColorHSLShort(state.current.color, thinking, done, u)

    const targetPulse = isThinking ? 0.06 : 0.018
    const targetSpin = isThinking ? 0.45 : 0.12
    const targetWobble = isThinking ? 0.06 : 0.02

    state.current.pulse += (targetPulse - state.current.pulse) * Math.min(1, delta * 1.8)
    state.current.spin += (targetSpin - state.current.spin) * Math.min(1, delta * 1.6)
    state.current.wobble += (targetWobble - state.current.wobble) * Math.min(1, delta * 1.8)

    const t = performance.now() * 0.001

    if (keyLightRef.current) {
      lerpColorHSLShort(scratchKey, keyThinking, keyDone, u)
      keyLightRef.current.color.copy(scratchKey)
    }
    if (fillLightRef.current) {
      lerpColorHSLShort(scratchFill, fillThinking, fillDone, u)
      fillLightRef.current.color.copy(scratchFill)
    }

    if (groupRef.current) {
      groupRef.current.rotation.z += delta * state.current.spin
      groupRef.current.rotation.y += delta * (state.current.spin * 0.24)
      const s = 1 + Math.sin(t * 2.1) * state.current.pulse
      groupRef.current.scale.set(1.08 * s, 0.9 * s, 1.06 * s)
    }

    if (pointsRef.current) {
      vertexFrameRef.current += 1
      if (vertexFrameRef.current % 2 === 0) {
        const arr = pointsRef.current.geometry.attributes.position.array
        const wob = state.current.wobble
        for (let i = 0; i < pts.length; i += 1) {
          const p = pts[i]
          const noise = Math.sin(t * 1.75 + p.phase + p.base.x * 0.8 + p.base.z * 0.6)
          const n = 1 + noise * wob
          const idx = i * 3
          arr[idx] = p.base.x * n
          arr[idx + 1] = p.base.y * n
          arr[idx + 2] = p.base.z * n
        }
        pointsRef.current.geometry.attributes.position.needsUpdate = true
      }
    }

    if (matRef.current && glowRef.current) {
      matRef.current.color.copy(state.current.color)
      matRef.current.opacity = 1 - u * 0.06
      glowRef.current.material.color.copy(state.current.color)
      glowRef.current.material.opacity = 0.62 - u * 0.16
    }
  })

  return (
    <>
      <pointLight ref={keyLightRef} position={[3.5, 3.2, 4]} intensity={3.2} />
      <pointLight ref={fillLightRef} position={[-2.5, -2.2, -2]} intensity={1.15} />
      <group ref={groupRef}>
        <points ref={pointsBaseRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
            <bufferAttribute attach="attributes-color" array={baseWhiteColors} count={baseWhiteColors.length / 3} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial
            color="#ffffff"
            size={0.112}
            vertexColors
            transparent
            opacity={1}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            sizeAttenuation={false}
          />
        </points>
        <points ref={pointsRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
            <bufferAttribute attach="attributes-color" array={colors} count={colors.length / 3} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial
            ref={matRef}
            size={0.1}
            vertexColors
            transparent
            opacity={1}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            sizeAttenuation={false}
          />
        </points>
        <mesh ref={glowRef}>
          <sphereGeometry args={[1.74, 28, 28]} />
          <meshBasicMaterial transparent opacity={0.62} color="#9ce7ff" side={THREE.BackSide} />
        </mesh>
      </group>
    </>
  )
})

const PROGRESS_SMOOTH = 0.11

function DigitalBrainProgressLabel({ targetPercent }) {
  const target = Math.max(0, Math.min(100, Number(targetPercent)))
  const targetRef = useRef(target)
  const displayRef = useRef(target)
  const [display, setDisplay] = useState(target)
  targetRef.current = target

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const t = targetRef.current
      let d = displayRef.current
      if (Math.abs(t - d) < 0.02) {
        if (d !== t) {
          d = t
          displayRef.current = d
          setDisplay(d)
        }
      } else {
        d += (t - d) * PROGRESS_SMOOTH
        displayRef.current = d
        setDisplay(d)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="digital-brain-progress-overlay" aria-live="polite">
      <span className="digital-brain-progress-value">{Math.round(display)}%</span>
    </div>
  )
}

function DigitalBrain({ isThinking = true, graphProgressPercent = null }) {
  const showProgress = graphProgressPercent != null && Number.isFinite(graphProgressPercent)
  return (
    <div className="digital-brain-root">
      <Canvas
        className="digital-brain-canvas"
        dpr={[1, 1.35]}
        style={{ display: 'block', width: '100%', height: '100%' }}
        camera={{ position: [0, 0, 4.8], fov: 30 }}
        gl={{ alpha: true, antialias: false, powerPreference: 'high-performance', stencil: false, depth: true }}
      >
        <ambientLight intensity={0.75} />
        <BrightBlob isThinking={isThinking} />
        <EffectComposer multisampling={0}>
          <Bloom intensity={2.6} luminanceThreshold={0.12} luminanceSmoothing={0.55} mipmapBlur={false} />
          <ToneMapping />
        </EffectComposer>
      </Canvas>
      {showProgress && <DigitalBrainProgressLabel targetPercent={graphProgressPercent} />}
    </div>
  )
}

export default React.memo(DigitalBrain)
