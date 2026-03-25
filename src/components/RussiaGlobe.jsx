import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import * as THREE from 'three'
import mapPointsData from '../data/mapPoints.json'
import { CF_ARROWS } from '../data/cfArrows'
import { BUDGET_BY_ASSET, getAssetRegionKey } from '../data/mapBudgetData'
import chainsData from '../data/chains.json'
import './RussiaGlobe.css'
import { simplifyFeatures } from '../lib/simplifyGeoJsonRing'
import { geojsonFeaturesToPaths } from '../lib/geojsonToPaths'

/** Макс. вершин на кольце полигона — меньше = быстрее отрисовка */
const POLYGON_RING_MAX = 56
/** Макс. размер canvas (пиксели) — снижает нагрузку на GPU */
const MAX_GLOBE_W = 1200
const MAX_GLOBE_H = 760

const russiaRegionsUrl = 'https://raw.githubusercontent.com/Hubbitus/RussiaRegions.geojson/master/RussiaRegions.geojson'
const worldCountriesUrl50m = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'
const worldCountriesUrl110m = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'

const DEFAULT_POV = { lat: 62, lng: 100, altitude: 1.4 }
const STARFIELD_URL = 'https://unpkg.com/three-globe@2.45.1/example/img/night-sky.png'
// (texture-only) EARTH_DAY intentionally not used for monochrome rendering
// const EARTH_DAY = 'https://unpkg.com/three-globe@2.45.1/example/img/earth-day.jpg'

// Hard bounds for camera point-of-view focused around Russia.
// Для UX: видим только РФ, без возможности «докрутить» до других материков.
const POV_BOUNDS = {
  // Разрешаем наклон по Y (север/юг) в пределах РФ.
  latMin: 42,
  latMax: 82,
  // Окно по долготе: только сектор РФ и ближайшие моря,
  // без захода на Америку/Океанию.
  lngMinA: 45,
  lngMaxA: 135,
  altMin: 0.55,
  altMax: 1.65,
}

function pointInRing([x, y], ring) {
  // Ray casting, ring: [lng,lat][]
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

function pointInGeometry(point, geometry) {
  if (!geometry) return false
  const { type, coordinates } = geometry
  if (!type || !coordinates) return false
  if (type === 'Polygon') {
    const [outer, ...holes] = coordinates
    if (!outer || !pointInRing(point, outer)) return false
    return !holes.some((h) => h && pointInRing(point, h))
  }
  if (type === 'MultiPolygon') {
    return coordinates.some((poly) => pointInGeometry(point, { type: 'Polygon', coordinates: poly }))
  }
  return false
}

function clamp01(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function isLngAllowed(lng) {
  return (lng >= POV_BOUNDS.lngMinA && lng <= POV_BOUNDS.lngMaxA)
}

function clampLngToAllowed(lng, fallbackLng) {
  if (isLngAllowed(lng)) return lng
  // Snap to closest edge within allowed window.
  const candidates = [POV_BOUNDS.lngMinA, POV_BOUNDS.lngMaxA]
  let best = candidates[0]
  let bestDist = Infinity
  for (const c of candidates) {
    const d = Math.abs(lng - c)
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }
  // If for some reason we get NaN (bad input), use fallback.
  return Number.isFinite(best) ? best : fallbackLng
}

function samePov(a, b) {
  if (!a || !b) return false
  const eps = 1e-4
  return Math.abs(a.lat - b.lat) < eps && Math.abs(a.lng - b.lng) < eps && Math.abs(a.altitude - b.altitude) < eps
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
  const [regions, setRegions] = useState(null)
  const [countryPaths, setCountryPaths] = useState([])
  const [regionPaths, setRegionPaths] = useState([])
  const [regionsError, setRegionsError] = useState(null)
  const [webglOk, setWebglOk] = useState(true)

  const [showBudgetFill, setShowBudgetFill] = useState(true)
  const [showCFArrows, setShowCFArrows] = useState(true)

  const [selectedAssetId, setSelectedAssetId] = useState(null)
  const [hoveredAssetId, setHoveredAssetId] = useState(null)
  const [hoveredRegion, setHoveredRegion] = useState(null)
  const [hoveredArcIndex, setHoveredArcIndex] = useState(null)

  const keyAssetIds = useMemo(() => new Set(['do-yamal', 'do-noyabrsk', 'do-megion']), [])

  const lastAppliedPovRef = useRef(DEFAULT_POV)
  const clampInProgressRef = useRef(false)

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
        const h = Math.min(MAX_GLOBE_H, Math.max(380, Math.floor((height || 480) * 0.88)))
        setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }))
      })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    setRegionsError(null)
    fetch(russiaRegionsUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((json) => {
        if (cancelled) return
        const feats = Array.isArray(json?.features) ? json.features : []
        const simplified = simplifyFeatures(feats, POLYGON_RING_MAX)
        // Diagnose: check hasAsset count on original geometry vs simplified geometry.
        const hasAssetCountOriginal = feats.filter((f) => {
          const geom = f?.geometry
          if (!geom) return false
          return mapPointsData.some((p) => pointInGeometry([p.lon, p.lat], geom))
        }).length
        // Подсвечиваем только те регионы, где есть активы.
        const withAssets = simplified.map((f) => {
          const geom = f?.geometry
          const hasAsset = mapPointsData.some((p) => pointInGeometry([p.lon, p.lat], geom))
          return { ...f, __hasAsset: hasAsset }
        })
        setRegions(withAssets)
        // Render region contours as “conditional/approximate” outlines:
        // aggressively simplify ONLY the paths layer (polygons remain for interactivity + budget fill).
        // NOTE: too-aggressive simplification can drop rings/segments -> “missing regions” effect.
        const regionPathFeatures = simplifyFeatures(withAssets, 32)
        setRegionPaths(
          geojsonFeaturesToPaths(regionPathFeatures, { alt: 0.0032, maxPointsPerRing: 100, datelineJumpDeg: 180 }, 'region')
        )
      })
      .catch((err) => {
        if (cancelled) return
        setRegions(null)
        setRegionsError(err?.message || 'Не удалось загрузить геоданные РФ')
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadCountries() {
      // Prefer lighter world borders; RF regions are the priority.
      // Try 110m first, then optionally 50m.
      const tryUrls = [worldCountriesUrl110m, worldCountriesUrl50m]
      for (const url of tryUrls) {
        try {
          const r = await fetch(url)
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          const json = await r.json()
          if (cancelled) return
          const feats = Array.isArray(json?.features) ? json.features : []
          // User wants all world country borders (digital outlines).
          // Keep it reasonably light; our geojson->paths does extra downsample too.
          const simplified = simplifyFeatures(feats, 32)
          setCountryPaths(
            geojsonFeaturesToPaths(simplified, { alt: 0.0026, maxPointsPerRing: 110, datelineJumpDeg: 180 }, 'country')
          )
          return
        } catch (_) {
          // try next url
        }
      }
      if (!cancelled) setCountryPaths([])
    }
    // Defer world borders a bit to avoid blocking initial render.
    const t = window.setTimeout(() => { loadCountries() }, 600)
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return

    // Initial point-of-view.
    globe.pointOfView(DEFAULT_POV, 0)
    lastAppliedPovRef.current = DEFAULT_POV

    const controls = globe.controls?.()
    if (controls) {
      controls.enablePan = false
      controls.enableDamping = true
      controls.dampingFactor = 0.085
      controls.rotateSpeed = 0.55
      controls.zoomSpeed = 0.75
      // Наклон по Y ограничиваем небольшой дугой (только в пределах РФ).
      const basePolar = ((90 - DEFAULT_POV.lat) * Math.PI) / 180
      const polarWindow = Math.PI * 0.14 // ~25°
      controls.minPolarAngle = Math.max(0.01, basePolar - polarWindow)
      controls.maxPolarAngle = Math.min(Math.PI - 0.01, basePolar + polarWindow)
      // Только Россия: симметричное окно по азимуту (без Европы и лишнего востока).
      controls.minAzimuthAngle = -Math.PI * 0.32
      controls.maxAzimuthAngle = Math.PI * 0.32

      // Zoom limits (avoid bounce by constraining controls instead of forcing POV).
      try {
        const cam = globe.camera?.()
        if (cam?.position) {
          const dist = cam.position.length()
          if (Number.isFinite(dist) && dist > 0) {
            controls.minDistance = dist * 0.55
            controls.maxDistance = dist * 1.05
          }
        }
      } catch (_) { /* ignore */ }
    }
  }, [])

  const handlePointClick = useCallback((p) => {
    const next = selectedAssetId === p.id ? null : p.id
    setSelectedAssetId(next)
    onAssetSelect?.(next)
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
  }, [])

  // NOTE: we avoid forcing pointOfView on every zoom/change (it causes jerks).
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

  const polygonCapColor = useCallback((feat) => {
    // Polygon fills only (contours are rendered via paths).
    if (!showBudgetFill) return 'rgba(0,0,0,0)'
    // Neutral subtle fill for non-asset regions (keeps map readable without noise).
    if (!feat?.__hasAsset) return 'rgba(0,220,255,0.14)'
    const name = feat?.properties?.name ?? feat?.properties?.NAME ?? feat?.properties?.region
    const key = getAssetRegionKey(name)
    const v = key ? BUDGET_BY_ASSET[key] : null
    if (v == null) return 'rgba(34,211,238,0.22)'
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
  }, [])

  const polygonLabel = useCallback((feat) => {
    const name = feat?.properties?.name ?? feat?.properties?.NAME ?? feat?.properties?.region ?? 'Регион'
    const key = getAssetRegionKey(name)
    const v = key ? BUDGET_BY_ASSET[key] : null
    if (!showBudgetFill || v == null) {
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

  const visibleRegions = useMemo(() => {
    // User wants all RF region contours (not only asset regions).
    return regions || []
  }, [regions])

  const allPathsData = useMemo(() => {
    return [...(countryPaths || []), ...(regionPaths || [])]
  }, [countryPaths, regionPaths])

  useEffect(() => {
    if (!import.meta?.env?.DEV) return
    const regionCount = Array.isArray(regions) ? regions.length : 0
    const regionPathCount = Array.isArray(regionPaths) ? regionPaths.length : 0
    const countryPathCount = Array.isArray(countryPaths) ? countryPaths.length : 0
    // eslint-disable-next-line no-console
    console.log('[RussiaGlobe] counts', { regionCount, regionPathCount, countryPathCount, showBudgetFill })
  }, [regions, regionPaths, countryPaths, showBudgetFill])

  const chain = selectedAssetId ? chainsData[selectedAssetId] : null
  function getCdPageUrl(nodeName) {
    if (typeof window === 'undefined') return '#'
    const base = window.location.origin + (window.location.pathname || '/')
    const sep = base.includes('?') ? '&' : '?'
    return `${base}${sep}cd=${encodeURIComponent(nodeName)}`
  }

  return (
    <div className="russia-globe-container">
      <div className="globe-controls-row">
        <label className="globe-toggle">
          <input
            type="checkbox"
            checked={showBudgetFill}
            onChange={(e) => setShowBudgetFill(e.target.checked)}
          />
          <span>Бюджет по активам (недостаток / избыток)</span>
        </label>
        <button
          type="button"
          className={`globe-cf-btn ${showCFArrows ? 'globe-cf-btn-active' : ''}`}
          onClick={() => setShowCFArrows((v) => !v)}
        >
          Перераспределение CF (млн руб) ДО → активы
        </button>
      </div>

      {showBudgetFill && (
        <div className="globe-budget-legend">
          <span className="globe-legend-label">Недостаток бюджета</span>
          <div className="globe-legend-gradient globe-legend-gradient--population" />
          <span className="globe-legend-label">Избыток бюджета</span>
        </div>
      )}

      <div className="globe-layout">
        <div className="globe-wrapper globe-wrapper--perf" ref={containerRef}>
        {regionsError && (
          <div className="globe-error">
            {regionsError}
          </div>
        )}
        {!webglOk ? (
          <div className="globe-error">
            WebGL недоступен (или заблокирован) — 3D-глобус не может быть показан на этом устройстве/в этом браузере.
          </div>
        ) : (
          <div className="globe-viewport-clip" aria-hidden="false">
            <Globe
              ref={globeRef}
              width={size.width}
              height={size.height}
              backgroundColor="#020617"
              backgroundImageUrl={STARFIELD_URL}
              globeImageUrl={null}
              bumpImageUrl={null}
              globeMaterial={globeMaterial}
              showAtmosphere={false}
              showGraticules={false}
              onGlobeReady={applyLowPixelRatio}
              waitForGlobeReady
              lineHoverPrecision={0.35}
              enablePointerInteraction
              rendererConfig={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
              // Contours are rendered via pathsData; polygons remain for fill + hover label.
              pathsData={allPathsData}
              pathPoints={(d) => d.points}
              pathPointLat={(p) => p.lat}
              pathPointLng={(p) => p.lng}
              pathPointAlt={(p) => p.alt}
              pathColor={(d) => (d?.kind === 'region' ? 'rgba(0,220,255,0.85)' : 'rgba(0,220,255,0.32)')}
              pathStroke={(d) => (d?.kind === 'region' ? 0.95 : 0.55)}
              pathResolution={1}
              pathsTransitionDuration={0}

              polygonsData={visibleRegions}
              polygonsTransitionDuration={0}
              polygonCapColor={polygonCapColor}
              polygonCapCurvatureResolution={10}
              // Subtle side fill to make strokes visible on WebGL.
              polygonSideColor={(d) => {
                if (!showBudgetFill) return 'rgba(0,0,0,0)'
                if (!d?.__hasAsset) return 'rgba(0,220,255,0.08)'
                const name = d?.properties?.name ?? d?.properties?.NAME ?? d?.properties?.region
                const key = getAssetRegionKey(name)
                const v = key ? BUDGET_BY_ASSET[key] : null
                if (v == null) return 'rgba(34,211,238,0.16)'
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
              onPolygonHover={(feat) => setHoveredRegion(feat || null)}
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
          <div className="globe-chain-panel">
            <div className="globe-chain-title">Цифровые двойники</div>
            <ul className="globe-chain-list">
              {chain.nodes.map((name, i) => (
                <li key={i} className="globe-chain-item">
                  <span className="globe-chain-num">{i + 1}</span>
                  <a
                    href={getCdPageUrl(name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="globe-chain-link"
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

