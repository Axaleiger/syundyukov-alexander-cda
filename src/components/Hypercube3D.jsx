import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text, Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  POINTS_PER_LEVEL,
  getEntityLabel as defaultGetEntityLabel,
} from '../data/funnelEntities'
import { loadFunnelFromExcel, buildFunnelFromEntities } from '../data/loadFunnelFromExcel'
import './Hypercube3D.css'

const CUBE_HALF = 1.15
const NUM_POINTS = 280
const NUM_FLUX_CURVES = 28
const PLANE_SPACING = 0.7

const FUNNEL_LEVELS = [
  { title: 'ЦД программ', layerTitle: 'Слой ЦД программ' },
  { title: 'ЦД объекта', layerTitle: 'Слой ЦД объекта' },
  { title: 'Сервисы', layerTitle: 'Слой Сервисы' },
  { title: 'Микросервисы', layerTitle: 'Слой Микросервисы' },
  { title: 'Функции', layerTitle: 'Слой Функции' },
]

const PLANE_LEVEL_COLORS = ['#7a9cba', '#6b8caa', '#5c7d9a', '#4d6e8a', '#3e5f7a']

const RISK_ZONE_OPACITY = 0.4
const RISK_TINT_BY_LEVEL = ['#e8a84a', '#5a9d6e', '#5b8dc9', '#5a9d6e', '#e8a84a']

const RISK_VOLUME_COLORS = {
  red: new THREE.Color('#d32f2f'),
  green: new THREE.Color('#2e7d32'),
}

function getPlaneY(levelIndex) {
  return -CUBE_HALF - 0.75 - levelIndex * PLANE_SPACING
}

function getPlaneSize(levelIndex) {
  const n = POINTS_PER_LEVEL[levelIndex]
  const cols = Math.ceil(Math.sqrt(n))
  const cell = 0.095
  const size = Math.max(0.55, cols * cell)
  return size
}

function getPlanePointPosition(levelIndex, pointIndex) {
  const y = getPlaneY(levelIndex)
  const n = POINTS_PER_LEVEL[levelIndex]
  const size = getPlaneSize(levelIndex)
  const half = size / 2 - 0.02
  const cols = Math.ceil(Math.sqrt(n))
  const rows = Math.ceil(n / cols)
  const col = pointIndex % cols
  const row = Math.floor(pointIndex / cols)
  const x = (cols <= 1 ? 0 : -half + (col / (cols - 1)) * (2 * half))
  const z = (rows <= 1 ? 0 : -half + (row / (rows - 1)) * (2 * half))
  return [x, y, z]
}

const WORMHOLE_LEVELS = [
  { title: 'ЦД актива', items: ['ЦДА', 'ЦД двойник актива'] },
  { title: 'ЦД программы', items: ['ЦДРБ', 'АВНМ', 'ЦДП', 'ЦДПр'] },
  { title: 'ЦД объекта', items: ['ЦД промысла', 'ЦД пласта', 'ЦД скважины', 'ЦД инфраструктуры'] },
  { title: 'Сервисы', items: ['Б6К', 'СПекТР', 'КФА', 'eXoil', 'ГибРИМА'] },
  { title: 'Микросервисы', items: Array.from({ length: 10 }, (_, i) => `Микросервис ${i + 1}`) },
  { title: 'Функции', items: Array.from({ length: 10 }, (_, i) => `Функция ${i + 1}`) },
]

function getPathForVariant(variantId) {
  const path = []
  let idx = variantId
  for (const level of WORMHOLE_LEVELS) {
    const n = level.items.length
    path.push(level.items[idx % n])
    idx = Math.floor(idx / n)
  }
  return path
}

function getVariantBasePosition(i) {
  const n = 7
  const ix = (i % n) / (n - 1)
  const iy = (Math.floor(i / n) % n) / (n - 1)
  const iz = (Math.floor(i / (n * n)) % n) / (n - 1)
  const x = -CUBE_HALF + 2 * CUBE_HALF * (ix + (i % 11) * 0.02)
  const y = -CUBE_HALF + 2 * CUBE_HALF * (iy + (i % 7) * 0.02)
  const z = -CUBE_HALF + 2 * CUBE_HALF * (iz + (i % 13) * 0.02)
  const clamp = (v) => Math.max(-CUBE_HALF + 0.05, Math.min(CUBE_HALF - 0.05, v))
  return [clamp(x), clamp(y), clamp(z)]
}

function WireframeCube() {
  const geom = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(CUBE_HALF * 2, CUBE_HALF * 2, CUBE_HALF * 2)),
    []
  )
  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color="#5b8dc9" transparent opacity={0.75} />
    </lineSegments>
  )
}

const riskVolumeVertexShader = `
  varying vec3 vPosition;
  void main() {
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const riskVolumeFragmentShader = `
  uniform vec3 colorRed;
  uniform vec3 colorGreen;
  uniform float opacity;
  uniform float uNpv;
  uniform float uReserves;
  uniform float uExtraction;
  varying vec3 vPosition;
  void main() {
    float h = 1.15;
    float x = vPosition.x / h;
    float y = vPosition.y / h;
    float z = vPosition.z / h;
    float shift = uNpv * 0.5 + uReserves * 0.3 + uExtraction * 0.4;
    float s1 = sin((z + shift) * 2.1) * 0.3 + sin((y + shift * 0.7) * 1.7) * 0.25;
    float s2 = sin((x + shift * 0.5) * 2.3) * 0.25 + sin((z + y + shift) * 1.5) * 0.3;
    float v1 = x + 0.5 * y + s1;
    float v2 = -0.7 * x + 0.6 * y + 0.4 * z + s2;
    float t = v1 - v2;
    float voidWidth = 0.12;
    float isRed = step(voidWidth, t);
    float isGreen = step(voidWidth, -t);
    float inVoid = 1.0 - step(voidWidth, abs(t));
    vec3 col = isRed * colorRed + isGreen * colorGreen;
    float alpha = (1.0 - inVoid) * opacity;
    gl_FragColor = vec4(col, alpha);
  }
`

function RiskZones({ npv = 50, reserves = 50, extraction = 50 }) {
  const npvNorm = npv / 100
  const resNorm = reserves / 100
  const extNorm = extraction / 100
  const uniforms = useMemo(
    () => ({
      colorRed: { value: RISK_VOLUME_COLORS.red },
      colorGreen: { value: RISK_VOLUME_COLORS.green },
      opacity: { value: RISK_ZONE_OPACITY },
      uNpv: { value: npvNorm },
      uReserves: { value: resNorm },
      uExtraction: { value: extNorm },
    }),
    [npvNorm, resNorm, extNorm]
  )
  const geom = useMemo(
    () => new THREE.BoxGeometry(CUBE_HALF * 2 - 0.02, CUBE_HALF * 2 - 0.02, CUBE_HALF * 2 - 0.02),
    []
  )
  return (
    <mesh geometry={geom}>
      <shaderMaterial
        vertexShader={riskVolumeVertexShader}
        fragmentShader={riskVolumeFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.FrontSide}
      />
    </mesh>
  )
}

function valueToColor(t) {
  const H = 260 - t * 220
  const S = 75 + t * 15
  const L = 45 + t * 25
  return `hsl(${H}, ${S}%, ${L}%)`
}

function VariantPoint({ variantId, npv, reserves, extraction, onPointClick }) {
  const basePos = useMemo(() => getVariantBasePosition(variantId), [variantId])
  const x = basePos[0]
  const y = basePos[1]
  const z = basePos[2]
  const nx = (x + CUBE_HALF) / (2 * CUBE_HALF)
  const ny = (y + CUBE_HALF) / (2 * CUBE_HALF)
  const nz = (z + CUBE_HALF) / (2 * CUBE_HALF)
  const t = (nx * (npv / 100) * 0.4 + ny * (reserves / 100) * 0.35 + nz * (extraction / 100) * 0.25) + (variantId % 19) / 190
  const T = Math.min(1, Math.max(0, t))
  const color = valueToColor(T)

  return (
    <mesh
      position={basePos}
      onClick={(e) => {
        e.stopPropagation()
        onPointClick(variantId)
      }}
      onPointerOver={() => { document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = 'default' }}
    >
      <sphereGeometry args={[0.04, 10, 10]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

function CurveLine({ start, end, color, opacity = 0.5, seed = 0 }) {
  const curve = useMemo(() => {
    const s = (seed * 17 + 31) % 1000 / 1000
    const t = (seed * 7 + 11) % 1000 / 1000
    const mid = new THREE.Vector3(
      (start[0] + end[0]) / 2 + (s - 0.5) * 0.5,
      (start[1] + end[1]) / 2,
      (start[2] + end[2]) / 2 + (t - 0.5) * 0.5
    )
    return new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(...start),
      mid,
      new THREE.Vector3(...end)
    )
  }, [start, end, seed])
  const points = useMemo(() => curve.getPoints(24), [curve])
  const geom = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points])
  return (
    <line geometry={geom}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </line>
  )
}

const planeRiskVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const planeRiskFragmentShader = `
  uniform vec3 colorRed;
  uniform vec3 colorGreen;
  uniform float opacity;
  uniform float uNpv;
  uniform float uReserves;
  uniform float uExtraction;
  varying vec2 vUv;
  void main() {
    float x = vUv.x - 0.5;
    float z = vUv.y - 0.5;
    float shift = uNpv * 2.0 + uReserves * 1.5 + uExtraction * 2.5;
    float t1 = x * 1.2 + z * 0.8 + 0.15 * sin((z + shift) * 12.0);
    float t2 = -x * 0.8 + z * 1.0 + 0.15 * sin((x + shift * 0.7) * 10.0);
    float t = t1 - t2;
    float voidWidth = 0.08;
    float isRed = step(voidWidth, t);
    float isGreen = step(voidWidth, -t);
    float inVoid = 1.0 - step(voidWidth, abs(t));
    vec3 col = isRed * colorRed + isGreen * colorGreen;
    float alpha = (1.0 - inVoid) * opacity;
    gl_FragColor = vec4(col, alpha);
  }
`

function FunnelLevel({ levelIndex, layerTitle, color, onPointClick, selectedPlanePoint, getEntityLabel, showRisks, riskTint, npv = 50, reserves = 50, extraction = 50 }) {
  const planeY = getPlaneY(levelIndex)
  const size = getPlaneSize(levelIndex)
  const n = POINTS_PER_LEVEL[levelIndex]
  const planeGeom = useMemo(() => new THREE.PlaneGeometry(size, size), [size])
  const points = useMemo(() => Array.from({ length: n }, (_, i) => i), [n])
  const isSelected = selectedPlanePoint && selectedPlanePoint.levelIndex === levelIndex
  const planeColor = !showRisks ? '#e8eef4' : null
  const planeOpacity = showRisks ? 0.72 : 0.85
  const planeRiskUniforms = useMemo(
    () => ({
      colorRed: { value: new THREE.Color('#d32f2f') },
      colorGreen: { value: new THREE.Color('#2e7d32') },
      opacity: { value: 0.72 },
      uNpv: { value: npv / 100 },
      uReserves: { value: reserves / 100 },
      uExtraction: { value: extraction / 100 },
    }),
    [npv, reserves, extraction]
  )

  return (
    <group position={[0, planeY, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <primitive object={planeGeom} attach="geometry" />
        {showRisks ? (
          <shaderMaterial
            vertexShader={planeRiskVertexShader}
            fragmentShader={planeRiskFragmentShader}
            uniforms={planeRiskUniforms}
            transparent
            depthWrite={true}
          />
        ) : (
          <meshBasicMaterial color={planeColor} transparent opacity={planeOpacity} />
        )}
      </mesh>
      {points.map((idx) => {
        const [x, , z] = getPlanePointPosition(levelIndex, idx)
        const selected = selectedPlanePoint && selectedPlanePoint.levelIndex === levelIndex && selectedPlanePoint.pointIndex === idx
        return (
          <mesh
            key={idx}
            position={[x, 0.01, z]}
            onClick={(e) => {
              e.stopPropagation()
              onPointClick(levelIndex, idx)
            }}
            onPointerOver={() => { document.body.style.cursor = 'pointer' }}
            onPointerOut={() => { document.body.style.cursor = 'default' }}
          >
            <sphereGeometry args={[n > 100 ? 0.015 : n > 30 ? 0.02 : 0.025, 6, 6]} />
            <meshBasicMaterial color={selected ? '#2d5a87' : color} />
          </mesh>
        )
      })}
      <Html position={[size / 2 + 0.12, 0.06, 0]} center>
        <span className="funnel-level-label">{layerTitle}</span>
      </Html>
      {isSelected && selectedPlanePoint && getEntityLabel && (
        <Html position={[0, 0.15, 0]} center>
          <div className="funnel-entity-tooltip">
            {getEntityLabel(levelIndex, selectedPlanePoint.pointIndex)}
          </div>
        </Html>
      )}
    </group>
  )
}

function FunnelOfScenarios({ selectedVariantId, onCloseVariant, selectedPlanePoint, onPlanePointClick, getEntityLabel, showRisks, npv = 50, reserves = 50, extraction = 50 }) {
  const n0 = POINTS_PER_LEVEL[0]
  const fluxCurvesCubeToL0 = useMemo(() => {
    return Array.from({ length: Math.min(NUM_FLUX_CURVES, n0 * 7) }, (_, i) => {
      const idx = (i * 17) % NUM_POINTS
      const start = getVariantBasePosition(idx)
      const end = getPlanePointPosition(0, idx % n0)
      return { start: [start[0], start[1], start[2]], end }
    })
  }, [n0])

  const fluxCurvesBetweenLevels = useMemo(() => {
    const pairs = []
    for (let l = 0; l < FUNNEL_LEVELS.length - 1; l++) {
      const nFrom = POINTS_PER_LEVEL[l]
      const nTo = POINTS_PER_LEVEL[l + 1]
      for (let j = 0; j < nFrom; j++) {
        const jTo = Math.floor((j * nTo) / nFrom) % nTo
        pairs.push({
          start: getPlanePointPosition(l, j),
          end: getPlanePointPosition(l + 1, jTo),
        })
      }
    }
    return pairs
  }, [])

  const selectedPathPoints = useMemo(() => {
    if (selectedVariantId == null) return []
    const pts = [getVariantBasePosition(selectedVariantId)]
    for (let l = 0; l < FUNNEL_LEVELS.length; l++) {
      const idx = selectedVariantId % POINTS_PER_LEVEL[l]
      pts.push(getPlanePointPosition(l, idx))
    }
    return pts
  }, [selectedVariantId])

  if (selectedVariantId == null) return null

  const bottomY = getPlaneY(FUNNEL_LEVELS.length - 1)

  return (
    <group position={[0, 0, 0]}>
      {fluxCurvesCubeToL0.map(({ start, end }, i) => (
        <CurveLine key={`c-${i}`} start={start} end={end} color="#5b8dc9" opacity={0.2} seed={i} />
      ))}
      {fluxCurvesBetweenLevels.map(({ start, end }, i) => (
        <CurveLine key={`l-${i}`} start={start} end={end} color="#5b8dc9" opacity={0.15} seed={i + 100} />
      ))}
      {selectedPathPoints.length >= 2 &&
        selectedPathPoints.slice(0, -1).map((start, i) => {
          const end = selectedPathPoints[i + 1]
          return (
            <CurveLine
              key={`s-${i}`}
              start={[start[0], start[1], start[2]]}
              end={[end[0], end[1], end[2]]}
              color="#2d5a87"
              opacity={1}
              seed={i + 200}
            />
          )
        })}
      {FUNNEL_LEVELS.map((level, idx) => (
        <FunnelLevel
          key={level.title}
          levelIndex={idx}
          layerTitle={level.layerTitle}
          color={PLANE_LEVEL_COLORS[idx]}
          onPointClick={onPlanePointClick}
          selectedPlanePoint={selectedPlanePoint}
          getEntityLabel={getEntityLabel}
          showRisks={showRisks}
          riskTint={showRisks ? RISK_TINT_BY_LEVEL[idx] : null}
          npv={npv}
          reserves={reserves}
          extraction={extraction}
        />
      ))}
      <Html position={[0, bottomY - 0.35, 0]} center>
        <div className="variant-space-3d-close">
          <button type="button" onClick={onCloseVariant} aria-label="Закрыть">
            Закрыть воронку сквозных сценариев
          </button>
        </div>
      </Html>
    </group>
  )
}

function Scene({ npv, reserves, extraction, onPointClick, selectedVariantId, onCloseVariant, selectedPlanePoint, onPlanePointClick, getEntityLabel, showRisks }) {
  const points = useMemo(() => Array.from({ length: NUM_POINTS }, (_, i) => i), [])

  return (
    <>
      <ambientLight intensity={0.9} />
      <pointLight position={[4, 4, 4]} intensity={1} />
      <pointLight position={[-4, -4, 4]} intensity={0.4} />

      {showRisks && <RiskZones npv={npv} reserves={reserves} extraction={extraction} />}
      <group>
        <WireframeCube />
        {points.map((id) => (
          <VariantPoint
            key={id}
            variantId={id}
            npv={npv}
            reserves={reserves}
            extraction={extraction}
            onPointClick={onPointClick}
          />
        ))}
      </group>

      <FunnelOfScenarios
        selectedVariantId={selectedVariantId}
        onCloseVariant={onCloseVariant}
        selectedPlanePoint={selectedPlanePoint}
        onPlanePointClick={onPlanePointClick}
        getEntityLabel={getEntityLabel}
        showRisks={showRisks}
        npv={npv}
        reserves={reserves}
        extraction={extraction}
      />

      <OrbitControls
        enableZoom
        enablePan
        minPolarAngle={Math.PI / 2}
        maxPolarAngle={Math.PI / 2}
        enableRotate
      />

      <Text position={[CUBE_HALF + 0.4, 0, 0]} fontSize={0.26} color="#2d5a87" anchorX="center" anchorY="middle">
        NPV
      </Text>
      <Text position={[0, CUBE_HALF + 0.4, 0]} fontSize={0.26} color="#2d5a87" anchorX="center" anchorY="middle">
        Запасы
      </Text>
      <Text position={[0, 0, CUBE_HALF + 0.4]} fontSize={0.26} color="#2d5a87" anchorX="center" anchorY="middle">
        Добыча (Q)
      </Text>
      <Html position={[0, CUBE_HALF + 0.25, 0]} center>
        <span className="cube-label-activa">ЦД Актива</span>
      </Html>
    </>
  )
}

function toMillions(pct, scale) {
  return ((pct / 100) * scale).toFixed(2)
}

function Hypercube3D() {
  const [npv, setNpv] = useState(50)
  const [reserves, setReserves] = useState(50)
  const [extraction, setExtraction] = useState(50)
  const [selectedVariantId, setSelectedVariantId] = useState(null)
  const [selectedPlanePoint, setSelectedPlanePoint] = useState(null)
  const [getEntityLabel, setGetEntityLabel] = useState(() => defaultGetEntityLabel)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showRisks, setShowRisks] = useState(false)
  const cubeCanvasRef = useRef(null)

  useEffect(() => {
    loadFunnelFromExcel()
      .then(buildFunnelFromEntities)
      .then((built) => {
        if (built && built.getEntityLabel) setGetEntityLabel(() => built.getEntityLabel)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const npvMillions = toMillions(npv, 800)
  const reservesMillions = toMillions(reserves, 120)
  const extractionMillions = toMillions(extraction, 15)

  return (
    <div className="hypercube-container">
      <div className="hypercube-controls">
        <div className="control-group">
          <label>
            NPV (оперативный рычаг — деньги за год): {npv}%
            <span className="control-value"> ({npvMillions} млн руб)</span>
            <input
              type="range"
              min="0"
              max="100"
              value={npv}
              onChange={(e) => setNpv(Number(e.target.value))}
              className="slider"
            />
          </label>
        </div>
        <div className="control-group">
          <label>
            Запасы (стратегический рычаг — суммарная добыча нефти/КИН за 30 лет): {reserves}%
            <span className="control-value"> ({reservesMillions} млн т)</span>
            <input
              type="range"
              min="0"
              max="100"
              value={reserves}
              onChange={(e) => setReserves(Number(e.target.value))}
              className="slider"
            />
          </label>
        </div>
        <div className="control-group">
          <label>
            Добыча (Q, млн т) — оперативный рычаг добычи нефти за год: {extraction}%
            <span className="control-value"> ({extractionMillions} млн т)</span>
            <input
              type="range"
              min="0"
              max="100"
              value={extraction}
              onChange={(e) => setExtraction(Number(e.target.value))}
              className="slider"
            />
          </label>
        </div>
      </div>

      <div className="hypercube-visualization">
        <div className="cube-info">
          <h3>Гиперкуб (параметры в млн)</h3>
          <div className="cube-metrics">
            <div className="metric">
              <span className="metric-label">NPV, млн руб</span>
              <span className="metric-value">{npvMillions}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Запасы, млн т</span>
              <span className="metric-value">{reservesMillions}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Добыча Q, млн т</span>
              <span className="metric-value">{extractionMillions}</span>
            </div>
          </div>
          <p className="cube-palette-hint">
            Цвета точек куба зависят от рычагов (холодные — низкие значения, горячие — высокие). Точки уровней воронки не меняют цвет.
          </p>
          <div className="cube-palette-legend">
            <span className="cube-legend-cold">Низкие</span>
            <div className="cube-legend-gradient" />
            <span className="cube-legend-hot">Высокие</span>
          </div>
          <label className="cube-risks-toggle">
            <input
              type="checkbox"
              checked={showRisks}
              onChange={(e) => setShowRisks(e.target.checked)}
            />
            <span>Карта рисков (зоны и плоскости)</span>
          </label>
        </div>
        <div className={`hypercube-window ${isFullscreen ? 'hypercube-window-fullscreen' : ''} ${selectedVariantId != null ? 'hypercube-window-funnel-open' : ''}`} ref={cubeCanvasRef}>
          <div className="cube-canvas-wrap">
            <button
              type="button"
              className="cube-fullscreen-btn"
              onClick={() => {
                if (!cubeCanvasRef.current) return
                if (isFullscreen) {
                  document.exitFullscreen?.()
                  setIsFullscreen(false)
                } else {
                  cubeCanvasRef.current.requestFullscreen?.()
                  setIsFullscreen(true)
                }
              }}
              aria-label={isFullscreen ? 'Выйти из полноэкранного режима' : 'Развернуть на весь экран'}
              title={isFullscreen ? 'Выйти из полноэкранного режима' : 'Развернуть на весь экран'}
            >
              {isFullscreen ? '✕ Свернуть' : '⛶ На весь экран'}
            </button>
            <div className="cube-canvas">
            <Canvas camera={{ position: [4, 4, 4], fov: 50 }}>
              <Scene
                npv={npv}
                reserves={reserves}
                extraction={extraction}
                onPointClick={setSelectedVariantId}
                selectedVariantId={selectedVariantId}
                onCloseVariant={() => { setSelectedVariantId(null); setSelectedPlanePoint(null) }}
                selectedPlanePoint={selectedPlanePoint}
                onPlanePointClick={(levelIndex, pointIndex) => setSelectedPlanePoint({ levelIndex, pointIndex })}
                getEntityLabel={getEntityLabel}
                showRisks={showRisks}
              />
            </Canvas>
            </div>
          </div>
        </div>
      </div>

      <div className="hypercube-instructions">
        <p>Оси подписаны на гиперкубе (NPV, Запасы, Добыча). Цвет точек куба зависит от рычагов; точки уровней воронки — фиксированного цвета. Нажмите на точку куба — под ним откроется воронка сквозных сценариев: пять уровней (ЦД программы, ЦД объекта, сервисы, микросервисы, функции) с точками и кривыми между ними; выбранный сценарий выделен яркой линией. Перетаскивайте сцену вверх-вниз, чтобы промотать до нижнего уровня.</p>
      </div>
    </div>
  )
}

export default Hypercube3D
