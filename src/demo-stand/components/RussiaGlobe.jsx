import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import mapPointsData from '../data/mapPoints.json'
import { CF_ARROWS } from '../data/cfArrows'
import { getBudgetForAssetId } from '../data/mapBudgetData'
import chainsData from '../data/chains.json'
import './RussiaGlobe.css'
import { buildAssetVoronoiFeatures } from '../lib/assetVoronoiZones'
import EarthJsonGlobeCanvas from './EarthJsonGlobeCanvas.jsx'
import { STAND_4K_HEIGHT, STAND_4K_WIDTH } from '../lib/standDisplay.js'

/** Макс. высота canvas по умолчанию (пиксели) — снижает нагрузку на GPU; ширина = ширина контейнера (см. MAX_CANVAS_W) */
const DEFAULT_MAX_GLOBE_H = 860
/** Верхняя граница ширины canvas (не-demoLarge), чтобы не раздувать буферы на экстремальных разрешениях */
const MAX_CANVAS_W = 8192
const DEMO_MAX_GLOBE_W = 1680
const DEMO_MAX_GLOBE_H = 1500
/** Демо-стенд ?demo=stand — строго под 4K UHD 16:9 (55" и т.п.) */
const STAND_MAX_GLOBE_W = STAND_4K_WIDTH
const STAND_MAX_GLOBE_H = STAND_4K_HEIGHT

/** Прямоугольник для Voronoi зон вокруг активов (РФ + запас по краям). */
const ASSET_VORONOI_BBOX = { lngMin: 18, lngMax: 138, latMin: 39, latMax: 76 }

/** Только физические пределы глобуса (без «коридора» по РФ). */
const POV_ALT_MIN = 0.04
/** Иммерсив + стенд: чуть ближе к шару, чем глобальный минимум (клики по активам не откатывают к 0.04). */
/** Клики по активам; на стенде зум в основном через altitude в IMMERSIVE_STAND_POV и FOV купола */
const POV_ALT_MIN_STAND = 0.04
const POV_ALT_MAX = 4

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

/**
 * Расстояние камеры от центра шара — R·(1+alt) (см. polarToCameraPosition).
 * Вдвое ближе к сцене: (1+alt_new) = 0.5·(1+alt_old) → alt_new = 0.5·(1+alt_old) − 1.
 * При старых alt≈0.8–1 даёт отрицательный alt — ограничиваем POV_ALT_MIN (ближе без клипа нельзя).
 */
function povAltitudeTwiceCloser(altOld) {
  return clamp(0.5 * (1 + altOld) - 1, POV_ALT_MIN, POV_ALT_MAX)
}

/** Стартовая широта центра кадра (севернее — больше Арктики и «макушки» в кадре). */
const POV_LAT_DEFAULT = 64
/** Стартовый зум: вся Россия в поле зрения + северная кривизна / полюс; только приближение. */
const DEFAULT_POV = { lat: POV_LAT_DEFAULT, lng: 90, altitude: povAltitudeTwiceCloser(0.84) }
/** Демо-стенд: ещё дальше — макушка сферы и края РФ по широте/долготе */
const DEMO_STAND_POV = { lat: 62, lng: 90, altitude: povAltitudeTwiceCloser(1.02) }
/** Иммерсив: компромисс между «ДВ вправо» и исходным центром (Европа снова в кадре) */
const IMMERSIVE_POV = { lat: 50, lng: 76, altitude: povAltitudeTwiceCloser(0.88) }
/**
 * ?demo=stand#face: камера с юга, север вверх. Без povAltitudeTwiceCloser — иначе clamp к POV_ALT_MIN
 * и камера у поверхности шара (гигантский зум на океан).
 */
/** Референс: камера южнее и чуть дальше — меньше южного полушария в кадре, купол как на целевом скрине. */
const IMMERSIVE_STAND_POV = { lat: 40, lng: 170, altitude: 1.8 }
/**
 * Наклон корня шара вокруг X (°). «−22×15 = −330» по математике ≡ +30° (лишний полный оборот), визуально почти как раньше.
 * Здесь ~−22 − 14×15° ≈ −232° — заметный сдвиг без лишней эквивалентности по mod 360.
 */
const IMMERSIVE_EARTH_PITCH_X_DEG = -232
/** Поворот корня вокруг Z (°): умеренный сдвиг ДВ вправо (~половина от пика 34°) */
const IMMERSIVE_EARTH_YAW_Z_DEG = 17
/** ?demo=stand#face: без наклона — север по Y сцены вверх, Россия читаема на куполе. */
const IMMERSIVE_STAND_FACE_PITCH_X_DEG = 0
const IMMERSIVE_STAND_FACE_YAW_Z_DEG = 0
/** Доп. наклон polar (°); 0 = Россия «в лоб» как до эксперимента с сильным наклоном */
const IMMERSIVE_POLAR_TILT_EXTRA_DEG = 0

const TOP_SPACE_PX = 18

/** Доля высоты viewport под полосу купола — синхронно с `.app--demo-stand-face .app-demo-globe-fixed` в App.css */
const STAND_FACE_DOME_BAND_VH = 0.7

/** Высота canvas = доля vh; не смешивать с min 520 — иначе полоса короче canvas и overflow:hidden срезает кадр («уехал вниз»). */
function standFaceImmersiveCanvasHeightPx(vhPx) {
  return Math.max(160, Math.floor(vhPx * STAND_FACE_DOME_BAND_VH))
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

export default function RussiaGlobe({
  onAssetSelect,
  demoLarge = false,
  standLayout = false,
  immersiveBackground = false,
}) {
  const maxGlobeW = demoLarge ? (standLayout ? STAND_MAX_GLOBE_W : DEMO_MAX_GLOBE_W) : MAX_CANVAS_W
  const maxGlobeH = demoLarge ? (standLayout ? STAND_MAX_GLOBE_H : DEMO_MAX_GLOBE_H) : DEFAULT_MAX_GLOBE_H
  /* Копии + lat/lng/alt в deps: иначе при HMR useMemo оставляет старый объект IMMERSIVE_* и pointOfView не подхватывает новый altitude. */
  const effectiveDefaultPov = useMemo(() => {
    if (immersiveBackground && standLayout) return { ...IMMERSIVE_STAND_POV }
    if (immersiveBackground) return { ...IMMERSIVE_POV }
    if (standLayout) return { ...DEMO_STAND_POV }
    return { ...DEFAULT_POV }
  }, [
    standLayout,
    immersiveBackground,
    IMMERSIVE_STAND_POV.lat,
    IMMERSIVE_STAND_POV.lng,
    IMMERSIVE_STAND_POV.altitude,
    IMMERSIVE_POV.lat,
    IMMERSIVE_POV.lng,
    IMMERSIVE_POV.altitude,
    DEMO_STAND_POV.lat,
    DEMO_STAND_POV.lng,
    DEMO_STAND_POV.altitude,
    DEFAULT_POV.lat,
    DEFAULT_POV.lng,
    DEFAULT_POV.altitude,
  ])
  const topSpacePx = immersiveBackground ? 0 : (standLayout ? 2 : TOP_SPACE_PX)

  const globeRef = useRef(null)
  const containerRef = useRef(null)

  const [size, setSize] = useState({ width: 800, height: 620 })

  /* Иммерсив: сдвиг вниз через CSS; стенд — только Three.js offset (CSS translate давал синюю полосу body сверху) */
  const immersiveGlobeOffset = useMemo(() => {
    if (!immersiveBackground) return [0, 0]
    if (standLayout) return [0, 0]
    return [0, Math.round(size.height * 0.36 + 64)]
  }, [immersiveBackground, standLayout, size.height])

  const [webglOk, setWebglOk] = useState(true)

  const [showBudgetFill, setShowBudgetFill] = useState(false)
  const [showCFArrows, setShowCFArrows] = useState(false)

  const [selectedAssetId, setSelectedAssetId] = useState(null)
  const [hoveredAssetId, setHoveredAssetId] = useState(null)
  const [hoveredArcIndex, setHoveredArcIndex] = useState(null)

  const keyAssetIds = useMemo(() => new Set(['do-yamal', 'do-noyabrsk', 'do-megion']), [])
  const controlsCleanupRef = useRef(null)
  /** Чтобы не вызывать install до первого onGlobeReady и не сбивать POV. */
  const povBarriersArmedRef = useRef(false)

  const applyRendererPixelRatio = useCallback(() => {
    try {
      const g = globeRef.current
      const r = g?.renderer?.()
      if (r?.setPixelRatio) {
        const dpr = window.devicePixelRatio || 1
        const cap = immersiveBackground ? 2 : 1.25
        r.setPixelRatio(Math.min(cap, dpr))
      }
    } catch (_) { /* ignore */ }
  }, [immersiveBackground])

  useEffect(() => {
    if (!webglOk) return
    const id = requestAnimationFrame(applyRendererPixelRatio)
    return () => cancelAnimationFrame(id)
  }, [size.width, size.height, webglOk, applyRendererPixelRatio])

  useEffect(() => {
    const webgl = canCreateWebGLContext()
    setWebglOk(!!webgl.ok)

    if (immersiveBackground) {
      const measure = () => {
        const vw = typeof window !== 'undefined' ? window.innerWidth : 800
        const vh = typeof window !== 'undefined' ? window.innerHeight : 600
        /* Иммерсив (?demo + face): canvas на всю ширину окна; высота — полная на стенде, иначе с лимитом по maxGlobeH */
        const w = Math.max(320, Math.floor(vw))
        const h = standLayout
          ? standFaceImmersiveCanvasHeightPx(vh)
          : Math.min(maxGlobeH, Math.max(520, Math.floor(vh)))
        setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }))
      }
      measure()
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

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
        const w = Math.min(maxGlobeW, Math.max(320, Math.floor(width)))
        const minH = standLayout ? 520 : 380
        const frac = standLayout ? 0.995 : 0.98
        const h = Math.min(maxGlobeH, Math.max(minH, Math.floor((height || 480) * frac)))
        setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }))
      })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxGlobeW, maxGlobeH, standLayout, immersiveBackground])

  const installPovBarriers = useCallback((options = { resetPov: true }) => {
    applyRendererPixelRatio()
    const globe = globeRef.current
    if (!globe) return

    /* POV не должен зависеть от OrbitControls: ref контролов иногда ещё null в том же кадре, что onReady — иначе камера остаётся дефолтной и «зума» нет. */
    if (options.resetPov) {
      try {
        globe.pointOfView(effectiveDefaultPov, 0)
      } catch (_) { /* api ещё не готов */ }
    }

    const controls = typeof globe.controls === 'function' ? globe.controls() : null
    if (!controls) return

    controlsCleanupRef.current?.()
    controlsCleanupRef.current = null

    controls.enablePan = false
    controls.enableDamping = false
    controls.rotateSpeed = immersiveBackground ? 0.42 : 0.5
    controls.zoomSpeed = immersiveBackground ? 0.55 : 0.65

    /* Демо-стенд + иммерсив: OrbitControls выкл. — вращение сцены вокруг мировой OY в EarthJsonGlobeCanvas, не орбита камеры */
    if (immersiveBackground && standLayout) {
      controls.enableZoom = false
      controls.enableRotate = false
      controls.enabled = false
    } else {
      controls.enabled = true
      controls.enableZoom = true
      controls.enableRotate = true
    }

    controls.update?.()

    if (immersiveBackground && standLayout) {
      /* лимиты не нужны — controls отключены */
    } else {
      const polarLo = 0.04
      const polarHi = Math.PI - 0.04
      if (immersiveBackground) {
        const extra = THREE.MathUtils.degToRad(IMMERSIVE_POLAR_TILT_EXTRA_DEG)
        controls.minPolarAngle = polarLo + extra
        controls.maxPolarAngle = polarHi + extra
      } else {
        controls.minPolarAngle = polarLo
        controls.maxPolarAngle = polarHi
      }
      controls.minAzimuthAngle = -Infinity
      controls.maxAzimuthAngle = Infinity
    }

    controls.update?.()

    try {
      const cam = globe.camera?.()
      if (cam?.position && controls.target) {
        const dist = cam.position.distanceTo(controls.target)
        if (Number.isFinite(dist) && dist > 0) {
          controls.maxDistance = dist * 14
          controls.minDistance = dist * 0.08
        }
      }
    } catch (_) { /* ignore */ }

    controlsCleanupRef.current = () => {
      povBarriersArmedRef.current = false
    }
    povBarriersArmedRef.current = true
  }, [applyRendererPixelRatio, effectiveDefaultPov, immersiveBackground, standLayout])

  const handleEarthGlobeReady = useCallback(() => {
    installPovBarriers({ resetPov: true })
    requestAnimationFrame(() => {
      installPovBarriers({ resetPov: false })
    })
  }, [installPovBarriers])

  useEffect(() => {
    if ((!standLayout && !immersiveBackground) || !povBarriersArmedRef.current || !globeRef.current) return
    const id = requestAnimationFrame(() => {
      installPovBarriers({ resetPov: true })
    })
    return () => cancelAnimationFrame(id)
  }, [standLayout, immersiveBackground, installPovBarriers])

  // После смены размера: стенд — полный сброс POV+pitch (StandDomeCamera тоже пересчитывает кадр).
  useEffect(() => {
    if (!webglOk || !povBarriersArmedRef.current) return
    const id = requestAnimationFrame(() => {
      const g = globeRef.current
      if (!g) return
      if (immersiveBackground && standLayout) {
        installPovBarriers({ resetPov: true })
        return
      }
      const c = typeof g.controls === 'function' ? g.controls() : null
      if (c) installPovBarriers({ resetPov: false })
    })
    return () => cancelAnimationFrame(id)
  }, [size.width, size.height, webglOk, installPovBarriers, immersiveBackground, standLayout])

  useEffect(() => () => {
    controlsCleanupRef.current?.()
    controlsCleanupRef.current = null
  }, [])

  const handlePointClick = useCallback((p) => {
    const next = selectedAssetId === p.id ? null : p.id
    setSelectedAssetId(next)
    onAssetSelect?.(next)

    const globe = globeRef.current
    if (!globe || !p) return

    const desiredLat = clamp((p.lat ?? effectiveDefaultPov.lat) + 2.2, -88, 88)

    let cur = null
    try { cur = globe.pointOfView() } catch (_) { /* ignore */ }
    const curAlt = Number.isFinite(cur?.altitude) ? cur.altitude : effectiveDefaultPov.altitude
    const curLng = Number.isFinite(cur?.lng) ? normalizeLngDeg(cur.lng) : effectiveDefaultPov.lng

    const targetLng = normalizeLngDeg(p.lon ?? curLng)
    const altMin = immersiveBackground && standLayout ? POV_ALT_MIN_STAND : POV_ALT_MIN
    const targetAlt = clamp(curAlt, altMin, POV_ALT_MAX)

    try {
      globe.pointOfView({ lat: desiredLat, lng: targetLng, altitude: targetAlt }, 350)
    } catch (_) { /* ignore */ }

    if (immersiveBackground && standLayout) {
      requestAnimationFrame(() => installPovBarriers({ resetPov: false }))
    }
  }, [onAssetSelect, selectedAssetId, effectiveDefaultPov, immersiveBackground, standLayout, installPovBarriers])

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

  const handleArcHover = useCallback((a) => {
    if (!a) {
      setHoveredArcIndex(null)
      return
    }
    const idx = arcsData.indexOf(a)
    setHoveredArcIndex(idx >= 0 ? idx : null)
  }, [arcsData])

  const budgetZoneFeatures = useMemo(
    () => buildAssetVoronoiFeatures(mapPointsData, ASSET_VORONOI_BBOX, getBudgetForAssetId),
    [],
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

  const ringsData = useMemo(() => {
    const base = mapPointsData || []
    // 2 rings per point (lighter on GPU).
    return base.flatMap((p) => [
      { ...p, __ringIdx: 0 },
      { ...p, __ringIdx: 1 },
    ])
  }, [])

  const chain = selectedAssetId ? chainsData[selectedAssetId] : null
  function getCdPageUrl(nodeName) {
    if (typeof window === 'undefined') return '#'
    const base = window.location.origin + (window.location.pathname || '/')
    const sep = base.includes('?') ? '&' : '?'
    return `${base}${sep}cd=${encodeURIComponent(nodeName)}`
  }

  const chainPanelEl = selectedAssetId && chain ? (
    <div className={immersiveBackground ? 'globe-chain-panel globe-chain-panel--immersive' : 'globe-chain-panel'}>
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
  ) : null

  const globeCanvasBlock = (
    <>
      {!webglOk ? (
        <div className="globe-error">
          WebGL недоступен (или заблокирован) — 3D-глобус не может быть показан на этом устройстве/в этом браузере.
        </div>
      ) : (
        <div
          className={`globe-viewport-clip${standLayout || immersiveBackground ? ' globe-viewport-clip--stand' : ''}${immersiveBackground ? ' globe-viewport-clip--immersive' : ''}${standLayout && immersiveBackground ? ' globe-viewport-clip--stand-face' : ''}`}
          aria-hidden="false"
          style={{ height: size.height }}
        >
          {topSpacePx > 0 ? <div style={{ height: topSpacePx }} aria-hidden="true" /> : null}
          <div
            style={
              immersiveBackground
                ? { transform: `translate(${immersiveGlobeOffset[0]}px, ${immersiveGlobeOffset[1]}px)` }
                : undefined
            }
          >
            <EarthJsonGlobeCanvas
              ref={globeRef}
              width={size.width}
              height={Math.max(
                standLayout && immersiveBackground ? 160 : 240,
                size.height - topSpacePx,
              )}
              immersiveBackground={immersiveBackground}
              immersiveStandLayout={standLayout && immersiveBackground}
              immersivePitchXDeg={
                standLayout && immersiveBackground
                  ? IMMERSIVE_STAND_FACE_PITCH_X_DEG
                  : IMMERSIVE_EARTH_PITCH_X_DEG
              }
              immersiveYawZDeg={
                standLayout && immersiveBackground
                  ? IMMERSIVE_STAND_FACE_YAW_Z_DEG
                  : IMMERSIVE_EARTH_YAW_Z_DEG
              }
              immersivePolarExtraDeg={IMMERSIVE_POLAR_TILT_EXTRA_DEG}
              onReady={handleEarthGlobeReady}
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
              onPointClick={handlePointClick}
              onPointHover={(p) => setHoveredAssetId(p?.id || null)}
              onArcHover={handleArcHover}
              standCameraPov={
                standLayout && immersiveBackground ? effectiveDefaultPov : undefined
              }
            />
          </div>
        </div>
      )}
    </>
  )

  if (immersiveBackground) {
    return (
      <div
        className={`russia-globe-container russia-globe-container--immersive${standLayout ? ' russia-globe-container--stand-globe' : ''}`}
      >
        <div className="globe-wrapper globe-wrapper--perf globe-wrapper--immersive-bg" ref={containerRef}>
          {globeCanvasBlock}
          <div className="globe-immersive-hud" aria-label="Слои карты">
            <button
              type="button"
              className={`globe-hud-icon-btn${showBudgetFill ? ' globe-hud-icon-btn--active' : ''}`}
              title="Бюджет по активам (недостаток / избыток)"
              aria-pressed={showBudgetFill}
              onClick={() => setShowBudgetFill((v) => !v)}
            >
              <span className="globe-hud-icon-btn__inner" aria-hidden>
                <svg className="globe-hud-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="14" width="16" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M6 14V10h4v4M10 10V6h4v4M14 6V3h4v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="globeHudGradBudget" x1="4" y1="14" x2="20" y2="19" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#1976d2" />
                      <stop offset="1" stopColor="#388e3c" />
                    </linearGradient>
                  </defs>
                  <rect x="5" y="15" width="14" height="3" rx="0.5" fill="url(#globeHudGradBudget)" opacity="0.9" />
                </svg>
              </span>
            </button>
            <button
              type="button"
              className={`globe-hud-icon-btn${showCFArrows ? ' globe-hud-icon-btn--active' : ''}`}
              title="Перераспределение CF (млн руб) ДО → активы"
              aria-pressed={showCFArrows}
              onClick={() => setShowCFArrows((v) => !v)}
            >
              <span className="globe-hud-icon-btn__inner" aria-hidden>
                <svg className="globe-hud-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M5 8h9l-2.5-2.5M14 8l-2.5 2.5M19 16H10l2.5 2.5M10 16l2.5-2.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
          </div>
          {chainPanelEl}
        </div>
      </div>
    )
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
          {globeCanvasBlock}
        </div>
        {chainPanelEl}
      </div>
    </div>
  )
}

