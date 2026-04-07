import React, { useCallback, useEffect, useRef, useState } from "react"
import styles from "./RussiaGlobe.module.css"
import { useRussiaGlobeMapModel, getCdPageUrl } from "../model/useRussiaGlobeMapModel"
import { RussiaGlobeGlSurface } from "./RussiaGlobeGlSurface"
import {
	IMMERSIVE_STAND_POV,
	POV_ALT_MAX,
	POV_ALT_MIN_STAND,
	STAND_FACE_DOME_BAND_VH,
} from "./globeStandConstants"

function clamp(v, min, max) {
	return Math.max(min, Math.min(max, v))
}

function normalizeLngDeg(lng) {
	if (!Number.isFinite(lng)) return IMMERSIVE_STAND_POV.lng
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
 * Глобус для `/demo/face` (stand): полоса купола, прозрачный фон, фиксированный POV, HUD.
 */
export default function DemoStandRussiaGlobe({ onAssetSelect }) {
	const globeRef = useRef(null)
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

	const controlsCleanupRef = useRef(null)
	const povBarriersArmedRef = useRef(false)

	const [size, setSize] = useState({ width: 800, height: 620 })

	const topSpacePx = 0

	const applyRendererPixelRatio = useCallback(() => {
		try {
			const g = globeRef.current
			const r = g?.renderer?.()
			if (r?.setPixelRatio) {
				const dpr = window.devicePixelRatio || 1
				const cap = 2
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

		const measure = () => {
			const vw = typeof window !== "undefined" ? window.innerWidth : 800
			const vh = typeof window !== "undefined" ? window.innerHeight : 600
			const w = Math.max(320, Math.floor(vw))
			const h = Math.max(160, Math.floor(vh * STAND_FACE_DOME_BAND_VH))
			setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }))
		}
		measure()
		window.addEventListener("resize", measure)
		return () => window.removeEventListener("resize", measure)
	}, [setWebglOk])

	const installPovBarriers = useCallback(
		(options = { resetPov: true }) => {
			applyRendererPixelRatio()
			const globe = globeRef.current
			if (!globe) return

			if (options.resetPov) {
				try {
					globe.pointOfView(IMMERSIVE_STAND_POV, 0)
				} catch (_) {
					/* ignore */
				}
			}
			const controls = typeof globe.controls === "function" ? globe.controls() : null
			controlsCleanupRef.current?.()
			controlsCleanupRef.current = null
			if (controls) {
				controls.enablePan = false
				controls.enableDamping = false
				controls.rotateSpeed = 0.42
				controls.zoomSpeed = 0.55
				controls.enableZoom = false
				controls.enableRotate = false
				controls.enabled = false
				controls.update?.()
			}
			controlsCleanupRef.current = () => {
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
			installPovBarriers({ resetPov: true })
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

			const refPov = IMMERSIVE_STAND_POV
			const desiredLat = clamp((p.lat ?? refPov.lat) + 2.2, -88, 88)
			let cur = null
			try {
				cur = globe.pointOfView()
			} catch (_) {
				/* ignore */
			}
			const curAlt = Number.isFinite(cur?.altitude) ? cur.altitude : refPov.altitude
			const curLng = Number.isFinite(cur?.lng) ? normalizeLngDeg(cur.lng) : refPov.lng
			const targetLng = normalizeLngDeg(p.lon ?? curLng)
			const targetAlt = clamp(curAlt, POV_ALT_MIN_STAND, POV_ALT_MAX)
			try {
				globe.pointOfView({ lat: desiredLat, lng: targetLng, altitude: targetAlt }, 350)
			} catch (_) {
				/* ignore */
			}
			requestAnimationFrame(() => installPovBarriers({ resetPov: false }))
		},
		[toggleSelectedFromPoint, installPovBarriers],
	)

	const globeCanvasH = Math.max(160, size.height - topSpacePx)

	const viewportClipClassName = [
		styles.viewportClip,
		styles.viewportClipStand,
		styles.viewportClipImmersive,
		styles.viewportClipStandFace,
	].join(" ")

	const chainPanelEl =
		selectedAssetId && chain ? (
			<div className={`${styles.chainPanel} ${styles.chainPanelImmersive}`}>
				<div className={`${styles.chainTitle} ${styles.chainTitleImmersive}`}>Цифровые двойники</div>
				<ul className={styles.chainList}>
					{chain.nodes.map((name, i) => (
						<li key={i} className={`${styles.chainItem} ${styles.chainItemImmersive}`}>
							<span className={styles.chainNum}>{i + 1}</span>
							<a
								href={getCdPageUrl(name)}
								target="_blank"
								rel="noopener noreferrer"
								className={`${styles.chainLink} ${styles.chainLinkImmersive}`}
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
		<div className={`${styles.containerImmersive} ${styles.containerStandGlobe}`}>
			<div className={`${styles.wrapper} ${styles.wrapperPerf} ${styles.wrapperImmersiveBg}`}>
				<RussiaGlobeGlSurface
					globeRef={globeRef}
					width={size.width}
					viewportHeight={size.height}
					globeCanvasH={globeCanvasH}
					topSpacePx={topSpacePx}
					wrapperTransformStyle={undefined}
					viewportClipClassName={viewportClipClassName}
					webglOk={webglOk}
					backgroundColor="rgba(0,0,0,0)"
					backgroundImageUrl={undefined}
					rendererImmersive
					onGlobeReady={handleGlobeReady}
					globeMaterial={model.globeMaterial}
					model={model}
					onPointClick={handlePointClick}
				/>
				<div className={styles.immersiveHud} aria-label="Слои карты">
					<button
						type="button"
						className={`${styles.hudIconBtn} ${showBudgetFill ? styles.hudIconBtnActive : ""}`}
						title="Бюджет по активам (недостаток / избыток)"
						aria-pressed={showBudgetFill}
						onClick={() => setShowBudgetFill((v) => !v)}
					>
						<span className={styles.hudIconBtnInner} aria-hidden>
							<svg className={styles.hudSvg} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<rect x="4" y="14" width="16" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
								<path
									d="M6 14V10h4v4M10 10V6h4v4M14 6V3h4v3"
									stroke="currentColor"
									strokeWidth="1.4"
									strokeLinecap="round"
								/>
							</svg>
						</span>
					</button>
					<button
						type="button"
						className={`${styles.hudIconBtn} ${showCFArrows ? styles.hudIconBtnActive : ""}`}
						title="Перераспределение CF (млн руб) ДО → активы"
						aria-pressed={showCFArrows}
						onClick={() => setShowCFArrows((v) => !v)}
					>
						<span className={styles.hudIconBtnInner} aria-hidden>
							<svg className={styles.hudSvg} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
