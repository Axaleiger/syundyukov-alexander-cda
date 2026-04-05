import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import * as THREE from 'three'
import { useMapGlobeData } from '../model/useMapGlobeData'
import styles from './RussiaGlobe.module.css'
import { simplifyFeatures } from '../../../shared/lib/simplifyGeoJsonRing'
import { geojsonFeaturesToPaths } from '../../../shared/lib/geojsonToPaths'
import { buildAssetVoronoiFeatures } from '../../../shared/lib/assetVoronoiZones'

/** Макс. размер canvas (пиксели) — снижает нагрузку на GPU */
const MAX_GLOBE_W = 1200
const MAX_GLOBE_H = 860

/** Береговая линия материков и крупных островов (без политических границ). Natural Earth 50m / 110m. */
const worldCoastlineUrl50m = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_coastline.geojson'
const worldCoastlineUrl110m = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_coastline.geojson'

/** Прямоугольник для Voronoi зон вокруг активов (РФ + запас по краям). */
const ASSET_VORONOI_BBOX = { lngMin: 18, lngMax: 138, latMin: 39, latMax: 76 }

/** Стартовая широта центра кадра. Tilt пользователем запрещён. */
const POV_LAT_DEFAULT = 62
/** Стартовый зум: Россия крупно; дальше отодвинуть нельзя (только приближать). */
// Slightly more zoomed out by default (to reveal the top cap).
// Russia face-on by default (center of RF), slightly zoomed out to see the cap.
const DEFAULT_POV = { lat: POV_LAT_DEFAULT, lng: 90, altitude: 0.72 }
const STARFIELD_URL = 'https://unpkg.com/three-globe@2.45.1/example/img/night-sky.png'
// (texture-only) EARTH_DAY intentionally not used for monochrome rendering
// const EARTH_DAY = 'https://unpkg.com/three-globe@2.45.1/example/img/earth-day.jpg'

// Жёсткий коридор центра кадра по долготе (только «полоса» России).
// lngMin выше: при листании на запад левый край кадра не уезжает в ЕС/Прибалтику (как барьер справа для ДВ).
const POV_BOUNDS = {
  // Lat is fixed for user interaction. We may shift it automatically on asset focus.
  latMin: 52,
  latMax: 68,
  // Narrower RF-only longitude window (no Europe far west, no far east beyond RF).
  lngMin: 60,
  lngMax: 120,
  /** Only zooming in: do not allow zooming out beyond default. */
  altMin: 0.32,
  altMax: DEFAULT_POV.altitude,
}

const TOP_SPACE_PX = 18

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

/** Долгота в градусах [-180, 180] для сравнения с коридором РФ. */
function normalizeLngDeg(lng) {
  if (!Number.isFinite(lng)) return DEFAULT_POV.lng
  let x = lng
  while (x > 180) x -= 360
  while (x < -180) x += 360
  return x
}

function canCreateWebGLContext() {
  try {
    const canvas = document.createElement('canvas')
    const gl2 = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true })
    if (gl2) return { ok: true, kind: 'webgl2' }
    const gl1 = canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true }) || canvas.getContext('experimental-webgl')
    if (gl1) return { ok: true, kind: 'webgl1' }
    return { ok: false, kind: null }
  } catch (e) {
    return { ok: false, kind: null, error: String(e?.message || e) }
  }
}

export default function RussiaGlobe({ onAssetSelect }) {
  const { mapPointsData, cfArrows: CF_ARROWS, chainsData, getBudgetForAssetId } = useMapGlobeData()

  const globeRef = useRef(null)
  const containerRef = useRef(null)
  const arrowGeomRef = useRef(null)
  const arrowMatRef = useRef(null)
  const globeMaterial = useMemo(() => {
    // Monochrome globe surface: no colorful earth texture (mountains/oceans/ice stay single-tone).
    return new THREE.MeshPhongMaterial({
      color: new THREE.Color('#071827'),
      emissive: new THREE.Color('#071827'),
      shininess: 6,
    })
  }, [])

  const [size, setSize] = useState({ width: 800, height: 620 })
  const [coastlinePaths, setCoastlinePaths] = useState([])
  const [webglOk, setWebglOk] = useState(true)

  const [showBudgetFill, setShowBudgetFill] = useState(false)
  const [showCFArrows, setShowCFArrows] = useState(false)

  const [selectedAssetId, setSelectedAssetId] = useState(null)
  const [hoveredAssetId, setHoveredAssetId] = useState(null)
  const [hoveredArcIndex, setHoveredArcIndex] = useState(null)

  const keyAssetIds = useMemo(() => new Set(['do-yamal', 'do-noyabrsk', 'do-megion']), [])
  const latFixedRef = useRef(DEFAULT_POV.lat)

  /** Рекурсия change → pointOfView → change (не отключать кламп целиком). */
  const applyingPovClampRef = useRef(false)
  const controlsCleanupRef = useRef(null)
  /** Чтобы не вызывать install до первого onGlobeReady и не сбивать POV. */
  const povBarriersArmedRef = useRef(false)

  const applyLowPixelRatio = useCallback(() => {
    try {
      const g = globeRef.current
      const r = g?.renderer?.()
      if (r?.setPixelRatio) r.setPixelRatio(Math.min(1.25, window.devicePixelRatio || 1))
    } catch (_) { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!webglOk) return
    const id = requestAnimationFrame(applyLowPixelRatio)
    return () => cancelAnimationFrame(id)
  }, [size.width, size.height, webglOk, applyLowPixelRatio])

  useEffect(() => {
    const webgl = canCreateWebGLContext()
    setWebglOk(!!webgl.ok)

    const el = containerRef.current
    if (!el) return
    let resizeRaf = 0
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      if (resizeRaf) cancelAnimationFrame(resizeRaf)
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0
        const { width, height } = entry.contentRect
        const w = Math.min(MAX_GLOBE_W, Math.max(320, Math.floor(width)))
        const h = Math.min(MAX_GLOBE_H, Math.max(380, Math.floor((height || 480) * 0.96)))
        setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }))
      })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadCoastlines() {
      const tryUrls = [worldCoastlineUrl50m, worldCoastlineUrl110m]
      for (const url of tryUrls) {
        try {
          const r = await fetch(url)
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          const json = await r.json()
          if (cancelled) return
          const feats = Array.isArray(json?.features) ? json.features : []
          const simplified = simplifyFeatures(feats, 200)
          setCoastlinePaths(
            geojsonFeaturesToPaths(simplified, { alt: 0.0026, maxPointsPerRing: 260, datelineJumpDeg: 180 }, 'coast')
          )
          return
        } catch (_) {
          // try next url
        }
      }
      if (!cancelled) setCoastlinePaths([])
    }
    const t = window.setTimeout(() => { loadCoastlines() }, 600)
    return () => { cancelled = true }
  }, [])

  const installPovBarriers = useCallback((options = { resetPov: true }) => {
    applyLowPixelRatio()
    const globe = globeRef.current
    if (!globe) return

    const controls = typeof globe.controls === 'function' ? globe.controls() : null
    if (!controls) return

    controlsCleanupRef.current?.()
    controlsCleanupRef.current = null

    if (options.resetPov) {
      globe.pointOfView(DEFAULT_POV, 0)
    }

    controls.enablePan = false
    controls.enableDamping = false
    controls.rotateSpeed = 0.5
    controls.zoomSpeed = 0.65
    // Tilt is forbidden: lock polar. We allow auto-shift of lat via latFixedRef.
    const basePolar = ((90 - (latFixedRef.current ?? DEFAULT_POV.lat)) * Math.PI) / 180
    const polar = Math.max(0.01, Math.min(Math.PI - 0.01, basePolar))
    controls.minPolarAngle = polar
    controls.maxPolarAngle = polar

    // Hard azimuth bounds to keep user within RF longitudes (reduce jerk vs snap-back).
    controls.minAzimuthAngle = -Math.PI * 0.32
    controls.maxAzimuthAngle = Math.PI * 0.32

    try {
      const cam = globe.camera?.()
      if (cam?.position) {
        const dist = cam.position.length()
        if (Number.isFinite(dist) && dist > 0) {
          // Do not allow zooming out beyond the initial distance.
          controls.maxDistance = dist
          controls.minDistance = dist * 0.38
        }
      }
    } catch (_) { /* ignore */ }

    const applyPovClamp = () => {
      if (applyingPovClampRef.current) return
      let pov
      try {
        pov = globe.pointOfView()
      } catch (_) {
        return
      }
      if (!pov || !Number.isFinite(pov.lng)) return

      const rawLat = pov.lat
      const latTarget = Number.isFinite(latFixedRef.current) ? latFixedRef.current : DEFAULT_POV.lat
      const lat = clamp(latTarget, POV_BOUNDS.latMin, POV_BOUNDS.latMax)
      const rawLng = normalizeLngDeg(pov.lng)
      const lng = Math.max(POV_BOUNDS.lngMin, Math.min(POV_BOUNDS.lngMax, rawLng))
      const altRaw = pov.altitude
      const alt = Number.isFinite(altRaw)
        ? Math.max(POV_BOUNDS.altMin, Math.min(POV_BOUNDS.altMax, altRaw))
        : DEFAULT_POV.altitude
      // rawLat already read above

      const eps = 1e-6
      const needLat = !Number.isFinite(rawLat) || Math.abs(rawLat - lat) > eps
      const needLng = Math.abs(rawLng - lng) > eps
      const needAlt = !Number.isFinite(altRaw) || Math.abs(altRaw - alt) > eps

      if (!needLat && !needLng && !needAlt) return

      applyingPovClampRef.current = true
      try {
        globe.pointOfView({ lat, lng, alt }, 0)
        controls.update?.()
      } finally {
        applyingPovClampRef.current = false
      }
    }

    applyPovClamp()

    const onControlsChange = () => applyPovClamp()

    let rafId = 0
    const povGuardLoop = () => {
      rafId = requestAnimationFrame(povGuardLoop)
      applyPovClamp()
    }
    rafId = requestAnimationFrame(povGuardLoop)

    controls.addEventListener('change', onControlsChange)
    controlsCleanupRef.current = () => {
      cancelAnimationFrame(rafId)
      controls.removeEventListener('change', onControlsChange)
      povBarriersArmedRef.current = false
    }
    povBarriersArmedRef.current = true
  }, [applyLowPixelRatio])

  const handleGlobeReady = useCallback(() => {
    installPovBarriers({ resetPov: true })
  }, [installPovBarriers])

  // После смены размера canvas контролы могут сброситься — снова вешаем барьеры (центр кадра не трогаем).
  useEffect(() => {
    if (!webglOk || !povBarriersArmedRef.current) return
    const id = requestAnimationFrame(() => {
      const g = globeRef.current
      if (!g) return
      const c = typeof g.controls === 'function' ? g.controls() : null
      if (c) installPovBarriers({ resetPov: false })
    })
    return () => cancelAnimationFrame(id)
  }, [size.width, size.height, webglOk, installPovBarriers])

  useEffect(() => () => {
    controlsCleanupRef.current?.()
    controlsCleanupRef.current = null
  }, [])

  const handlePointClick = useCallback((p) => {
    const next = selectedAssetId === p.id ? null : p.id
    setSelectedAssetId(next)
    onAssetSelect?.(next)

    // Auto-recenter so southern assets remain clickable when zoomed (tilt is forbidden for user).
    const globe = globeRef.current
    if (!globe || !p) return

    // Move focus a bit north so the clicked point is not at the very bottom edge.
    const desiredLat = clamp((p.lat ?? DEFAULT_POV.lat) + 2.2, POV_BOUNDS.latMin, POV_BOUNDS.latMax)
    latFixedRef.current = desiredLat

    let cur = null
    try { cur = globe.pointOfView() } catch (_) { /* ignore */ }
    const curAlt = Number.isFinite(cur?.altitude) ? cur.altitude : DEFAULT_POV.altitude
    const curLng = Number.isFinite(cur?.lng) ? normalizeLngDeg(cur.lng) : DEFAULT_POV.lng

    const targetLng = clamp(normalizeLngDeg(p.lon ?? curLng), POV_BOUNDS.lngMin, POV_BOUNDS.lngMax)
    const targetAlt = clamp(curAlt, POV_BOUNDS.altMin, POV_BOUNDS.altMax)

    try {
      globe.pointOfView({ lat: desiredLat, lng: targetLng, altitude: targetAlt }, 350)
    } catch (_) { /* ignore */ }
  }, [onAssetSelect, selectedAssetId])

  const arcsData = useMemo(() => {
    const byId = new Map(mapPointsData.map((p) => [p.id, p]))
    return CF_ARROWS.map((a) => {
      const from = byId.get(a.from)
      const to = byId.get(a.to)
      if (!from || !to) return null
      return {
        startLat: from.lat,
        startLng: from.lon,
        endLat: to.lat,
        endLng: to.lon,
        cf: a.cf,
        label: `${from.name} → ${to.name}`,
      }
    }).filter(Boolean)
  }, [mapPointsData, CF_ARROWS])

  // Arrowheads for CF arcs (3D cones placed at arc end).
  const arrowHeadsData = useMemo(() => {
    return arcsData.map((a, idx) => ({
      id: `cf-arrow-${idx}`,
      startLat: a.startLat,
      startLng: a.startLng,
      endLat: a.endLat,
      endLng: a.endLng,
      altitude: 0,
      hovered: idx === hoveredArcIndex,
    }))
  }, [arcsData, hoveredArcIndex])

  const getArrowThreeObject = useCallback((d) => {
    if (!arrowGeomRef.current) arrowGeomRef.current = new THREE.ConeGeometry(0.55, 1.6, 10, 1)
    if (!arrowMatRef.current) arrowMatRef.current = new THREE.MeshBasicMaterial({ color: '#22d3ee' })
    const mesh = new THREE.Mesh(arrowGeomRef.current, arrowMatRef.current)
    mesh.userData.__isArrow = true
    return mesh
  }, [])

  const updateArrowThreeObject = useCallback((obj, d) => {
    const globe = globeRef.current
    if (!globe?.getCoords) return obj
    const alt = d.altitude ?? 0
    const s = globe.getCoords(d.startLat, d.startLng, alt)
    const e = globe.getCoords(d.endLat, d.endLng, alt)
    if (!s || !e) return obj

    const end = new THREE.Vector3(e.x, e.y, e.z)
    const start = new THREE.Vector3(s.x, s.y, s.z)
    const dir = end.clone().sub(start).normalize()

    obj.position.copy(end)
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    obj.material.color.set(d.hovered ? '#f97316' : '#22d3ee')
    return obj
  }, [])

  const budgetZoneFeatures = useMemo(
    () => buildAssetVoronoiFeatures(mapPointsData, ASSET_VORONOI_BBOX, getBudgetForAssetId),
    [mapPointsData, getBudgetForAssetId],
  )

  const polygonCapColor = useCallback((feat) => {
    if (!showBudgetFill) return 'rgba(0,0,0,0)'
    const v = feat?.properties?.__budget
    if (v == null || !Number.isFinite(v)) return 'rgba(34,211,238,0.12)'
    const t = Math.max(-1, Math.min(1, v))
    const s = (t + 1) / 2
    const from = { r: 25, g: 118, b: 210 }
    const to = { r: 56, g: 142, b: 60 }
    const r = Math.round(from.r + (to.r - from.r) * s)
    const g = Math.round(from.g + (to.g - from.g) * s)
    const b = Math.round(from.b + (to.b - from.b) * s)
    return `rgba(${r},${g},${b},0.38)`
  }, [showBudgetFill])

  const pointsMerge = false

  const ringsData = useMemo(() => {
    const base = mapPointsData || []
    // 2 rings per point (lighter on GPU).
    return base.flatMap((p) => [
      { ...p, __ringIdx: 0 },
      { ...p, __ringIdx: 1 },
    ])
  }, [mapPointsData])

  const polygonLabel = useCallback((feat) => {
    const name = feat?.properties?.name ?? 'Актив'
    const v = feat?.properties?.__budget
    if (!showBudgetFill || v == null || !Number.isFinite(v)) {
      return `<div style="font-weight:700">${name}</div>`
    }
    const pct = Math.round(((v + 1) / 2) * 100)
    const sign = v > 0 ? '+' : ''
    return `<div style="font-weight:700">${name}</div><div style="opacity:.85">Бюджет: ${sign}${v.toFixed(2)} (${pct}%)</div>`
  }, [showBudgetFill])

  const pointLabel = useCallback((p) => {
    if (!p) return ''
    const isSelected = selectedAssetId === p.id
    return `<div style="font-weight:700">${p.name}</div>${isSelected ? '<div style="opacity:.85">Выбрано</div>' : ''}`
  }, [selectedAssetId])

  const allPathsData = useMemo(() => [...(coastlinePaths || [])], [coastlinePaths])

  useEffect(() => {
    if (!import.meta?.env?.DEV) return
    const zoneCount = Array.isArray(budgetZoneFeatures) ? budgetZoneFeatures.length : 0
    const coastSegCount = Array.isArray(coastlinePaths) ? coastlinePaths.length : 0
    console.log('[RussiaGlobe] counts', { zoneCount, coastSegCount, showBudgetFill })
  }, [budgetZoneFeatures, coastlinePaths, showBudgetFill])

  const chain = selectedAssetId ? chainsData[selectedAssetId] : null
  function getCdPageUrl(nodeName) {
    if (typeof window === 'undefined') return '#'
    const base = window.location.origin + (window.location.pathname || '/')
    const sep = base.includes('?') ? '&' : '?'
    return `${base}${sep}cd=${encodeURIComponent(nodeName)}`
  }

  return (
    <div className={styles.container}>
      <div className={styles.controlsRow}>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={showBudgetFill}
            onChange={(e) => setShowBudgetFill(e.target.checked)}
          />
          <span>Бюджет по активам (недостаток / избыток)</span>
        </label>
        <button
          type="button"
          className={`${styles.cfBtn} ${showCFArrows ? styles.cfBtnActive : ''}`}
          onClick={() => setShowCFArrows((v) => !v)}
        >
          Перераспределение CF (млн руб) ДО → активы
        </button>
      </div>

      {showBudgetFill && (
        <div className={styles.budgetLegend}>
          <span className={styles.legendLabel}>Недостаток бюджета</span>
          <div className={`${styles.legendGradient} ${styles.legendGradientPopulation}`} />
          <span className={styles.legendLabel}>Избыток бюджета</span>
        </div>
      )}

      <div className={styles.layout}>
        <div className={`${styles.wrapper} ${styles.wrapperPerf}`} ref={containerRef}>
        {!webglOk ? (
          <div className={styles.error}>
            WebGL недоступен (или заблокирован) — 3D-глобус не может быть показан на этом устройстве/в этом браузере.
          </div>
        ) : (
          <div className={styles.viewportClip} aria-hidden="false" style={{ height: size.height }}>
            <div style={{ height: TOP_SPACE_PX }} aria-hidden="true" />
            <Globe
              ref={globeRef}
              width={size.width}
              height={Math.max(240, size.height - TOP_SPACE_PX)}
              backgroundColor="#020617"
              backgroundImageUrl={STARFIELD_URL}
              globeImageUrl={null}
              bumpImageUrl={null}
              globeMaterial={globeMaterial}
              showAtmosphere={false}
              showGraticules={false}
              onGlobeReady={handleGlobeReady}
              waitForGlobeReady
              lineHoverPrecision={0.35}
              enablePointerInteraction
              rendererConfig={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
              // Береговая линия материков; заливка — зоны ближайшего актива (Voronoi).
              pathsData={allPathsData}
              pathPoints={(d) => d.points}
              pathPointLat={(p) => p.lat}
              pathPointLng={(p) => p.lng}
              pathPointAlt={(p) => p.alt}
              pathColor={() => 'rgba(0,220,255,0.78)'}
              pathStroke={() => 1.05}
              pathResolution={1}
              pathsTransitionDuration={0}

              polygonsData={budgetZoneFeatures}
              polygonsTransitionDuration={0}
              polygonCapColor={polygonCapColor}
              polygonCapCurvatureResolution={10}
              // Subtle side fill to make strokes visible on WebGL.
              polygonSideColor={(d) => {
                if (!showBudgetFill) return 'rgba(0,0,0,0)'
                const v = d?.properties?.__budget
                if (v == null || !Number.isFinite(v)) return 'rgba(34,211,238,0.08)'
                const t = Math.max(-1, Math.min(1, v))
                const s = (t + 1) / 2
                const from = { r: 25, g: 118, b: 210 }
                const to = { r: 56, g: 142, b: 60 }
                const r = Math.round(from.r + (to.r - from.r) * s)
                const g = Math.round(from.g + (to.g - from.g) * s)
                const b = Math.round(from.b + (to.b - from.b) * s)
                return `rgba(${r},${g},${b},0.22)`
              }}
              polygonStrokeColor={() => null}
              polygonAltitude={() => (showBudgetFill ? 0.012 : 0.01)}
              polygonLabel={polygonLabel}
              pointsData={mapPointsData}
              pointLat={(d) => d.lat}
              pointLng={(d) => d.lon}
              pointResolution={8}
              pointsMerge={pointsMerge}
              pointColor={(d) => (selectedAssetId === d.id
                ? '#22d3ee'
                : hoveredAssetId === d.id
                  ? '#38bdf8'
                  : keyAssetIds.has(d.id)
                    ? '#ef4444'
                    : '#0ea5e9')}
              // Flat clickable points (no “columns”).
              pointAltitude={() => 0}
              pointRadius={(d) => (selectedAssetId === d.id ? 0.32 : hoveredAssetId === d.id ? 0.29 : 0.22)}
              pointLabel={pointLabel}
              onPointHover={(p) => setHoveredAssetId(p?.id || null)}
              onPointClick={(p) => handlePointClick(p)}

              ringsData={ringsData}
              ringLat={(d) => d.lat}
              ringLng={(d) => d.lon}
              ringColor={(d) => (keyAssetIds.has(d.id)
                ? ['rgba(239,68,68,0.65)', 'rgba(239,68,68,0)']
                : ['rgba(34,211,238,0.55)', 'rgba(34,211,238,0)'])}
              ringMaxRadius={(d) => (d.__ringIdx === 0 ? 1.25 : 1.95)}
              ringPropagationSpeed={(d) => (d.__ringIdx === 0 ? 1.2 : 1.0)}
              ringRepeatPeriod={(d) => (d.__ringIdx === 0 ? 1100 : 1400)}
              arcsData={showCFArrows ? arcsData : []}
              arcsTransitionDuration={0}
              arcLabel={(a) => `<div style="font-weight:700">${a.label}</div><div style="opacity:.85">CF: ${a.cf} млн</div>`}
              arcColor={(a, idx) => (idx === hoveredArcIndex ? '#f97316' : '#22d3ee')}
              arcStroke={null}
              arcCurveResolution={20}
              arcAltitude={0}
              arcDashLength={1}
              arcDashGap={0}
              arcDashAnimateTime={0}
              onArcHover={(a) => {
                if (!a) { setHoveredArcIndex(null); return }
                const idx = arcsData.indexOf(a)
                setHoveredArcIndex(idx >= 0 ? idx : null)
              }}
              objectsData={showCFArrows ? arrowHeadsData : []}
              objectLat={(d) => d.endLat}
              objectLng={(d) => d.endLng}
              objectAltitude={(d) => d.altitude}
              objectThreeObject={getArrowThreeObject}
              objectThreeObjectUpdate={updateArrowThreeObject}
            />
          </div>
        )}
        </div>
        {selectedAssetId && chain && (
          <div className={styles.chainPanel}>
            <div className={styles.chainTitle}>Цифровые двойники</div>
            <ul className={styles.chainList}>
              {chain.nodes.map((name, i) => (
                <li key={i} className={styles.chainItem}>
                  <span className={styles.chainNum}>{i + 1}</span>
                  <a
                    href={getCdPageUrl(name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.chainLink}
                    onClick={(e) => {
                      e.preventDefault()
                      window.open(getCdPageUrl(name), '_blank', 'noopener,noreferrer')
                    }}
                  >
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

