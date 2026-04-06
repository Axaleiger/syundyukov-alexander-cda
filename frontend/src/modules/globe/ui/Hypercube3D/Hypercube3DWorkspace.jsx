import React from "react"
import { HypercubeLeverControls } from "./HypercubeLeverControls"
import { HypercubeInfoPanel } from "./HypercubeInfoPanel"
import { HypercubeCanvasShell } from "./HypercubeCanvasShell"

/**
 * Общая композиция рычагов, инфо-панели и canvas — без корневых стилей и блока подсказок.
 */
export function Hypercube3DWorkspace({
	styles,
	model,
	footer,
	compactHud = false,
	rootExtraClass = "",
	/** Только demo-стенд: тёмная инфо-колонка как `.hypercube-controls` в float HUD */
	demoFloatHudInfo = false,
}) {
	const {
		npv,
		setNpv,
		reserves,
		setReserves,
		extraction,
		setExtraction,
		npvMillions,
		reservesMillions,
		extractionMillions,
		filterVariantType,
		setFilterVariantType,
		showRisks,
		setShowRisks,
		cubeCanvasRef,
		isFullscreen,
		selectedVariantId,
		highlightCaseTree,
		closeFunnel,
		handleToggleFullscreen,
		sceneProps,
	} = model

	return (
		<div className={[styles.root, rootExtraClass].filter(Boolean).join(" ")}>
			{!compactHud ? (
				<HypercubeLeverControls
					npv={npv}
					setNpv={setNpv}
					reserves={reserves}
					setReserves={setReserves}
					extraction={extraction}
					setExtraction={setExtraction}
					npvMillions={npvMillions}
					reservesMillions={reservesMillions}
					extractionMillions={extractionMillions}
					floatHud={demoFloatHudInfo}
				/>
			) : null}

			<div className={styles.visualization}>
				{!compactHud ? (
					<HypercubeInfoPanel
						npvMillions={npvMillions}
						reservesMillions={reservesMillions}
						extractionMillions={extractionMillions}
						filterVariantType={filterVariantType}
						setFilterVariantType={setFilterVariantType}
						showRisks={showRisks}
						setShowRisks={setShowRisks}
						hudCompact={demoFloatHudInfo}
					/>
				) : null}
				<HypercubeCanvasShell
					cubeCanvasRef={cubeCanvasRef}
					isFullscreen={isFullscreen}
					selectedVariantId={selectedVariantId}
					highlightCaseTree={highlightCaseTree}
					onCloseFunnel={closeFunnel}
					onToggleFullscreen={handleToggleFullscreen}
					sceneProps={sceneProps}
					hudCompact={compactHud}
				/>
			</div>

			{!compactHud ? footer : null}
		</div>
	)
}
