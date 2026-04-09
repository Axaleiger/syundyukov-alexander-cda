import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
import './DigitalBrain.css'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing'
import * as THREE from 'three'

/** Базовая плотность для main; для new-demo повышаем локально в BrightBlob */
const ROWS = 44
const COLS = 72

function buildBlobSurface({ rows = ROWS, cols = COLS, isNewDemo = false } = {}) {
  const points = []
  let pid = 0
  if (isNewDemo) {
    // 1:1 по принципу из picture-animation: плотные кольца с переменной численностью по долготе.
    const latSteps = 50
    const maxLon = 72
    for (let lat = 0; lat < latSteps; lat += 1) {
      const v = (lat + 0.5) / latSteps
      const theta = v * Math.PI
      const s = Math.sin(theta)
      const lonCount = Math.max(18, Math.round(maxLon * (0.28 + 0.72 * s)))
      for (let lon = 0; lon < lonCount; lon += 1) {
        const u = lon / lonCount
        const phi = u * Math.PI * 2
        const x = Math.sin(theta) * Math.cos(phi)
        const y = Math.cos(theta)
        const z = Math.sin(theta) * Math.sin(phi)
        const phase =
          Math.sin(phi * 2.0) * 1.35 +
          Math.cos(phi * 3.0) * 0.95 +
          Math.sin(theta * 2.4) * 1.1
        const glowSeed = Math.sin(phi * 1.7) * 2.1 + Math.cos(theta * 3.1) * 1.3
        points.push({
          base: new THREE.Vector3(x, y * 0.94, z),
          u,
          v,
          id: pid,
          glowSeed,
          phase,
        })
        pid += 1
      }
    }
  } else {
    for (let r = 0; r < rows; r += 1) {
      const v = r / (rows - 1)
      const phi = v * Math.PI
      const sinPhi = Math.sin(phi)
      const cosPhi = Math.cos(phi)
      for (let c = 0; c < cols; c += 1) {
        const u = c / cols
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
          u,
          v,
          id: pid,
          glowSeed:
            Math.sin(theta * 1.7) * 2.1 +
            Math.cos(phi * 3.1) * 1.3,
          phase: (theta * 0.77 + phi * 0.63) % (Math.PI * 2),
        })
        pid += 1
      }
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

function toColors(points, isNewDemo = false) {
  const out = new Float32Array(points.length * 3)
  const deepBlue = { r: 0.06, g: 0.30, b: 0.62 }
  const midBlue = { r: 0.08, g: 0.47, b: 0.73 }
  const lightBlue = { r: 0.23, g: 0.66, b: 0.84 }
  const orange = { r: 0.90, g: 0.35, b: 0.03 }
  points.forEach((p, i) => {
    if (isNewDemo) {
      const tone = Math.max(0, Math.min(1, (p.v + 0.05) * 1.15))
      const midMix = 0.46 + Math.sin(p.phase * 1.15) * 0.06
      let r = deepBlue.r * (1 - tone) + midBlue.r * tone
      let g = deepBlue.g * (1 - tone) + midBlue.g * tone
      let b = deepBlue.b * (1 - tone) + midBlue.b * tone
      r = r * (1 - midMix) + lightBlue.r * midMix
      g = g * (1 - midMix) + lightBlue.g * midMix
      b = b * (1 - midMix) + lightBlue.b * midMix
      const orangeHint = Math.max(0, Math.sin((p.u + p.v) * Math.PI * 3.0)) * 0.04
      out[i * 3] = r * (1 - orangeHint) + orange.r * orangeHint
      out[i * 3 + 1] = g * (1 - orangeHint) + orange.g * orangeHint
      out[i * 3 + 2] = b * (1 - orangeHint) + orange.b * orangeHint
    } else {
      const lower = Math.max(0, (p.v - 0.58) / 0.42)
      // Нижняя «шапка» яйца: насыщенный переход к верху (поверх идёт слой белой базы)
      const c1 = new THREE.Color().setHSL(0.55, 0.95, 0.72)
      const c2 = new THREE.Color().setHSL(0.83, 1, 0.82)
      const c = c1.lerp(c2, lower * 0.75)
      out[i * 3] = c.r
      out[i * 3 + 1] = c.g
      out[i * 3 + 2] = c.b
    }
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

const BrightBlob = memo(function BrightBlob({ isThinking, isNewDemo = false, graphProgressPercent = null }) {
  const pointsRef = useRef(null)
  const pointsBaseRef = useRef(null)
  const glowRef = useRef(null)
  const groupRef = useRef(null)
  const matRef = useRef(null)
  const keyLightRef = useRef(null)
  const fillLightRef = useRef(null)
  const loadProgressRef = useRef(0)

  const pts = useMemo(
    () => buildBlobSurface({ rows: isNewDemo ? 50 : ROWS, cols: isNewDemo ? 84 : COLS, isNewDemo }),
    [isNewDemo]
  )
  const positions = useMemo(() => toPositions(pts), [pts])
  const colors = useMemo(() => toColors(pts, isNewDemo), [pts, isNewDemo])
  const baseWhiteColors = useMemo(() => toBaseWhiteColors(pts.length), [pts.length])
  const pointCount = pts.length

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

    const targetPulse = isThinking ? (isNewDemo ? 0.052 : 0.06) : (isNewDemo ? 0.02 : 0.018)
    const targetSpin = isThinking ? (isNewDemo ? 0.34 : 0.45) : (isNewDemo ? 0.1 : 0.12)
    const targetWobble = isThinking ? (isNewDemo ? 0.072 : 0.06) : (isNewDemo ? 0.026 : 0.02)

    state.current.pulse += (targetPulse - state.current.pulse) * Math.min(1, delta * 1.8)
    state.current.spin += (targetSpin - state.current.spin) * Math.min(1, delta * 1.6)
    state.current.wobble += (targetWobble - state.current.wobble) * Math.min(1, delta * 1.8)

    const t = performance.now() * 0.001
    if (isNewDemo && graphProgressPercent != null && Number.isFinite(graphProgressPercent)) {
      loadProgressRef.current +=
        (Math.max(0, Math.min(100, graphProgressPercent)) - loadProgressRef.current) * Math.min(1, delta * 1.2)
    }

    if (keyLightRef.current) {
      lerpColorHSLShort(scratchKey, keyThinking, keyDone, u)
      keyLightRef.current.color.copy(scratchKey)
    }
    if (fillLightRef.current) {
      lerpColorHSLShort(scratchFill, fillThinking, fillDone, u)
      fillLightRef.current.color.copy(scratchFill)
    }

    if (groupRef.current) {
      if (isNewDemo) {
        const yaw = t * 0.22 + Math.sin(t * 0.44) * 0.2
        const pitch = t * 0.13 + Math.sin(t * 0.31) * 0.1
        const roll = t * 0.17 + Math.sin(t * 0.27) * 0.08
        groupRef.current.rotation.set(pitch, yaw, roll)
      } else {
        groupRef.current.rotation.z += delta * state.current.spin
        groupRef.current.rotation.y += delta * (state.current.spin * 0.24)
      }
      const s = 1 + Math.sin(t * 2.1) * state.current.pulse
      groupRef.current.scale.set(1.08 * s, 0.9 * s, 1.06 * s)
    }

    if (pointsRef.current) {
      vertexFrameRef.current += 1
      if (vertexFrameRef.current % 2 === 0) {
        const arr = pointsRef.current.geometry.attributes.position.array
        const colorArr = pointsRef.current.geometry.attributes.color.array
        const wob = state.current.wobble
        const deepBlue = { r: 0.06, g: 0.30, b: 0.62 }
        const midBlue = { r: 0.08, g: 0.47, b: 0.73 }
        const lightBlue = { r: 0.23, g: 0.66, b: 0.84 }
        const orange = { r: 0.95, g: 0.37, b: 0.0 }
        const sweepPeriod = 4.8
        const sweepPhase = ((t + 0.7) % sweepPeriod) / sweepPeriod
        const sweepX = -1.25 + sweepPhase * 2.5
        const gate = Math.sin(Math.PI * sweepPhase)
        for (let i = 0; i < pts.length; i += 1) {
          const p = pts[i]
          let n = 1
          if (isNewDemo) {
            const waveA = Math.sin(p.base.x * 5.9 + p.base.y * 4.8 - t * 2.4 + p.phase) * 0.12
            const waveB = Math.cos(p.base.z * 6.2 - p.base.x * 3.5 + t * 1.8) * 0.09
            const waveC = Math.sin((p.base.x + p.base.z) * 4.8 - t * 1.5 + p.phase * 0.35) * 0.06
            n = 1 + waveA + waveB + waveC
          } else {
            const noiseA = Math.sin(t * 1.75 + p.phase + p.base.x * 0.8 + p.base.z * 0.6)
            const noiseB = Math.cos(t * 1.2 + p.base.x * 2.8 - p.base.z * 2.1 + p.phase * 0.35)
            n = 1 + noiseA * wob + noiseB * wob * 0.34
          }
          const idx = i * 3
          arr[idx] = p.base.x * n
          arr[idx + 1] = isNewDemo ? p.base.y * (n * 1.03) : p.base.y * n
          arr[idx + 2] = p.base.z * n

          if (isNewDemo) {
            const z = p.base.z * n
            const vTone = Math.max(0, Math.min(1, (arr[idx + 1] + 1.1) / 2.2))
            const midMix = 0.5 + Math.sin(t * 1.2 + p.phase) * 0.08
            let rCol = deepBlue.r * (1 - vTone) + midBlue.r * vTone
            let gCol = deepBlue.g * (1 - vTone) + midBlue.g * vTone
            let bCol = deepBlue.b * (1 - vTone) + midBlue.b * vTone
            rCol = rCol * (1 - midMix) + lightBlue.r * midMix
            gCol = gCol * (1 - midMix) + lightBlue.g * midMix
            bCol = bCol * (1 - midMix) + lightBlue.b * midMix

            const dist = Math.abs(p.base.x - sweepX)
            const stripe = Math.exp(-(dist * dist) / 0.036)
            const orangeBoost = stripe * gate * 1.2
            const frontBoost = Math.max(0, Math.min(1, (z + 1.2) / 2.4)) * 0.22
            const shimmer = Math.sin(t * 4.2 + p.glowSeed + p.base.x * 5.0 - p.base.y * 3.8) * 0.5 + 0.5
            const glowBoost = shimmer * 0.26 + orangeBoost * 0.38
            const whiteBoost =
              Math.pow(shimmer, 3.0) * 0.4 * (1 - Math.min(1, orangeBoost * 1.08))
            const virtual = (loadProgressRef.current / 100) * pointCount
            const greenMix = Math.max(0, Math.min(1, virtual - p.id))
            const greenBright = { r: 0.05, g: 1.0, b: 0.35 }

            rCol = rCol * (1 - orangeBoost) + orange.r * orangeBoost
            gCol = gCol * (1 - orangeBoost) + orange.g * orangeBoost
            bCol = bCol * (1 - orangeBoost) + orange.b * orangeBoost

            rCol = rCol * (1 - greenMix) + greenBright.r * greenMix
            gCol = gCol * (1 - greenMix) + greenBright.g * greenMix
            bCol = bCol * (1 - greenMix) + greenBright.b * greenMix

            colorArr[idx] = Math.min(1, rCol + glowBoost * 0.24 + whiteBoost * 0.36)
            colorArr[idx + 1] = Math.min(1, gCol + frontBoost * 0.2 + glowBoost * 0.28 + whiteBoost * 0.36)
            colorArr[idx + 2] = Math.min(1, bCol + frontBoost * 0.24 + glowBoost * 0.34 + whiteBoost * 0.36)
          }
        }
        pointsRef.current.geometry.attributes.position.needsUpdate = true
        if (isNewDemo) {
          pointsRef.current.geometry.attributes.color.needsUpdate = true
        }
      }
    }

    if (matRef.current && glowRef.current) {
      matRef.current.color.copy(state.current.color)
      matRef.current.opacity = isNewDemo ? 0.98 - u * 0.05 : 1 - u * 0.06
      glowRef.current.material.color.copy(state.current.color)
      glowRef.current.material.opacity = isNewDemo ? 0.74 - u * 0.18 : 0.62 - u * 0.16
    }
  })

  return (
    <>
      <pointLight ref={keyLightRef} position={[3.5, 3.2, 4]} intensity={isNewDemo ? 3.55 : 3.2} />
      <pointLight ref={fillLightRef} position={[-2.5, -2.2, -2]} intensity={isNewDemo ? 1.35 : 1.15} />
      <group ref={groupRef}>
        <points ref={pointsBaseRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
            <bufferAttribute attach="attributes-color" array={baseWhiteColors} count={baseWhiteColors.length / 3} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial
            color="#ffffff"
            size={isNewDemo ? 0.106 : 0.112}
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
            size={isNewDemo ? 0.094 : 0.1}
            vertexColors
            transparent
            opacity={1}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            sizeAttenuation={false}
          />
        </points>
        <mesh ref={glowRef}>
          <sphereGeometry args={[isNewDemo ? 1.82 : 1.74, 28, 28]} />
          <meshBasicMaterial transparent opacity={isNewDemo ? 0.74 : 0.62} color={isNewDemo ? "#8dd8ff" : "#9ce7ff"} side={THREE.BackSide} />
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
  useEffect(() => {
    targetRef.current = target
  }, [target])

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

function DigitalBrain({ isThinking = true, graphProgressPercent = null, isNewDemo = false }) {
  const showProgress = graphProgressPercent != null && Number.isFinite(graphProgressPercent)
  return (
    <div className={`digital-brain-root ${isNewDemo ? "digital-brain-root--new-demo" : ""}`}>
      <Canvas
        className="digital-brain-canvas"
        dpr={[1, 1.35]}
        style={{ display: 'block', width: '100%', height: '100%' }}
        camera={{ position: [0, 0, 4.8], fov: 30 }}
        gl={{ alpha: true, antialias: false, powerPreference: 'high-performance', stencil: false, depth: true }}
      >
        <ambientLight intensity={0.75} />
        <BrightBlob
          isThinking={isThinking}
          isNewDemo={isNewDemo}
          graphProgressPercent={graphProgressPercent}
        />
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
