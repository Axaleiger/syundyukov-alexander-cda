import { useState } from "react"
import { useFacePageModel } from "../../model/useFacePageModel"
import { useAppStore } from "../../../../core/store/appStore"
import WindRose from "../../../../demo-stand/components/WindRose.jsx"
import Hypercube3D from "../../../../demo-stand/components/Hypercube3D.jsx"
import LifecycleChart from "../../../../demo-stand/components/LifecycleChart.jsx"
import FaceScenarioOverlay from "../../../../demo-stand/components/FaceScenarioOverlay.jsx"
import { useStand } from "../../../../app/stands/standContext"

function HudExpandIcon({ open }) {
	return (
		<svg
			className={`demo-hud-panel-expand-icon${open ? " demo-hud-panel-expand-icon--open" : ""}`}
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden
		>
			<path
				d="M6 9l6 6 6-6"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

/**
 * `/demo/face`: та же разметка и те же презентационные компоненты, что `?demo=stand#face` в demo-stand.
 * Логика — useFacePageModel (общая с основной FacePage).
 */
export function DemoFaceView() {
	const { routePrefix } = useStand()
	const faceSelectedScenarioTitle = useAppStore((s) => s.faceSelectedScenarioTitle)
	const setFaceSelectedScenarioTitle = useAppStore(
		(s) => s.setFaceSelectedScenarioTitle,
	)
	const agreedInfluenceLine = useAppStore((s) => s.agreedInfluenceLine)

	const [hudPanelExpanded, setHudPanelExpanded] = useState(null)

	const {
		PRODUCTION_STAGES,
		hypercubeCaseIntro,
		selectedAssetId,
		scenarioComparisonRevision,
		selectedLeftStageIndex,
		selectedRightObjectIndex,
		selectedAssetPoint,
		assetStatus,
		assetStatusLabel,
		assetStatusIcon,
		faceSeed,
		leftRoseData,
		rightRoseData,
		handleClearSelectedAsset,
		handleLeftSegmentClick,
		handleRightSegmentClick,
		handleLifecycleStageClick,
		openPlanningWithHighlight,
	} = useFacePageModel(routePrefix)

	const showAssetChrome =
		selectedAssetId && selectedAssetPoint && assetStatus

	return (
		<>
			<div className="app-content app-content-face app-face-demo app-face-demo--immersive">
				<div className="app-demo-scene">
					<div
						className={`app-demo-float-top app-demo-float-hud${showAssetChrome ? " app-demo-float-top--with-asset" : ""}`}
					>
						<div className="demo-hud-panels-row">
							<div
								className={`demo-hud-panel demo-hud-panel--roses demo-hud-panel--roses-stand${hudPanelExpanded === "roses" ? " demo-hud-panel--expanded" : ""}`}
							>
								<h3 className="demo-hud-panel__title">Карта здоровья ЦД</h3>
								<div
									className={`demo-wind-rose-stack demo-wind-rose-stack--stand-face${hudPanelExpanded === "roses" ? " demo-wind-rose-stack--stand-face-expanded" : ""}`}
								>
									<div className="demo-wind-rose-stand-primary">
										<div className="wind-rose-item demo-wind-rose-item">
											<WindRose
												type="left"
												standVisual
												showLegend={false}
												data={leftRoseData}
												centerTitle="ЦД этапов"
												selectedIndex={selectedLeftStageIndex}
												onSegmentClick={handleLeftSegmentClick}
											/>
										</div>
										<div className="wind-rose-item demo-wind-rose-item demo-wind-rose-stand-legend">
											<WindRose
												type="left"
												standVisual
												showDiagram={false}
												data={leftRoseData}
												centerTitle="ЦД этапов"
												selectedIndex={selectedLeftStageIndex}
												onSegmentClick={handleLeftSegmentClick}
											/>
										</div>
									</div>
									<button
										type="button"
										className="demo-hud-panel-expand demo-hud-panel-expand--stand-roses"
										onClick={() =>
											setHudPanelExpanded((e) => (e === "roses" ? null : "roses"))
										}
										aria-expanded={hudPanelExpanded === "roses"}
										aria-label={
											hudPanelExpanded === "roses"
												? "Свернуть карту здоровья"
												: "Показать розу объектов"
										}
									>
										<HudExpandIcon open={hudPanelExpanded === "roses"} />
									</button>
									{hudPanelExpanded === "roses" ? (
										<div className="demo-wind-rose-stand-secondary">
											<div className="wind-rose-item demo-wind-rose-item demo-wind-rose-item--second">
												<WindRose
													type="right"
													standVisual
													showLegend={false}
													data={rightRoseData}
													centerTitle={
														selectedLeftStageIndex != null
															? PRODUCTION_STAGES[selectedLeftStageIndex].name
															: "ЦД объектов"
													}
													selectedIndex={selectedRightObjectIndex}
													onSegmentClick={handleRightSegmentClick}
												/>
											</div>
										</div>
									) : null}
								</div>
							</div>

							<div
								className={`demo-hud-panel demo-hud-panel--lifecycle${hudPanelExpanded === "lifecycle" ? " demo-hud-panel--expanded" : ""}`}
							>
								<button
									type="button"
									className="demo-hud-panel-expand"
									onClick={() =>
										setHudPanelExpanded((e) =>
											e === "lifecycle" ? null : "lifecycle",
										)
									}
									aria-expanded={hudPanelExpanded === "lifecycle"}
									aria-label={
										hudPanelExpanded === "lifecycle"
											? "Свернуть жизненный цикл"
											: "Развернуть жизненный цикл"
									}
								>
									<HudExpandIcon open={hudPanelExpanded === "lifecycle"} />
								</button>
								<div className="demo-lifecycle-wrap">
									<LifecycleChart
										compactOverlay
										hudExpanded={hudPanelExpanded === "lifecycle"}
										onStageClick={handleLifecycleStageClick}
										faceSeed={faceSeed}
									/>
								</div>
							</div>

							<div
								className={`demo-hud-panel demo-hud-panel--hyper${hypercubeCaseIntro ? " hypercube-case-intro" : ""}${hudPanelExpanded === "hyper" ? " demo-hud-panel--expanded" : ""}`}
							>
								<button
									type="button"
									className="demo-hud-panel-expand"
									onClick={() =>
										setHudPanelExpanded((e) => (e === "hyper" ? null : "hyper"))
									}
									aria-expanded={hudPanelExpanded === "hyper"}
									aria-label={
										hudPanelExpanded === "hyper"
											? "Свернуть гипер-куб"
											: "Развернуть гипер-куб"
									}
								>
									<HudExpandIcon open={hudPanelExpanded === "hyper"} />
								</button>
								<div className="demo-hypercube-wrap">
									<Hypercube3D
										highlightCaseTree={hypercubeCaseIntro}
										demoHudExpanded={hudPanelExpanded === "hyper"}
										onOpenBpm={openPlanningWithHighlight}
									/>
								</div>
							</div>
						</div>
						{hudPanelExpanded && hudPanelExpanded !== "roses" ? (
							<button
								type="button"
								className="demo-hud-expand-backdrop"
								aria-label="Закрыть увеличенную панель"
								onClick={() => setHudPanelExpanded(null)}
							/>
						) : null}
					</div>

					{showAssetChrome ? (
						<div
							className="demo-float-asset-bar glass-panel demo-glass--light"
							role="status"
							aria-live="polite"
						>
							<span className="app-asset-sticky-name">{selectedAssetPoint.name}</span>
							{agreedInfluenceLine ? (
								<>
									<span className="demo-float-asset-sep" aria-hidden>
										|
									</span>
									<span
										className="app-asset-sticky-influence demo-float-asset-influence"
										title={agreedInfluenceLine}
									>
										{agreedInfluenceLine}
									</span>
								</>
							) : null}
							<span className="app-asset-sticky-status">{assetStatusLabel}</span>
							{assetStatusIcon ? (
								<span
									className={`app-asset-sticky-icon app-asset-sticky-icon-${assetStatusIcon.color}`}
									title={assetStatusLabel}
								>
									{assetStatusIcon.type === "check" && "✓"}
									{assetStatusIcon.type === "exclamation" && "!"}
									{assetStatusIcon.type === "question" && "?"}
								</span>
							) : null}
							<button
								type="button"
								className="app-asset-sticky-close"
								onClick={handleClearSelectedAsset}
								aria-label="Сбросить"
							>
								×
							</button>
						</div>
					) : null}

					{selectedAssetId ? (
						<div className="app-demo-scenario-dock">
							<FaceScenarioOverlay
								assetId={selectedAssetId}
								scenarioComparisonRevision={scenarioComparisonRevision}
								selectedScenarioTitle={faceSelectedScenarioTitle}
								onSelectScenario={setFaceSelectedScenarioTitle}
							/>
						</div>
					) : null}
				</div>
			</div>
		</>
	)
}
