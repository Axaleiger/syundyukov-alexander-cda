import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import styles from "./RussiaGlobe.module.css"
import { useRussiaGlobeMapModel, getCdPageUrl } from "../model/useRussiaGlobeMapModel"
import { RussiaGlobeGlSurface } from "./RussiaGlobeGlSurface"

/** Макс. размер canvas (пиксели) — снижает нагрузку на GPU (main /face) */
const MAX_GLOBE_W = 1200
const MAX_GLOBE_H = 860

const TOP_SPACE_PX = 18

const POV_LAT_DEFAULT = 62
const DEFAULT_POV = { lat: POV_LAT_DEFAULT, lng: 90, altitude: 0.72 }
const STARFIELD_URL = "https://unpkg.com/three-globe@2.45.1/example/img/night-sky.png"

const POV_BOUNDS = {
	latMin: 52,
	latMax: 68,
	lngMin: 60,
	lngMax: 120,
	altMin: 0.32,
	altMax: DEFAULT_POV.altitude,
}

function clamp(v, min, max) {
	return Math.max(min, Math.min(max, v))
}

function normalizeLngDeg(lng) {
	if (!Number.isFinite(lng)) return DEFAULT_POV.lng
	let x = lng
	while (x > 180) x -= 360
	while (x < -180) x += 360
	return x
}

function canCreateWebGLContext() {
	try {
		const canvas = document.createElement("canvas")
		const gl2 = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true })
		if (gl2) return { ok: true, kind: "webgl2" }
		const gl1 =
			canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }) ||
			canvas.getContext("experimental-webgl")
		if (gl1) return { ok: true, kind: "webgl1" }
		return { ok: false, kind: null }
	} catch (e) {
		return { ok: false, kind: null, error: String(e?.message || e) }
	}
}

/**
 * Глобус для основного `/face`: карточка, ResizeObserver, коридор POV, панель слоёв.
 */
export default function MainRussiaGlobe({ onAssetSelect }) {
	const globeRef = useRef(null)
	const containerRef = useRef(null)
	const model = useRussiaGlobeMapModel({ onAssetSelect, globeRef })
	const {
		webglOk,
		setWebglOk,
		chain,
		selectedAssetId,
		toggleSelectedFromPoint,
		showBudgetFill,
		setShowBudgetFill,
		showCFArrows,
		setShowCFArrows,
	} = model

	const latFixedRef = useRef(DEFAULT_POV.lat)
	const applyingPovClampRef = useRef(false)
	const controlsCleanupRef = useRef(null)
	const povBarriersArmedRef = useRef(false)

	const [size, setSize] = useState({ width: 800, height: 620 })

	const applyRendererPixelRatio = useCallback(() => {
		try {
			const g = globeRef.current
			const r = g?.renderer?.()
			if (r?.setPixelRatio) {
				const dpr = window.devicePixelRatio || 1
				const cap = 1.25
				r.setPixelRatio(Math.min(cap, dpr))
			}
		} catch (_) {
			/* ignore */
		}
	}, [])

	useEffect(() => {
		if (!webglOk) return
		const id = requestAnimationFrame(applyRendererPixelRatio)
		return () => cancelAnimationFrame(id)
	}, [size.width, size.height, webglOk, applyRendererPixelRatio])

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
				const minH = 380
				const frac = 0.98
				const h = Math.min(MAX_GLOBE_H, Math.max(minH, Math.floor((height || 480) * frac)))
				setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }))
			})
		})
		ro.observe(el)
		return () => ro.disconnect()
	}, [setWebglOk])

	const installPovBarriers = useCallback(
		(options = { resetPov: true }) => {
			applyRendererPixelRatio()
			const globe = globeRef.current
			if (!globe) return

			/* POV до проверки controls: как в demo-stand RussiaGlobe — иначе в том же кадре, что onReady, зум/угол могут не примениться */
			if (options.resetPov) {
				try {
					globe.pointOfView(DEFAULT_POV, 0)
				} catch (_) {
					/* ignore */
				}
			}

			const controls = typeof globe.controls === "function" ? globe.controls() : null
			if (!controls) return

			controlsCleanupRef.current?.()
			controlsCleanupRef.current = null

			controls.enablePan = false
			controls.enableDamping = false
			controls.rotateSpeed = 0.5
			controls.zoomSpeed = 0.65
			controls.enabled = true
			controls.enableZoom = true
			controls.enableRotate = true

			controls.update?.()

			/* Как не-immersive ветка demo-stand RussiaGlobe: широкий polar/azimuth + дистанция от target — иначе узкий azimuth и жёсткий polar ломают drag */
			const polarLo = 0.04
			const polarHi = Math.PI - 0.04
			controls.minPolarAngle = polarLo
			controls.maxPolarAngle = polarHi
			controls.minAzimuthAngle = -Infinity
			controls.maxAzimuthAngle = Infinity

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
			} catch (_) {
				/* ignore */
			}

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
				const altitude = Number.isFinite(altRaw)
					? Math.max(POV_BOUNDS.altMin, Math.min(POV_BOUNDS.altMax, altRaw))
					: DEFAULT_POV.altitude

				const eps = 1e-6
				const needLat = !Number.isFinite(rawLat) || Math.abs(rawLat - lat) > eps
				const needLng = Math.abs(rawLng - lng) > eps
				const needAlt = !Number.isFinite(altRaw) || Math.abs(altRaw - altitude) > eps

				if (!needLat && !needLng && !needAlt) return

				applyingPovClampRef.current = true
				try {
					globe.pointOfView({ lat, lng, altitude }, 0)
					controls.update?.()
				} finally {
					applyingPovClampRef.current = false
				}
			}

			applyPovClamp()

			const onControlsChange = () => applyPovClamp()

			controls.addEventListener("change", onControlsChange)
			controlsCleanupRef.current = () => {
				controls.removeEventListener("change", onControlsChange)
				povBarriersArmedRef.current = false
			}
			povBarriersArmedRef.current = true
		},
		[applyRendererPixelRatio],
	)

	const handleGlobeReady = useCallback(() => {
		installPovBarriers({ resetPov: true })
		requestAnimationFrame(() => installPovBarriers({ resetPov: false }))
	}, [installPovBarriers])

	useEffect(() => {
		if (!webglOk || !povBarriersArmedRef.current) return
		const id = requestAnimationFrame(() => {
			const g = globeRef.current
			if (!g) return
			const c = typeof g.controls === "function" ? g.controls() : null
			if (c) installPovBarriers({ resetPov: false })
		})
		return () => cancelAnimationFrame(id)
	}, [size.width, size.height, webglOk, installPovBarriers])

	useEffect(
		() => () => {
			controlsCleanupRef.current?.()
			controlsCleanupRef.current = null
		},
		[],
	)

	const handlePointClick = useCallback(
		(p) => {
			toggleSelectedFromPoint(p)
			const globe = globeRef.current
			if (!globe || !p) return

			const desiredLat = clamp(
				(p.lat ?? DEFAULT_POV.lat) + 2.2,
				POV_BOUNDS.latMin,
				POV_BOUNDS.latMax,
			)
			latFixedRef.current = desiredLat

			let cur = null
			try {
				cur = globe.pointOfView()
			} catch (_) {
				/* ignore */
			}
			const curAlt = Number.isFinite(cur?.altitude) ? cur.altitude : DEFAULT_POV.altitude
			const curLng = Number.isFinite(cur?.lng) ? normalizeLngDeg(cur.lng) : DEFAULT_POV.lng

			const targetLng = clamp(
				normalizeLngDeg(p.lon ?? curLng),
				POV_BOUNDS.lngMin,
				POV_BOUNDS.lngMax,
			)
			const targetAlt = clamp(curAlt, POV_BOUNDS.altMin, POV_BOUNDS.altMax)

			try {
				globe.pointOfView({ lat: desiredLat, lng: targetLng, altitude: targetAlt }, 350)
			} catch (_) {
				/* ignore */
			}
		},
		[toggleSelectedFromPoint],
	)

	const globeCanvasH = useMemo(
		() => Math.max(240, size.height - TOP_SPACE_PX),
		[size.height],
	)

	const viewportClipClassName = styles.viewportClip

	const chainPanelEl =
		selectedAssetId && chain ? (
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
									window.open(getCdPageUrl(name), "_blank", "noopener,noreferrer")
								}}
							>
								{name}
							</a>
						</li>
					))}
				</ul>
			</div>
		) : null

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
					className={`${styles.cfBtn} ${showCFArrows ? styles.cfBtnActive : ""}`}
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
					<RussiaGlobeGlSurface
						globeRef={globeRef}
						width={size.width}
						viewportHeight={size.height}
						globeCanvasH={globeCanvasH}
						topSpacePx={TOP_SPACE_PX}
						wrapperTransformStyle={undefined}
						viewportClipClassName={viewportClipClassName}
						webglOk={webglOk}
						backgroundColor="#020617"
						backgroundImageUrl={STARFIELD_URL}
						rendererImmersive={false}
						onGlobeReady={handleGlobeReady}
						globeMaterial={model.globeMaterial}
						model={model}
						onPointClick={handlePointClick}
					/>
				</div>
				{chainPanelEl}
			</div>
		</div>
	)
}
