import { useEffect, useMemo, useState } from "react"
import { useStand } from "../../../../app/stands/standContext"
import { useFacePageModel } from "../../model/useFacePageModel"
import { NewDemoPlanetScene } from "../../../globe/ui/new-demo/NewDemoPlanetScene"
import { useHypercube3DModel } from "../../../globe/model/useHypercube3DModel"
import { NewDemoHealthCard } from "./health/NewDemoHealthCard"
import { NewDemoHealthExpandedPanel } from "./health/NewDemoHealthExpandedPanel"
import { NewDemoHypercubeCard } from "./hypercube/NewDemoHypercubeCard"
import { NewDemoHypercubeExpandedPanel } from "./hypercube/NewDemoHypercubeExpandedPanel"
import { NewDemoLifecycleCard } from "./lifecycle/NewDemoLifecycleCard"
import { NewDemoLifecycleExpandedPanel } from "./lifecycle/NewDemoLifecycleExpandedPanel"
import { NewDemoSelectedAssetExpandedPanel } from "./selected-asset/NewDemoSelectedAssetExpandedPanel"
import styles from "./NewDemoFaceView.module.css"

export function NewDemoFaceView() {
	const { routePrefix } = useStand()
	const [activeTopPanel, setActiveTopPanel] = useState(null)
	const [lifecycleViewMode, setLifecycleViewMode] = useState("sum")
	const [lifecycleLegendOnly, setLifecycleLegendOnly] = useState(null)

	const {
		mapPointsData,
		selectedAssetId,
		scenarioComparisonRevision,
		handleMapAssetSelect,
		PRODUCTION_STAGES,
		leftRoseData,
		rightRoseData,
		faceSeed,
		selectedAssetPoint,
		assetStatus,
		assetStatusLabel,
		assetStatusIcon,
		handleClearSelectedAsset,
		selectedLeftStageIndex,
		selectedRightObjectIndex,
		handleLeftSegmentClick,
		handleRightSegmentClick,
		openPlanningWithHighlight,
	} = useFacePageModel(routePrefix)

	const selectedAsset = useMemo(
		() => selectedAssetPoint || mapPointsData.find((point) => point.id === selectedAssetId) || null,
		[selectedAssetPoint, mapPointsData, selectedAssetId],
	)
	const showSelectedAssetUi = Boolean(selectedAssetId && selectedAsset && assetStatus)
	const assetIconColorClass =
		assetStatusIcon &&
		{
			green: styles.selectedAssetIconGreen,
			orange: styles.selectedAssetIconOrange,
			red: styles.selectedAssetIconRed,
		}[assetStatusIcon.color]
	const hypercubeModel = useHypercube3DModel({
		onOpenBpm: openPlanningWithHighlight,
		highlightCaseTree: false,
	})

	const isHealthOpen = activeTopPanel === "health"
	const isLifecycleOpen = activeTopPanel === "lifecycle"
	const isHypercubeOpen = activeTopPanel === "hypercube"
	const isAssetOpen = activeTopPanel === "asset"
	const isTopRowCompact = activeTopPanel !== null

	const toggleHealthPanel = () => {
		setActiveTopPanel((prev) => (prev === "health" ? null : "health"))
	}

	const toggleLifecyclePanel = () => {
		setActiveTopPanel((prev) => (prev === "lifecycle" ? null : "lifecycle"))
	}

	const toggleHypercubePanel = () => {
		setActiveTopPanel((prev) => (prev === "hypercube" ? null : "hypercube"))
	}

	useEffect(() => {
		if (selectedAssetId) {
			setActiveTopPanel("asset")
			return
		}
		setActiveTopPanel((prev) => (prev === "asset" ? null : prev))
	}, [selectedAssetId])

	return (
		<div className={styles.page}>
			<section className={styles.sceneFrame}>
				<div className={styles.topArea}>
					{showSelectedAssetUi ? (
						<div
							className={styles.selectedAssetBar}
							onClick={() => setActiveTopPanel("asset")}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault()
									setActiveTopPanel("asset")
								}
							}}
							role="button"
							tabIndex={0}
							aria-label="Открыть панель выбранного актива"
						>
							<span className={styles.selectedAssetLabel}>Выбран актив</span>
							<span className={styles.selectedAssetName}>{selectedAsset.name}</span>
							<span className={styles.selectedAssetStatus}>{assetStatusLabel}</span>
							{assetStatusIcon ? (
								<span
									className={`${styles.selectedAssetIcon} ${assetIconColorClass || ""}`}
									title={assetStatusLabel}
								>
									{assetStatusIcon.type === "check" && "✓"}
									{assetStatusIcon.type === "exclamation" && "!"}
									{assetStatusIcon.type === "question" && "?"}
								</span>
							) : null}
							<span className={styles.selectedAssetHint}>Открыть детали</span>
							<button
								type="button"
								className={styles.selectedAssetClose}
								onClick={(event) => {
									event.stopPropagation()
									handleClearSelectedAsset()
								}}
								aria-label="Сбросить выбранный актив"
							>
								×
							</button>
						</div>
					) : null}
					<div className={styles.topCardsRow}>
						<NewDemoHealthCard
							data={leftRoseData}
							selectedIndex={selectedLeftStageIndex}
							onSegmentClick={handleLeftSegmentClick}
							isActive={isHealthOpen}
							isCompact={isTopRowCompact}
							onToggle={toggleHealthPanel}
						/>
						<NewDemoLifecycleCard
							isActive={isLifecycleOpen}
							isCompact={isTopRowCompact}
							onToggle={toggleLifecyclePanel}
							viewMode={lifecycleViewMode}
							faceSeed={faceSeed}
						/>
						<NewDemoHypercubeCard
							isActive={isHypercubeOpen}
							isCompact={isTopRowCompact}
							onToggle={toggleHypercubePanel}
							model={hypercubeModel}
						/>
					</div>
				</div>
				<div className={styles.planetArea}>
					<div className={styles.sceneLayer}>
						<NewDemoPlanetScene
							points={mapPointsData}
							selectedAssetId={selectedAssetId}
							onSelectAsset={handleMapAssetSelect}
						/>
					</div>
				</div>
				{isHealthOpen ? (
					<NewDemoHealthExpandedPanel
						PRODUCTION_STAGES={PRODUCTION_STAGES}
						leftData={leftRoseData}
						rightData={rightRoseData}
						selectedLeftStageIndex={selectedLeftStageIndex}
						selectedRightObjectIndex={selectedRightObjectIndex}
						onLeftSegmentClick={handleLeftSegmentClick}
						onRightSegmentClick={handleRightSegmentClick}
						onClose={() => setActiveTopPanel(null)}
					/>
				) : null}
				{isLifecycleOpen ? (
					<NewDemoLifecycleExpandedPanel
						faceSeed={faceSeed}
						onClose={() => setActiveTopPanel(null)}
						viewMode={lifecycleViewMode}
						onViewModeChange={setLifecycleViewMode}
						legendOnly={lifecycleLegendOnly}
						onLegendOnlyChange={setLifecycleLegendOnly}
					/>
				) : null}
				{isHypercubeOpen ? (
					<NewDemoHypercubeExpandedPanel
						onClose={() => setActiveTopPanel(null)}
						model={hypercubeModel}
					/>
				) : null}
				{isAssetOpen && showSelectedAssetUi ? (
					<NewDemoSelectedAssetExpandedPanel
						assetId={selectedAssetId}
						selectedAsset={selectedAsset}
						assetStatusLabel={assetStatusLabel}
						assetStatusIcon={assetStatusIcon}
						scenarioComparisonRevision={scenarioComparisonRevision}
						onClose={() => setActiveTopPanel(null)}
						onClearSelection={handleClearSelectedAsset}
					/>
				) : null}
			</section>
		</div>
	)
}
