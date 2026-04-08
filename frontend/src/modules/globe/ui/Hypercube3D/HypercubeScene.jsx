import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import { VARIANT_COLORS } from './hypercube3DLegendData'
import { CASE_TREE_STEPS } from './hypercube3DCaseTree'
import overlayStyles from './HypercubeScene.module.css'

const CUBE_HALF = 1.15
const NUM_POINTS = 280
const NUM_FLUX_CURVES = 28
const PLANE_SPACING = 0.7

const FUNNEL_LEVELS = [
  { title: 'ЦД программ' },
  { title: 'ЦД объекта' },
  { title: 'Сервисы' },
  { title: 'Микросервисы' },
  { title: 'Функции' },
]

const PLANE_LEVEL_COLORS = ['#7a9cba', '#6b8caa', '#5c7d9a', '#4d6e8a', '#3e5f7a']

const RISK_ZONE_OPACITY = 0.72
const RISK_TINT_BY_LEVEL = ['#e8a84a', '#5a9d6e', '#5b8dc9', '#5a9d6e', '#e8a84a']

const RISK_VOLUME_COLORS = {
  red: new THREE.Color('#dc2626'),
  green: new THREE.Color('#16a34a'),
}

const NEW_DEMO_VARIANT_COLORS = {
  inapplicable: '#0070BA',
  applicable: '#57C7FF',
  legitimate: '#E65907',
}

const NEW_DEMO_RISK_PALETTE = {
  low: '#eeb392',
  high: '#81d4ff',
  center: '#f5f8ff',
}

function getPlaneY(levelIndex) {
  return -CUBE_HALF - 0.75 - levelIndex * PLANE_SPACING
}

function getPlaneSize(pointsPerLevel, levelIndex) {
  const n = pointsPerLevel[levelIndex]
  const cols = Math.ceil(Math.sqrt(n))
  const cell = 0.095
  const size = Math.max(0.55, cols * cell)
  return size
}

function getPlanePointPosition(pointsPerLevel, levelIndex, pointIndex) {
  const y = getPlaneY(levelIndex)
  const n = pointsPerLevel[levelIndex]
  const size = getPlaneSize(pointsPerLevel, levelIndex)
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

const CASE_TREE_BLUE = '#5b8dc9'
const CONNECTOR_BLUE = '#0070BA'
const CONNECTOR_WHITE = '#ffffff'

function seededRandom(seed) {
  let t = seed >>> 0
  return () => {
    t += 0x6D2B79F5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

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

function WireframeCube({ color = "#5b8dc9", opacity = 0.75 }) {
  const geom = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(CUBE_HALF * 2, CUBE_HALF * 2, CUBE_HALF * 2)),
    []
  )
  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </lineSegments>
  )
}

const AXIS_ORIGIN = -CUBE_HALF + 0.05
const AXIS_LEN = CUBE_HALF * 2 - 0.1
const TICK_STEP = 0.5
const TICK_SIZE = 0.03
const AXIS_SCALES = { x: 800, y: 120, z: 15 }
const AXIS_UNITS = { x: 'млн руб', y: 'млн т', z: 'млн т' }

function AxisLine({ from, to, color }) {
  const geom = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...from), new THREE.Vector3(...to)]), [from, to])
  return <line geometry={geom}><lineBasicMaterial color={color} /></line>
}

function AxisArrow({ end, dir, color }) {
  const size = 0.08
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    let vertices
    if (dir === 'x') {
      vertices = new Float32Array([size, 0, 0, -size * 0.5, size * 0.8, 0, -size * 0.5, -size * 0.8, 0])
    } else if (dir === 'y') {
      vertices = new Float32Array([0, size, 0, 0, -size * 0.5, size * 0.8, 0, -size * 0.5, -size * 0.8])
    } else {
      vertices = new Float32Array([0, 0, size, 0, -size * 0.8, -size * 0.5, 0, size * 0.8, -size * 0.5])
    }
    g.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
    g.setIndex([0, 1, 2])
    g.computeVertexNormals()
    return g
  }, [dir])
  const rot = dir === 'x' ? [0, 0, 0] : dir === 'y' ? [0, 0, 0] : [0, 0, 0]
  return (
    <mesh position={end} rotation={rot}>
      <primitive object={geom} attach="geometry" />
      <meshBasicMaterial color={color} side={THREE.DoubleSide} />
    </mesh>
  )
}

function AxesFromBottomLeft({ npv = 50, reserves = 50, extraction = 50, showTickLabels = true }) {
  const origin = AXIS_ORIGIN
  const axisLen = AXIS_LEN
  const axes = useMemo(() => [
    { dir: 'x', from: [origin, origin, origin], to: [origin + axisLen, origin, origin], color: '#1f2937', scale: AXIS_SCALES.x, unit: AXIS_UNITS.x },
    { dir: 'y', from: [origin, origin, origin], to: [origin, origin + axisLen, origin], color: '#374151', scale: AXIS_SCALES.y, unit: AXIS_UNITS.y },
    { dir: 'z', from: [origin, origin, origin], to: [origin, origin, origin + axisLen], color: '#4b5563', scale: AXIS_SCALES.z, unit: AXIS_UNITS.z },
  ], [])
  const tickValues = useMemo(() => {
    const n = Math.max(1, Math.floor(axisLen / TICK_STEP) - 1)
    return Array.from({ length: n }, (_, i) => origin + (i + 1) * TICK_STEP)
  }, [])
  return (
    <group>
      {axes.map(({ dir, from, to, color, scale, unit }) => (
        <group key={dir}>
          <AxisLine from={from} to={to} color={color} />
          <AxisArrow end={to} dir={dir} color={color} />
          {tickValues.map((v) => {
            let tickFrom, tickTo
            if (dir === 'x') {
              tickFrom = [v, origin - TICK_SIZE, origin]
              tickTo = [v, origin + TICK_SIZE, origin]
            } else if (dir === 'y') {
              tickFrom = [origin - TICK_SIZE, v, origin]
              tickTo = [origin + TICK_SIZE, v, origin]
            } else {
              tickFrom = [origin, origin - TICK_SIZE, v]
              tickTo = [origin, origin + TICK_SIZE, v]
            }
            const norm = (v - origin) / axisLen
            const value = (norm * scale).toFixed(1)
            const pos = dir === 'x' ? [v, origin - TICK_SIZE - 0.04, origin] : dir === 'y' ? [origin - TICK_SIZE - 0.04, v, origin] : [origin, origin - TICK_SIZE - 0.04, v]
            return (
              <group key={v}>
                <AxisLine from={tickFrom} to={tickTo} color={color} />
                {showTickLabels ? (
                  <Html position={pos} center className={overlayStyles.axisTickLabel}>
                    <span>{value}</span>
                  </Html>
                ) : null}
              </group>
            )
          })}
        </group>
      ))}
    </group>
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
  uniform vec3 colorLow;
  uniform vec3 colorHigh;
  uniform vec3 colorCenter;
  uniform float opacity;
  uniform float uNpv;
  uniform float uReserves;
  uniform float uExtraction;
  uniform float uUseSoftPalette;
  varying vec3 vPosition;
  void main() {
    float h = 1.15;
    float x = vPosition.x / h;
    float y = vPosition.y / h;
    float z = vPosition.z / h;
    float sumNorm = (uNpv + uReserves + uExtraction) / 3.0;
    float shift = sumNorm * 8.0 - 2.0;
    float s1 = sin((z + shift) * 3.0) * 0.25 + sin((y + shift * 0.8) * 2.5) * 0.2;
    float s2 = sin((x + shift * 0.6) * 3.2) * 0.2 + sin((z + y + shift) * 2.2) * 0.25;
    float v1 = x + 0.5 * y + s1;
    float v2 = -0.7 * x + 0.6 * y + 0.4 * z + s2;
    float t = v1 - v2 + shift * 1.2;
    float voidWidth = 0.05;
    float inVoid = 1.0 - step(voidWidth, abs(t));
    vec3 col = t > voidWidth ? colorHigh : colorLow;
    if (uUseSoftPalette > 0.5) {
      float centerMix = 1.0 - step(voidWidth, abs(t));
      col = mix(col, colorCenter, centerMix * 0.9);
    }
    float alpha = (1.0 - inVoid) * opacity;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.9));
  }
`

function RiskZones({ npv = 50, reserves = 50, extraction = 50, softPalette = false }) {
  const lowColor = softPalette ? NEW_DEMO_RISK_PALETTE.low : '#16a34a'
  const highColor = softPalette ? NEW_DEMO_RISK_PALETTE.high : '#dc2626'
  const centerColor = softPalette ? NEW_DEMO_RISK_PALETTE.center : '#f8fafc'
  const meshRef = useRef(null)
  const uniforms = useMemo(
    () => ({
      colorRed: { value: RISK_VOLUME_COLORS.red.clone() },
      colorGreen: { value: RISK_VOLUME_COLORS.green.clone() },
      colorLow: { value: new THREE.Color(lowColor) },
      colorHigh: { value: new THREE.Color(highColor) },
      colorCenter: { value: new THREE.Color(centerColor) },
      opacity: { value: RISK_ZONE_OPACITY },
      uNpv: { value: npv / 100 },
      uReserves: { value: reserves / 100 },
      uExtraction: { value: extraction / 100 },
      uUseSoftPalette: { value: softPalette ? 1 : 0 },
    }),
    [centerColor, extraction, highColor, lowColor, npv, reserves, softPalette]
  )
  useFrame(() => {
    if (!meshRef.current?.material?.uniforms) return
    const u = meshRef.current.material.uniforms
    u.uNpv.value = npv / 100
    u.uReserves.value = reserves / 100
    u.uExtraction.value = extraction / 100
  })
  const geom = useMemo(
    () => new THREE.BoxGeometry(CUBE_HALF * 2 - 0.02, CUBE_HALF * 2 - 0.02, CUBE_HALF * 2 - 0.02),
    []
  )
  return (
    <mesh ref={meshRef} geometry={geom}>
      <shaderMaterial
        key={`risk-volume-${npv}-${reserves}-${extraction}-${softPalette ? 1 : 0}`}
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

function getVariantType(npv, reserves, extraction, variantId) {
  const sumLever = (npv + reserves + extraction) / 300
  const tInapp = 0.01 + 0.99 * (variantId / NUM_POINTS)
  if (sumLever >= tInapp) return 'inapplicable'
  const basePos = getVariantBasePosition(variantId)
  const [x, y, z] = basePos
  const nx = (x + CUBE_HALF) / (2 * CUBE_HALF)
  const ny = (y + CUBE_HALF) / (2 * CUBE_HALF)
  const nz = (z + CUBE_HALF) / (2 * CUBE_HALF)
  const t = (nx * (npv / 100) * 0.4 + ny * (reserves / 100) * 0.35 + nz * (extraction / 100) * 0.25) + (variantId % 19) / 190
  const T = Math.min(1, Math.max(0, t))
  if (T >= sumLever) return 'legitimate'
  return 'applicable'
}

function valueToColor(variantType, palette = VARIANT_COLORS) {
  return palette[variantType] || palette.applicable
}

const BASE_PLANE_POINT_COLOR = '#5b8dc9'

const PLANE_POINT_STATUS_COLORS = {
  ok: '#2563eb',
  critical: '#be185d',
  no_data: '#374151',
  bad_calc: '#ea580c',
  fluctuation: '#6b7280',
  bad_excess: '#c2410c',
  asymmetry: '#78350f',
  non_normal: '#57534e',
  no_executor: '#dc2626',
  no_approver: '#ca8a04',
  no_deadline: '#b45309',
}

function getPlanePointStatus(levelIndex, pointIndex) {
  const n = levelIndex * 13 + pointIndex
  const k = n % 17
  if (k === 0) return 'critical'
  if (k === 1 || k === 5) return 'no_data'
  if (k === 2 || k === 6) return 'bad_calc'
  if (k === 3) return 'fluctuation'
  if (k === 7) return 'bad_excess'
  if (k === 4) return 'asymmetry'
  if (k === 8) return 'non_normal'
  if (k === 9) return 'no_executor'
  if (k === 10) return 'no_approver'
  if (k === 11) return 'no_deadline'
  return 'ok'
}

function VariantPoint({
  variantId,
  npv,
  reserves,
  extraction,
  onPointClick,
  filterVariantType,
  palette = VARIANT_COLORS,
  glowVariantType = null,
}) {
  const basePos = useMemo(() => getVariantBasePosition(variantId), [variantId])
  const variantType = useMemo(
    () => getVariantType(npv, reserves, extraction, variantId),
    [npv, reserves, extraction, variantId]
  )
  const color = valueToColor(variantType, palette)
  const visible = filterVariantType == null || filterVariantType === variantType
  if (!visible) return null
  return (
    <group position={basePos}>
      {glowVariantType === variantType ? (
        <mesh>
          <sphereGeometry args={[0.068, 10, 10]} />
          <meshBasicMaterial color={color} transparent opacity={0.34} />
        </mesh>
      ) : null}
      <mesh
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
    </group>
  )
}

function CurveLine({ start, end, color, opacity = 0.5, seed = 0, accentColor = null, accentOpacity = 0.22 }) {
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
    <group>
      {accentColor ? (
        <line geometry={geom}>
          <lineBasicMaterial color={accentColor} transparent opacity={accentOpacity} />
        </line>
      ) : null}
      <line geometry={geom}>
        <lineBasicMaterial color={color} transparent opacity={opacity} />
      </line>
    </group>
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
  uniform vec3 colorLow;
  uniform vec3 colorHigh;
  uniform vec3 colorCenter;
  uniform float opacity;
  uniform float uNpv;
  uniform float uReserves;
  uniform float uExtraction;
  uniform float uUseSoftPalette;
  varying vec2 vUv;
  void main() {
    float x = vUv.x - 0.5;
    float z = vUv.y - 0.5;
    float sumNorm = (uNpv + uReserves + uExtraction) / 3.0;
    float shift = sumNorm * 10.0 - 2.5;
    float t1 = x * 1.2 + z * 0.8 + 0.12 * sin((z + shift) * 14.0);
    float t2 = -x * 0.8 + z * 1.0 + 0.12 * sin((x + shift * 0.8) * 12.0);
    float t = t1 - t2 + shift * 0.8;
    float voidWidth = 0.04;
    float inVoid = 1.0 - step(voidWidth, abs(t));
    vec3 col = t > voidWidth ? colorHigh : colorLow;
    if (uUseSoftPalette > 0.5) {
      float centerMix = 1.0 - step(voidWidth, abs(t));
      col = mix(col, colorCenter, centerMix * 0.88);
    }
    float alpha = (1.0 - inVoid) * opacity;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.9));
  }
`

const CYLINDER_HEIGHT = 0.35
const POINT_SPHERE_TOP = 0.01 + 0.025

const ALL_INDICATOR_ITEMS = [
  { key: 'no_data', label: 'Нет данных', color: '#374151' },
  { key: 'fluctuation', label: 'Флуктуации данных', color: '#6b7280' },
  { key: 'asymmetry', label: 'Асимметрия распределения', color: '#78350f' },
  { key: 'non_normal', label: 'Распределение ненормальное', color: '#57534e' },
  { key: 'bad_calc', label: 'Невалидный расчёт', color: '#ea580c' },
  { key: 'bad_excess', label: 'Невалидный коэффициент эксцесса', color: '#c2410c' },
  { key: 'no_executor', label: 'Не назначен исполнитель', color: '#dc2626' },
  { key: 'no_approver', label: 'Нет согласующего', color: '#ca8a04' },
  { key: 'no_deadline', label: 'Нет срока', color: '#b45309' },
  { key: 'critical', label: 'Критично', color: '#be185d' },
  { key: 'ok', label: 'Норма', color: '#2563eb' },
]

function getCylinderSegments(levelIndex, pointIndex) {
  const seed = levelIndex * 17 + pointIndex * 31
  const count = 2 + (seed % 5)
  const rawShares = []
  let sum = 0
  for (let i = 0; i < count; i++) {
    const r = 30 + ((seed + i * 11) % 70)
    rawShares.push(r)
    sum += r
  }
  const segments = []
  for (let i = 0; i < count; i++) {
    const item = ALL_INDICATOR_ITEMS[(seed + i * 7) % ALL_INDICATOR_ITEMS.length]
    segments.push({
      key: item.key,
      label: item.label,
      color: item.color,
      share: rawShares[i] / sum,
    })
  }
  return segments
}

function getPointRadius(n) {
  return n > 100 ? 0.015 : n > 30 ? 0.02 : 0.025
}

function FunnelLevel({ pointsPerLevel, levelIndex, levelTitle, color, onPointClick, onOpenBpm, selectedPlanePoint, filterPlanePoint, filterByStatusKey, onPlanePointToggle, onPlanePointHover, hoveredPlanePoint, getEntityLabel, showRisks, riskTint, npv = 50, reserves = 50, extraction = 50, showHtmlOverlays = true, softRiskPalette = false, showFunnelLevelLabels = true, plainFunnelLayers = false, funnelLabelWithConnector = false, colorFunnelPointsByStatus = false, useNewDemoTreePointColors = false, onSelectedPointDetailsChange = null }) {
  const planeY = getPlaneY(levelIndex)
  const size = getPlaneSize(pointsPerLevel, levelIndex)
  const n = pointsPerLevel[levelIndex]
  const planeGeom = useMemo(() => new THREE.PlaneGeometry(size, size), [size])
  const points = useMemo(() => Array.from({ length: n }, (_, i) => i), [n])
  const isSelected = selectedPlanePoint && selectedPlanePoint.levelIndex === levelIndex
  const showOnlyFiltered = filterPlanePoint != null
  const showOnlyStatus = filterByStatusKey != null
  const showPoint = (pointIdx) => {
    if (showOnlyFiltered) return filterPlanePoint.levelIndex === levelIndex && filterPlanePoint.pointIndex === pointIdx
    if (showOnlyStatus) return getPlanePointStatus(levelIndex, pointIdx) === filterByStatusKey
    return true
  }
  const planeColor = !showRisks ? '#e8eef4' : null
  const planeOpacity = plainFunnelLayers && !showRisks ? 0 : showRisks ? 0.72 : 0.85
  const planeMeshRef = useRef(null)
  const lowColor = softRiskPalette ? NEW_DEMO_RISK_PALETTE.low : '#2e7d32'
  const highColor = softRiskPalette ? NEW_DEMO_RISK_PALETTE.high : '#d32f2f'
  const centerColor = softRiskPalette ? NEW_DEMO_RISK_PALETTE.center : '#f8fafc'
  const planeRiskUniforms = useMemo(
    () => ({
      colorRed: { value: new THREE.Color('#d32f2f') },
      colorGreen: { value: new THREE.Color('#2e7d32') },
      colorLow: { value: new THREE.Color(lowColor) },
      colorHigh: { value: new THREE.Color(highColor) },
      colorCenter: { value: new THREE.Color(centerColor) },
      opacity: { value: 0.72 },
      uNpv: { value: npv / 100 },
      uReserves: { value: reserves / 100 },
      uExtraction: { value: extraction / 100 },
      uUseSoftPalette: { value: softRiskPalette ? 1 : 0 },
    }),
    [centerColor, extraction, highColor, lowColor, npv, reserves, softRiskPalette]
  )
  useFrame(() => {
    if (!showRisks || !planeMeshRef.current?.material?.uniforms) return
    const u = planeMeshRef.current.material.uniforms
    u.uNpv.value = npv / 100
    u.uReserves.value = reserves / 100
    u.uExtraction.value = extraction / 100
  })

  const selectedPointIdx = isSelected && selectedPlanePoint ? selectedPlanePoint.pointIndex : null
  const cylinderSegments = useMemo(
    () => (selectedPointIdx != null ? getCylinderSegments(levelIndex, selectedPointIdx) : []),
    [levelIndex, selectedPointIdx]
  )
  const [pointX, , pointZ] = selectedPointIdx != null ? getPlanePointPosition(pointsPerLevel, levelIndex, selectedPointIdx) : [0, 0, 0]
  const cylinderBaseY = POINT_SPHERE_TOP
  const pointRadius = getPointRadius(n)
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState(null)
  useEffect(() => {
    if (!onSelectedPointDetailsChange || selectedPointIdx == null) {
      onSelectedPointDetailsChange?.(null)
      return
    }
    const pointName = getEntityLabel?.(levelIndex, selectedPointIdx) || `Точка ${selectedPointIdx + 1}`
    const metrics = cylinderSegments
      .filter((seg) => seg?.label && Number.isFinite(seg?.share))
      .map((seg) => ({
        color: seg.color,
        label: seg.label,
        value: `${(seg.share * 100).toFixed(1)}%`,
      }))
    onSelectedPointDetailsChange({
      levelIndex,
      levelTitle,
      pointIndex: selectedPointIdx,
      pointName,
      metrics,
    })
  }, [cylinderSegments, getEntityLabel, levelIndex, levelTitle, onSelectedPointDetailsChange, selectedPointIdx])

  return (
    <group position={[0, planeY, 0]}>
      <mesh ref={planeMeshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <primitive object={planeGeom} attach="geometry" />
        {showRisks ? (
          <shaderMaterial
            key={`risk-plane-${levelIndex}-${npv}-${reserves}-${extraction}-${softRiskPalette ? 1 : 0}`}
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
        if (!showPoint(idx)) return null
        const [x, , z] = getPlanePointPosition(pointsPerLevel, levelIndex, idx)
        const selected = selectedPlanePoint && selectedPlanePoint.levelIndex === levelIndex && selectedPlanePoint.pointIndex === idx
        const planeStatus = getPlanePointStatus(levelIndex, idx)
        const statusColor = PLANE_POINT_STATUS_COLORS[planeStatus] || PLANE_POINT_STATUS_COLORS.ok
        const pointColor = useNewDemoTreePointColors
          ? (selected ? '#E65907' : '#2FB4E9')
          : (selected || colorFunnelPointsByStatus ? statusColor : BASE_PLANE_POINT_COLOR)
        const isHovered = hoveredPlanePoint && hoveredPlanePoint.levelIndex === levelIndex && hoveredPlanePoint.pointIndex === idx
        return (
          <group key={idx}>
            <mesh
              position={[x, 0.01, z]}
              onClick={(e) => {
                e.stopPropagation()
                onPlanePointToggle(levelIndex, idx)
              }}
              onPointerOver={(e) => {
                e.stopPropagation()
                document.body.style.cursor = 'pointer'
                onPlanePointHover?.({ levelIndex, pointIndex: idx })
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'default'
                onPlanePointHover?.(null)
              }}
            >
              <sphereGeometry args={[pointRadius, 6, 6]} />
              <meshBasicMaterial color={pointColor} />
            </mesh>
            {showHtmlOverlays && isHovered && getEntityLabel && (
              <Html position={[x, 0.08, z]} center className={overlayStyles.funnelTooltipWrap}>
                <div className={`${overlayStyles.funnelEntityTooltip} ${overlayStyles.funnelPointTooltip}`}>
                  {getEntityLabel(levelIndex, idx)}
                </div>
              </Html>
            )}
          </group>
        )
      })}
      {selectedPointIdx != null && cylinderSegments.length > 0 && (
        <group position={[pointX, 0.01, pointZ]}>
          {cylinderSegments.map((seg, i) => {
            const segH = CYLINDER_HEIGHT * seg.share
            let segCenterY = cylinderBaseY
            for (let j = 0; j < i; j++) segCenterY += CYLINDER_HEIGHT * cylinderSegments[j].share
            segCenterY += segH / 2
            return (
              <group key={i}>
                <mesh
                  position={[0, segCenterY, 0]}
                  onPointerOver={() => setHoveredSegmentIndex(i)}
                  onPointerOut={() => setHoveredSegmentIndex(null)}
                >
                  <cylinderGeometry args={[pointRadius, pointRadius * 1.02, segH, 12]} />
                  <meshBasicMaterial color={seg.color} />
                </mesh>
                {showHtmlOverlays && hoveredSegmentIndex === i && (
                  <Html position={[0, segCenterY, pointRadius + 0.04]} center className={overlayStyles.funnelTooltipWrap}>
                    <div
                      className={`${overlayStyles.funnelEntityTooltip} ${overlayStyles.funnelPointTooltip} ${overlayStyles.funnelCylinderTooltip}`}
                      style={{ borderColor: seg.color }}
                    >
                      <span className={overlayStyles.cylinderTooltipLabel}>{seg.label}</span>
                      <span className={overlayStyles.cylinderTooltipPct}>{(seg.share * 100).toFixed(1)}%</span>
                    </div>
                  </Html>
                )}
              </group>
            )
          })}
          {showHtmlOverlays ? (
          <Html position={[0, cylinderBaseY + CYLINDER_HEIGHT + 0.08, 0]} center>
            <button
              type="button"
              className={overlayStyles.gotoBtn}
              onClick={(e) => {
                e.preventDefault()
                onPlanePointToggle(levelIndex, selectedPointIdx)
              }}
            >
              Закрыть
            </button>
          </Html>
          ) : null}
        </group>
      )}
      {showHtmlOverlays && showFunnelLevelLabels ? (
        <Html
          position={[size / 2 + 0.45, 0.06, 0]}
          center={false}
          transform={false}
          sprite={false}
        >
          <span className={`${overlayStyles.funnelLevelLabel} ${funnelLabelWithConnector ? overlayStyles.funnelLevelLabelLinked : ''}`}>
            {levelTitle}
          </span>
        </Html>
      ) : null}
    </group>
  )
}

function getCaseTreePosition(pointsPerLevel, key) {
  if (key === 'cube') return getVariantBasePosition(0)
  return getPlanePointPosition(pointsPerLevel, key[0], key[1])
}

function FunnelOfScenarios({ pointsPerLevel, selectedVariantId, onCloseVariant, selectedPlanePoint, onPlanePointClick, onPlanePointToggle, onPlanePointHover, hoveredPlanePoint, filterPlanePoint, filterByStatusKey, onOpenBpm, getEntityLabel, showRisks, npv = 50, reserves = 50, extraction = 50, highlightCaseTree, caseTreeRevealStep, showHtmlOverlays = true, softRiskPalette = false, showFunnelLevelLabels = true, plainFunnelLayers = false, funnelLabelWithConnector = false, colorFunnelPointsByStatus = false, useNewDemoTreePointColors = false, onSelectedPointDetailsChange = null, randomizeTreeBySelection = false }) {
  const n0 = pointsPerLevel[0]
  const fullCaseTreeSteps = useMemo(() => {
    const steps = [...CASE_TREE_STEPS]
    const n1 = pointsPerLevel[1] || 10
    const n2 = pointsPerLevel[2] || 30
    const toLevel1 = Array.from({ length: Math.min(6, n1) }, (_, k) => ({ from: [0, 1], to: [1, k] }))
    steps.push(toLevel1)
    const toLevel2 = []
    for (let i = 0; i < Math.min(4, n1); i++) {
      for (let j = 0; j < Math.min(4, n2); j++) toLevel2.push({ from: [1, i], to: [2, j] })
    }
    steps.push(toLevel2)
    return steps
  }, [pointsPerLevel])

  const caseTreeSegments = useMemo(() => {
    if (!highlightCaseTree || caseTreeRevealStep == null || caseTreeRevealStep < 0) return []
    const out = []
    for (let s = 0; s <= Math.min(caseTreeRevealStep, fullCaseTreeSteps.length - 1); s++) {
      fullCaseTreeSteps[s].forEach((seg) => {
        const start = getCaseTreePosition(pointsPerLevel, seg.from)
        const end = getCaseTreePosition(pointsPerLevel, seg.to)
        out.push({ start, end })
      })
    }
    return out
  }, [highlightCaseTree, caseTreeRevealStep, fullCaseTreeSteps, pointsPerLevel])

  const fullCaseTreeSegmentsAll = useMemo(() => {
    const out = []
    fullCaseTreeSteps.forEach((stepList) => {
      stepList.forEach((seg) => {
        out.push({
          start: getCaseTreePosition(pointsPerLevel, seg.from),
          end: getCaseTreePosition(pointsPerLevel, seg.to),
        })
      })
    })
    return out
  }, [fullCaseTreeSteps, pointsPerLevel])

  const fluxCurvesCubeToL0 = useMemo(() => {
    return Array.from({ length: Math.min(NUM_FLUX_CURVES, n0 * 7) }, (_, i) => {
      const idx = (i * 17) % NUM_POINTS
      const start = getVariantBasePosition(idx)
      const end = getPlanePointPosition(pointsPerLevel, 0, idx % n0)
      return { start: [start[0], start[1], start[2]], end }
    })
  }, [n0, pointsPerLevel])

  const fluxCurvesBetweenLevels = useMemo(() => {
    const pairs = []
    for (let l = 0; l < FUNNEL_LEVELS.length - 1; l++) {
      const nFrom = pointsPerLevel[l]
      const nTo = pointsPerLevel[l + 1]
      for (let j = 0; j < nFrom; j++) {
        const jTo = Math.floor((j * nTo) / nFrom) % nTo
        pairs.push({
          start: getPlanePointPosition(pointsPerLevel, l, j),
          end: getPlanePointPosition(pointsPerLevel, l + 1, jTo),
        })
      }
    }
    return pairs
  }, [pointsPerLevel])

  const selectedPathPoints = useMemo(() => {
    if (selectedVariantId == null && !highlightCaseTree) return []
    const pts = [getVariantBasePosition(selectedVariantId ?? 0)]
    for (let l = 0; l < FUNNEL_LEVELS.length; l++) {
      const idx = (selectedVariantId ?? 0) % pointsPerLevel[l]
      pts.push(getPlanePointPosition(pointsPerLevel, l, idx))
    }
    return pts
  }, [selectedVariantId, highlightCaseTree, pointsPerLevel])
  const selectedPathSegments = useMemo(() => {
    if (selectedPathPoints.length < 2) return []
    const out = []
    for (let i = 0; i < selectedPathPoints.length - 1; i++) {
      out.push({ start: selectedPathPoints[i], end: selectedPathPoints[i + 1] })
    }
    return out
  }, [selectedPathPoints])

  const randomTreeSegments = useMemo(() => {
    if (highlightCaseTree || selectedVariantId == null || !randomizeTreeBySelection) {
      return fullCaseTreeSegmentsAll
    }
    const seed = (selectedVariantId + 1) * 131 + pointsPerLevel.reduce((acc, n, i) => acc + n * (i + 17), 0)
    const rnd = seededRandom(seed)
    const minKeep = Math.max(8, Math.floor(fullCaseTreeSegmentsAll.length * 0.28))
    const maxKeep = Math.max(minKeep, Math.floor(fullCaseTreeSegmentsAll.length * 0.52))
    const target = Math.floor(minKeep + rnd() * (maxKeep - minKeep + 1))
    const out = []
    for (let i = 0; i < fullCaseTreeSegmentsAll.length; i++) {
      if (rnd() > 0.5) out.push(fullCaseTreeSegmentsAll[i])
      if (out.length >= target) break
    }
    if (out.length < target) {
      for (let i = 0; i < fullCaseTreeSegmentsAll.length && out.length < target; i++) {
        if (!out.includes(fullCaseTreeSegmentsAll[i])) out.push(fullCaseTreeSegmentsAll[i])
      }
    }
    return out
  }, [fullCaseTreeSegmentsAll, highlightCaseTree, pointsPerLevel, randomizeTreeBySelection, selectedVariantId])

  const showFunnel = selectedVariantId != null || highlightCaseTree
  if (!showFunnel) return null

  return (
    <group position={[0, 0, 0]}>
      {fluxCurvesCubeToL0.map(({ start, end }, i) => (
        <CurveLine
          key={`c-${i}`}
          start={start}
          end={end}
          color={i % 2 === 0 ? CONNECTOR_BLUE : CONNECTOR_WHITE}
          opacity={highlightCaseTree ? 0.2 : 0.48}
          accentColor={i % 2 === 0 ? CONNECTOR_WHITE : CONNECTOR_BLUE}
          accentOpacity={highlightCaseTree ? 0.12 : 0.2}
          seed={i}
        />
      ))}
      {fluxCurvesBetweenLevels.map(({ start, end }, i) => (
        <CurveLine
          key={`l-${i}`}
          start={start}
          end={end}
          color={i % 2 === 0 ? CONNECTOR_BLUE : CONNECTOR_WHITE}
          opacity={highlightCaseTree ? 0.18 : 0.44}
          accentColor={i % 2 === 0 ? CONNECTOR_WHITE : CONNECTOR_BLUE}
          accentOpacity={highlightCaseTree ? 0.1 : 0.18}
          seed={i + 100}
        />
      ))}
      {highlightCaseTree && caseTreeSegments.map(({ start, end }, i) => (
        <CurveLine
          key={`case-${i}`}
          start={start}
          end={end}
          color={i % 2 === 0 ? CONNECTOR_BLUE : CONNECTOR_WHITE}
          accentColor={i % 2 === 0 ? CONNECTOR_WHITE : CONNECTOR_BLUE}
          accentOpacity={0.22}
          opacity={0.9}
          seed={i + 300}
        />
      ))}
      {!highlightCaseTree && selectedVariantId != null && randomTreeSegments.map(({ start, end }, i) => (
        <CurveLine
          key={`full-${i}`}
          start={start}
          end={end}
          color={i % 2 === 0 ? CONNECTOR_BLUE : CONNECTOR_WHITE}
          accentColor={i % 2 === 0 ? CONNECTOR_WHITE : CONNECTOR_BLUE}
          accentOpacity={0.18}
          opacity={0.78}
          seed={i + 400}
        />
      ))}
      {!highlightCaseTree && selectedVariantId != null && selectedPathSegments.map(({ start, end }, i) => (
        <CurveLine
          key={`selected-path-${i}`}
          start={start}
          end={end}
          color="#E65907"
          accentColor="#ffffff"
          accentOpacity={0.24}
          opacity={0.94}
          seed={i + 700}
        />
      ))}
      {FUNNEL_LEVELS.map((level, idx) => (
        <FunnelLevel
          key={level.title}
          pointsPerLevel={pointsPerLevel}
          levelIndex={idx}
          levelTitle={level.title}
          color={PLANE_LEVEL_COLORS[idx]}
          onPointClick={onPlanePointClick}
          onPlanePointToggle={onPlanePointToggle}
          onPlanePointHover={onPlanePointHover}
          hoveredPlanePoint={hoveredPlanePoint}
          filterPlanePoint={filterPlanePoint}
          filterByStatusKey={filterByStatusKey}
          onOpenBpm={onOpenBpm}
          selectedPlanePoint={selectedPlanePoint}
          getEntityLabel={getEntityLabel}
          showRisks={showRisks}
          riskTint={showRisks ? RISK_TINT_BY_LEVEL[idx] : null}
          npv={npv}
          reserves={reserves}
          extraction={extraction}
          showHtmlOverlays={showHtmlOverlays}
          softRiskPalette={softRiskPalette}
          showFunnelLevelLabels={showFunnelLevelLabels}
          plainFunnelLayers={plainFunnelLayers}
          funnelLabelWithConnector={funnelLabelWithConnector}
          colorFunnelPointsByStatus={colorFunnelPointsByStatus}
          useNewDemoTreePointColors={useNewDemoTreePointColors}
          onSelectedPointDetailsChange={onSelectedPointDetailsChange}
        />
      ))}
    </group>
  )
}

const AXIS_LABEL_OFFSET = 0.2
const ARROW_TIP_OFFSET = 0.2
const axisLabelPositions = [
  { position: [AXIS_ORIGIN + AXIS_LEN + ARROW_TIP_OFFSET + AXIS_LABEL_OFFSET, AXIS_ORIGIN, AXIS_ORIGIN], short: 'NPV' },
  { position: [AXIS_ORIGIN, AXIS_ORIGIN + AXIS_LEN + ARROW_TIP_OFFSET + AXIS_LABEL_OFFSET, AXIS_ORIGIN], short: 'Запасы' },
  { position: [AXIS_ORIGIN, AXIS_ORIGIN, AXIS_ORIGIN + AXIS_LEN + ARROW_TIP_OFFSET + AXIS_LABEL_OFFSET], short: 'Добыча' },
]

export function HypercubeR3FScene({ npv, reserves, extraction, pointsPerLevel, onPointClick, onOpenBpm, selectedVariantId, onCloseVariant, selectedPlanePoint, onPlanePointClick, onPlanePointToggle, onPlanePointHover, hoveredPlanePoint, filterPlanePoint, filterByStatusKey, getEntityLabel, showRisks, filterVariantType, highlightCaseTree, caseTreeRevealStep, visualPreset = "default", showHtmlOverlays = true, showFunnelLevelLabels = true, sceneOffsetY = 0, plainFunnelLayers = false, funnelLabelWithConnector = false, enableVerticalMousePan = false, colorFunnelPointsByStatus = false, useNewDemoTreePointColors = false, onSelectedPointDetailsChange = null, randomizeTreeBySelection = false }) {
  const points = useMemo(() => Array.from({ length: NUM_POINTS }, (_, i) => i), [])
  const isMini = visualPreset === "newDemoMini"
  const isNewDemo = isMini || visualPreset === "newDemo"
  const allowFunnelInteractions = !isMini
  const variantPalette = isNewDemo ? NEW_DEMO_VARIANT_COLORS : VARIANT_COLORS
  const wireframeColor = isMini ? '#2ecbff' : '#5b8dc9'
  const wireframeOpacity = isMini ? 0.58 : 0.75

  return (
    <>
      <ambientLight intensity={0.9} />
      <pointLight position={[4, 4, 4]} intensity={1} />
      <pointLight position={[-4, -4, 4]} intensity={0.4} />

      <group position={[0, sceneOffsetY, 0]}>
        {showRisks && <RiskZones npv={npv} reserves={reserves} extraction={extraction} softPalette={isNewDemo} />}
        <AxesFromBottomLeft
          npv={npv}
          reserves={reserves}
          extraction={extraction}
          showTickLabels={showHtmlOverlays && !isMini}
        />
        <group>
          <WireframeCube color={wireframeColor} opacity={wireframeOpacity} />
          {points.map((id) => (
            <VariantPoint
              key={id}
              variantId={id}
              npv={npv}
              reserves={reserves}
              extraction={extraction}
              onPointClick={allowFunnelInteractions ? onPointClick : () => {}}
              filterVariantType={filterVariantType}
              palette={variantPalette}
              glowVariantType={isNewDemo ? 'applicable' : null}
            />
          ))}
        </group>

        <FunnelOfScenarios
          pointsPerLevel={pointsPerLevel}
          selectedVariantId={allowFunnelInteractions ? selectedVariantId : null}
          onCloseVariant={onCloseVariant}
          selectedPlanePoint={selectedPlanePoint}
          onPlanePointClick={onPlanePointClick}
          onPlanePointToggle={onPlanePointToggle}
          onPlanePointHover={onPlanePointHover}
          hoveredPlanePoint={hoveredPlanePoint}
          filterPlanePoint={filterPlanePoint}
          filterByStatusKey={filterByStatusKey}
          onOpenBpm={onOpenBpm}
          getEntityLabel={getEntityLabel}
          showRisks={showRisks}
          npv={npv}
          reserves={reserves}
          extraction={extraction}
          highlightCaseTree={highlightCaseTree}
          caseTreeRevealStep={caseTreeRevealStep}
          showHtmlOverlays={showHtmlOverlays && !isMini}
          softRiskPalette={isNewDemo}
          showFunnelLevelLabels={showFunnelLevelLabels}
          plainFunnelLayers={plainFunnelLayers}
          funnelLabelWithConnector={funnelLabelWithConnector}
          colorFunnelPointsByStatus={colorFunnelPointsByStatus}
          useNewDemoTreePointColors={useNewDemoTreePointColors}
          onSelectedPointDetailsChange={onSelectedPointDetailsChange}
          randomizeTreeBySelection={randomizeTreeBySelection}
        />
      </group>


      <OrbitControls
        enableZoom={!isMini}
        enablePan={!isMini}
        screenSpacePanning={enableVerticalMousePan}
        panSpeed={enableVerticalMousePan ? 1.2 : 1}
        minPolarAngle={Math.PI / 2}
        maxPolarAngle={Math.PI / 2}
        enableRotate
        minDistance={isMini ? 6 : undefined}
        maxDistance={isMini ? 6 : undefined}
      />

      {showHtmlOverlays && !isMini ? axisLabelPositions.map(({ position, short }) => (
        <Html
          key={short}
          position={[position[0], position[1] + sceneOffsetY, position[2]]}
          center
          className={overlayStyles.axisLabelHtml}
        >
          <span className={overlayStyles.axisLabel}>{short}</span>
        </Html>
      )) : null}
    </>
  )
}
