import React, { useEffect, useState } from "react"
import Globe from "react-globe.gl"
import { globeCtaPulseColor, globePointIsCtaPulse } from "../constants/globeCtaPulsePoints"
import styles from "./RussiaGlobe.module.css"

/**
 * Общий монтирование react-globe.gl: viewport, ошибка WebGL, слои.
 * Размеры, фон, onGlobeReady и onPointClick задаёт презентер.
 */
export function RussiaGlobeGlSurface({
	globeRef,
	width,
	viewportHeight,
	globeCanvasH,
	topSpacePx,
	wrapperTransformStyle,
	viewportClipClassName,
	webglOk,
	backgroundColor,
	backgroundImageUrl,
	rendererImmersive,
	onGlobeReady,
	globeMaterial,
	model,
	onPointClick,
}) {
	const {
		allPathsData,
		budgetZoneFeatures,
		mapPointsData,
		ringsData,
		arcsData,
		arrowHeadsData,
		showBudgetFill,
		showCFArrows,
		selectedAssetId,
		hoveredAssetId,
		hoveredArcIndex,
		keyAssetIds,
		polygonCapColor,
		polygonSideColor,
		polygonLabel,
		pointLabel,
		setHoveredAssetId,
		setHoveredArcIndex,
		getArrowThreeObject,
		updateArrowThreeObject,
		pointsMerge,
	} = model

	const [pulseSec, setPulseSec] = useState(0)
	useEffect(() => {
		let raf = 0
		let last = 0
		const loop = (t) => {
			raf = requestAnimationFrame(loop)
			if (t - last < 50) return
			last = t
			setPulseSec(t * 0.001)
		}
		raf = requestAnimationFrame(loop)
		return () => cancelAnimationFrame(raf)
	}, [])

	if (!webglOk) {
		return (
			<div className={styles.error}>
				WebGL недоступен (или заблокирован) — 3D-глобус не может быть показан на этом устройстве/в этом браузере.
			</div>
		)
	}

	return (
		<div className={viewportClipClassName} aria-hidden="false" style={{ height: viewportHeight }}>
			{topSpacePx > 0 ? <div style={{ height: topSpacePx }} aria-hidden="true" /> : null}
			<div style={wrapperTransformStyle}>
				<Globe
					ref={globeRef}
					width={width}
					height={globeCanvasH}
					backgroundColor={backgroundColor}
					backgroundImageUrl={backgroundImageUrl}
					globeImageUrl={null}
					bumpImageUrl={null}
					globeMaterial={globeMaterial}
					showAtmosphere={false}
					showGraticules={false}
					onGlobeReady={onGlobeReady}
					waitForGlobeReady
					lineHoverPrecision={0.35}
					enablePointerInteraction
					rendererConfig={{
						antialias: !!rendererImmersive,
						alpha: true,
						powerPreference: rendererImmersive ? "high-performance" : "low-power",
					}}
					pathsData={allPathsData}
					pathPoints={(d) => d.points}
					pathPointLat={(p) => p.lat}
					pathPointLng={(p) => p.lng}
					pathPointAlt={(p) => p.alt}
					pathColor={() => "rgba(0,220,255,0.78)"}
					pathStroke={() => 1.05}
					pathResolution={1}
					pathsTransitionDuration={0}
					polygonsData={budgetZoneFeatures}
					polygonsTransitionDuration={0}
					polygonCapColor={polygonCapColor}
					polygonCapCurvatureResolution={10}
					polygonSideColor={polygonSideColor}
					polygonStrokeColor={() => null}
					polygonAltitude={() => (showBudgetFill ? 0.012 : 0.01)}
					polygonLabel={polygonLabel}
					pointsData={mapPointsData}
					pointLat={(d) => d.lat}
					pointLng={(d) => d.lon}
					pointResolution={8}
					pointsMerge={pointsMerge}
					pointColor={(d) => {
						if (selectedAssetId === d.id) return "#22d3ee"
						if (hoveredAssetId === d.id) return "#38bdf8"
						if (globePointIsCtaPulse(d)) return globeCtaPulseColor(pulseSec)
						if (keyAssetIds.has(d.id)) return "#ef4444"
						return "#0ea5e9"
					}}
					pointAltitude={() => 0}
					pointRadius={(d) =>
						selectedAssetId === d.id ? 0.32 : hoveredAssetId === d.id ? 0.29 : 0.22}
					pointLabel={pointLabel}
					onPointHover={(p) => setHoveredAssetId(p?.id || null)}
					onPointClick={(p) => onPointClick(p)}
					ringsData={ringsData}
					ringLat={(d) => d.lat}
					ringLng={(d) => d.lon}
					ringColor={(d) =>
						keyAssetIds.has(d.id)
							? ["rgba(239,68,68,0.65)", "rgba(239,68,68,0)"]
							: ["rgba(34,211,238,0.55)", "rgba(34,211,238,0)"]}
					ringMaxRadius={(d) => (d.__ringIdx === 0 ? 1.25 : 1.95)}
					ringPropagationSpeed={(d) => (d.__ringIdx === 0 ? 1.2 : 1.0)}
					ringRepeatPeriod={(d) => (d.__ringIdx === 0 ? 1100 : 1400)}
					arcsData={showCFArrows ? arcsData : []}
					arcsTransitionDuration={0}
					arcLabel={(a) =>
						`<div style="font-weight:700">${a.label}</div><div style="opacity:.85">CF: ${a.cf} млн</div>`}
					arcColor={(a, idx) => (idx === hoveredArcIndex ? "#f97316" : "#22d3ee")}
					arcStroke={null}
					arcCurveResolution={20}
					arcAltitude={0}
					arcDashLength={1}
					arcDashGap={0}
					arcDashAnimateTime={0}
					onArcHover={(a) => {
						if (!a) {
							setHoveredArcIndex(null)
							return
						}
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
		</div>
	)
}
