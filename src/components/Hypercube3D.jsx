import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
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
  { title: 'ЦД программ' },
  { title: 'ЦД объекта' },
  { title: 'Сервисы' },
  { title: 'Микросервисы' },
  { title: 'Функции' },
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

const AXIS_ORIGIN = -CUBE_HALF + 0.05
const AXIS_LEN = CUBE_HALF * 2 - 0.1
const TICK_STEP = 0.5
const TICK_SIZE = 0.03

function AxisLine({ from, to, color }) {
  const geom = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...from), new THREE.Vector3(...to)]), [from, to])
  return <line geometry={geom}><lineBasicMaterial color={color} /></line>
}

function AxisArrow({ end, dir, color }) {
  const coneH = 0.08
  const coneR = 0.04
  const pos = [...end]
  const rot = dir === 'x' ? [0, -Math.PI / 2, 0] : dir === 'y' ? [Math.PI / 2, 0, 0] : [0, 0, 0]
  return (
    <mesh position={pos} rotation={rot}>
      <coneGeometry args={[coneR, coneH, 8]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

function AxesFromBottomLeft() {
  const origin = AXIS_ORIGIN
  const axisLen = AXIS_LEN
  const axes = useMemo(() => [
    { dir: 'x', from: [origin, origin, origin], to: [origin + axisLen, origin, origin], color: '#1f2937' },
    { dir: 'y', from: [origin, origin, origin], to: [origin, origin + axisLen, origin], color: '#374151' },
    { dir: 'z', from: [origin, origin, origin], to: [origin, origin, origin + axisLen], color: '#4b5563' },
  ], [])
  const tickValues = useMemo(() => {
    const n = Math.max(1, Math.floor(axisLen / TICK_STEP) - 1)
    return Array.from({ length: n }, (_, i) => origin + (i + 1) * TICK_STEP)
  }, [])
  return (
    <group>
      {axes.map(({ dir, from, to, color }) => (
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
            return <AxisLine key={v} from={tickFrom} to={tickTo} color={color} />
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
    float sumNorm = (uNpv + uReserves + uExtraction) / 3.0;
    float shift = sumNorm * 8.0 - 2.0;
    float s1 = sin((z + shift) * 3.0) * 0.25 + sin((y + shift * 0.8) * 2.5) * 0.2;
    float s2 = sin((x + shift * 0.6) * 3.2) * 0.2 + sin((z + y + shift) * 2.2) * 0.25;
    float v1 = x + 0.5 * y + s1;
    float v2 = -0.7 * x + 0.6 * y + 0.4 * z + s2;
    float t = v1 - v2 + shift * 1.2;
    float voidWidth = 0.05;
    float redMul = 1.0 - sumNorm;
    float greenMul = sumNorm;
    float isRed = step(voidWidth, t) * redMul;
    float isGreen = step(voidWidth, -t) * greenMul;
    float inVoid = 1.0 - step(voidWidth, abs(t));
    vec3 col = isRed * colorRed + isGreen * colorGreen;
    float alpha = (1.0 - inVoid) * opacity * max(redMul, greenMul) * 1.2;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.85));
  }
`

function RiskZones({ npv = 50, reserves = 50, extraction = 50 }) {
  const meshRef = useRef(null)
  const uniforms = useMemo(
    () => ({
      colorRed: { value: RISK_VOLUME_COLORS.red.clone() },
      colorGreen: { value: RISK_VOLUME_COLORS.green.clone() },
      opacity: { value: RISK_ZONE_OPACITY },
      uNpv: { value: npv / 100 },
      uReserves: { value: reserves / 100 },
      uExtraction: { value: extraction / 100 },
    }),
    []
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
  const T = Math.min(1, Math.max(0, t))
  if (T <= 0.05) return '#dc2626'
  if (T >= 0.95) return '#16a34a'
  return '#2d5a87'
}

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

const INDICATOR_BASKETS = {
  'Проблемы в данных': [
    { key: 'no_data', label: 'Нет данных', color: '#374151' },
    { key: 'fluctuation', label: 'Флуктуации данных', color: '#6b7280' },
    { key: 'asymmetry', label: 'Асимметрия распределения', color: '#78350f' },
    { key: 'non_normal', label: 'Распределение ненормальное', color: '#57534e' },
  ],
  'Проблемы с расчётом и риски': [
    { key: 'bad_calc', label: 'Невалидный расчёт', color: '#ea580c' },
    { key: 'bad_excess', label: 'Невалидный коэффициент эксцесса', color: '#c2410c' },
    { key: 'no_executor', label: 'Не назначен исполнитель', color: '#dc2626' },
    { key: 'no_approver', label: 'Нет согласующего', color: '#ca8a04' },
    { key: 'no_deadline', label: 'Нет срока', color: '#b45309' },
    { key: 'critical', label: 'Критично', color: '#be185d' },
  ],
  'Норма': [
    { key: 'ok', label: 'Норма', color: '#2563eb' },
  ],
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
    float sumNorm = (uNpv + uReserves + uExtraction) / 3.0;
    float shift = sumNorm * 10.0 - 2.5;
    float t1 = x * 1.2 + z * 0.8 + 0.12 * sin((z + shift) * 14.0);
    float t2 = -x * 0.8 + z * 1.0 + 0.12 * sin((x + shift * 0.8) * 12.0);
    float t = t1 - t2 + shift * 0.8;
    float voidWidth = 0.04;
    float redMul = 1.0 - sumNorm;
    float greenMul = sumNorm;
    float isRed = step(voidWidth, t) * redMul;
    float isGreen = step(voidWidth, -t) * greenMul;
    float inVoid = 1.0 - step(voidWidth, abs(t));
    vec3 col = isRed * colorRed + isGreen * colorGreen;
    float alpha = (1.0 - inVoid) * opacity * max(redMul, greenMul);
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.85));
  }
`

function FunnelLevel({ levelIndex, levelTitle, color, onPointClick, onOpenBpm, selectedPlanePoint, filterPlanePoint, filterByStatusKey, onPlanePointToggle, getEntityLabel, showRisks, riskTint, npv = 50, reserves = 50, extraction = 50 }) {
  const planeY = getPlaneY(levelIndex)
  const size = getPlaneSize(levelIndex)
  const n = POINTS_PER_LEVEL[levelIndex]
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
  const planeOpacity = showRisks ? 0.72 : 0.85
  const planeMeshRef = useRef(null)
  const planeRiskUniforms = useMemo(
    () => ({
      colorRed: { value: new THREE.Color('#d32f2f') },
      colorGreen: { value: new THREE.Color('#2e7d32') },
      opacity: { value: 0.72 },
      uNpv: { value: npv / 100 },
      uReserves: { value: reserves / 100 },
      uExtraction: { value: extraction / 100 },
    }),
    []
  )
  useFrame(() => {
    if (!showRisks || !planeMeshRef.current?.material?.uniforms) return
    const u = planeMeshRef.current.material.uniforms
    u.uNpv.value = npv / 100
    u.uReserves.value = reserves / 100
    u.uExtraction.value = extraction / 100
  })

  return (
    <group position={[0, planeY, 0]}>
      <mesh ref={planeMeshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
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
        if (!showPoint(idx)) return null
        const [x, , z] = getPlanePointPosition(levelIndex, idx)
        const selected = selectedPlanePoint && selectedPlanePoint.levelIndex === levelIndex && selectedPlanePoint.pointIndex === idx
        const planeStatus = getPlanePointStatus(levelIndex, idx)
        const pointColor = selected ? '#2d5a87' : (PLANE_POINT_STATUS_COLORS[planeStatus] || PLANE_POINT_STATUS_COLORS.ok)
        return (
          <mesh
            key={idx}
            position={[x, 0.01, z]}
            onClick={(e) => {
              e.stopPropagation()
              onPlanePointToggle(levelIndex, idx)
            }}
            onPointerOver={() => { document.body.style.cursor = 'pointer' }}
            onPointerOut={() => { document.body.style.cursor = 'default' }}
          >
            <sphereGeometry args={[n > 100 ? 0.015 : n > 30 ? 0.02 : 0.025, 6, 6]} />
            <meshBasicMaterial color={pointColor} />
          </mesh>
        )
      })}
      <Html position={[size / 2 + 0.45, 0.06, 0]} center>
        <span className="funnel-level-label">{levelTitle}</span>
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

function FunnelOfScenarios({ selectedVariantId, onCloseVariant, selectedPlanePoint, onPlanePointClick, onPlanePointToggle, filterPlanePoint, filterByStatusKey, onOpenBpm, getEntityLabel, showRisks, npv = 50, reserves = 50, extraction = 50 }) {
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
          levelTitle={level.title}
          color={PLANE_LEVEL_COLORS[idx]}
          onPointClick={onPlanePointClick}
          onPlanePointToggle={onPlanePointToggle}
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
        />
      ))}
    </group>
  )
}

const AXIS_LABELS = [
  { position: [CUBE_HALF + 0.4, 0, 0], short: 'NPV', full: 'NPV — оперативный рычаг, деньги за год (млн руб)' },
  { position: [0, CUBE_HALF + 0.4, 0], short: 'Запасы', full: 'Запасы — стратегический рычаг, суммарная добыча нефти/КИН за 30 лет (млн т)' },
  { position: [0, 0, CUBE_HALF + 0.4], short: 'Добыча (Q)', full: 'Добыча (Q) — оперативный рычаг добычи нефти за год (млн т)' },
]

function Scene({ npv, reserves, extraction, onPointClick, onOpenBpm, selectedVariantId, onCloseVariant, selectedPlanePoint, onPlanePointClick, onPlanePointToggle, filterPlanePoint, filterByStatusKey, getEntityLabel, showRisks }) {
  const points = useMemo(() => Array.from({ length: NUM_POINTS }, (_, i) => i), [])
  const [axisTooltip, setAxisTooltip] = useState(null)

  return (
    <>
      <ambientLight intensity={0.9} />
      <pointLight position={[4, 4, 4]} intensity={1} />
      <pointLight position={[-4, -4, 4]} intensity={0.4} />

      {showRisks && <RiskZones npv={npv} reserves={reserves} extraction={extraction} />}
      <AxesFromBottomLeft />
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
        onPlanePointToggle={onPlanePointToggle}
        filterPlanePoint={filterPlanePoint}
        filterByStatusKey={filterByStatusKey}
        onOpenBpm={onOpenBpm}
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

      {AXIS_LABELS.map(({ position, short, full }) => (
        <Html key={short} position={position} center>
          <div
            className="cube-axis-label-wrap"
            onPointerEnter={() => setAxisTooltip(full)}
            onPointerLeave={() => setAxisTooltip(null)}
          >
            <span className="cube-axis-label">{short}</span>
            {axisTooltip === full && (
              <div className="cube-axis-tooltip" role="tooltip">{full}</div>
            )}
          </div>
        </Html>
      ))}
    </>
  )
}

function toMillions(pct, scale) {
  return ((pct / 100) * scale).toFixed(2)
}

function Hypercube3D({ onOpenBpm }) {
  const [npv, setNpv] = useState(50)
  const [reserves, setReserves] = useState(50)
  const [extraction, setExtraction] = useState(50)
  const [selectedVariantId, setSelectedVariantId] = useState(null)
  const [selectedPlanePoint, setSelectedPlanePoint] = useState(null)
  const [filterPlanePoint, setFilterPlanePoint] = useState(null)
  const [filterByStatusKey, setFilterByStatusKey] = useState(null)
  const [getEntityLabel, setGetEntityLabel] = useState(() => defaultGetEntityLabel)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showRisks, setShowRisks] = useState(false)
  const cubeCanvasRef = useRef(null)

  const handlePlanePointToggle = useCallback((levelIndex, pointIndex) => {
    const same = filterPlanePoint && filterPlanePoint.levelIndex === levelIndex && filterPlanePoint.pointIndex === pointIndex
    if (same) {
      setFilterPlanePoint(null)
      setSelectedPlanePoint(null)
    } else {
      setFilterPlanePoint({ levelIndex, pointIndex })
      setSelectedPlanePoint({ levelIndex, pointIndex })
      const label = getEntityLabel(levelIndex, pointIndex)
      onOpenBpm(label)
    }
  }, [filterPlanePoint, getEntityLabel, onOpenBpm])

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
        <div className="control-group control-group-inline">
          <label className="slider-full-label">
            NPV (оперативный рычаг — деньги за год): {npv}% ({npvMillions} млн руб)
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={npv}
            onChange={(e) => setNpv(Number(e.target.value))}
            className={`slider ${npv <= 5 ? 'slider-low' : npv >= 95 ? 'slider-high' : ''}`}
          />
        </div>
        <div className="control-group control-group-inline">
          <label className="slider-full-label">
            Запасы (стратегический рычаг — суммарная добыча нефти/КИН за 30 лет): {reserves}% ({reservesMillions} млн т)
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={reserves}
            onChange={(e) => setReserves(Number(e.target.value))}
            className={`slider ${reserves <= 5 ? 'slider-low' : reserves >= 95 ? 'slider-high' : ''}`}
          />
        </div>
        <div className="control-group control-group-inline">
          <label className="slider-full-label">
            Добыча (Q, млн т) — оперативный рычаг добычи нефти за год: {extraction}% ({extractionMillions} млн т)
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={extraction}
            onChange={(e) => setExtraction(Number(e.target.value))}
            className={`slider ${extraction <= 5 ? 'slider-low' : extraction >= 95 ? 'slider-high' : ''}`}
          />
        </div>
      </div>

      <div className="hypercube-visualization">
        <div className="cube-info">
          <h3>Гиперкуб рычагов влияния (параметры в млн)</h3>
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
            Точки на плоскостях — по индикаторам состояния (клик по пункту легенды: показать только такие; повторный клик — все).
          </p>
          <div className="cube-palette-legend">
            <span className="cube-legend-cold">Низкие</span>
            <div className="cube-legend-gradient" />
            <span className="cube-legend-hot">Высокие</span>
          </div>
          <div className="cube-points-legend">
            <span className="cube-plane-legend-title">Точки внутри куба (варианты)</span>
            <div className="cube-plane-legend-items cube-plane-legend-items-rows">
              <span className="cube-legend-point" style={{ color: '#dc2626' }}>●</span>
              <span className="cube-legend-point-desc">Низкие рычаги</span>
              <span className="cube-legend-point" style={{ color: '#2d5a87' }}>●</span>
              <span className="cube-legend-point-desc">Средние</span>
              <span className="cube-legend-point" style={{ color: '#16a34a' }}>●</span>
              <span className="cube-legend-point-desc">Высокие рычаги</span>
            </div>
          </div>
          <div className="cube-plane-legend">
            <span className="cube-plane-legend-title">Индикаторы состояния</span>
            {Object.entries(INDICATOR_BASKETS).map(([groupName, items]) => (
              <div key={groupName} className="cube-indicator-basket">
                <span className="cube-indicator-basket-name">{groupName}</span>
                <div className="cube-plane-legend-items cube-plane-legend-items-rows">
                  {items.map(({ key, label, color }) => (
                    <button
                      key={key}
                      type="button"
                      className={`cube-indicator-legend-item ${filterByStatusKey === key ? 'cube-indicator-legend-item-on' : ''}`}
                      style={{ color }}
                      onClick={() => setFilterByStatusKey((prev) => (prev === key ? null : key))}
                    >
                      ● {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
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
            {selectedVariantId != null && (
              <button
                type="button"
                className="cube-close-funnel-btn"
                onClick={() => { setSelectedVariantId(null); setSelectedPlanePoint(null); setFilterPlanePoint(null) }}
                aria-label="Закрыть воронку"
                title="Закрыть воронку сквозных сценариев"
              >
                Закрыть воронку
              </button>
            )}
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
                onCloseVariant={() => { setSelectedVariantId(null); setSelectedPlanePoint(null); setFilterPlanePoint(null) }}
                selectedPlanePoint={selectedPlanePoint}
                onPlanePointClick={(levelIndex, pointIndex) => setSelectedPlanePoint({ levelIndex, pointIndex })}
                onPlanePointToggle={handlePlanePointToggle}
                filterPlanePoint={filterPlanePoint}
                filterByStatusKey={filterByStatusKey}
                onOpenBpm={onOpenBpm}
                getEntityLabel={getEntityLabel}
                showRisks={showRisks}
              />
            </Canvas>
            </div>
          </div>
        </div>
      </div>

      <div className="hypercube-instructions">
        <p>Наведите на названия осей (NPV, Запасы, Добыча) для полного описания. Точки куба — по рычагам; точки на плоскостях воронки — по статусу ЦД (см. легенду). Нажмите на точку куба — откроется воронка сквозных сценариев.</p>
      </div>
    </div>
  )
}

export default Hypercube3D
