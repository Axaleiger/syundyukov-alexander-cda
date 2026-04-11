import { useEffect, useMemo, useRef, useState } from "react"
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
import { NewDemoSelectedAssetSidebar } from "./selected-asset/NewDemoSelectedAssetSidebar"
import { useAppStore } from "../../../../core/store/appStore"
import styles from "./NewDemoFaceView.module.css"

export function NewDemoFaceView() {
	const agreedInfluenceLine = useAppStore((s) => s.agreedInfluenceLine)
	const { routePrefix } = useStand()
	const [activeTopPanel, setActiveTopPanel] = useState(null)
	const [lifecycleViewMode, setLifecycleViewMode] = useState("sum")
	const [lifecycleLegendOnly, setLifecycleLegendOnly] = useState(null)
	const assetSidebarPanelRef = useRef(null)
	const [assetSidebarSafeInset, setAssetSidebarSafeInset] = useState(0)

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
	const hypercubeModel = useHypercube3DModel({
		onOpenBpm: openPlanningWithHighlight,
		highlightCaseTree: false,
	})

	const isHealthOpen = activeTopPanel === "health"
	const isLifecycleOpen = activeTopPanel === "lifecycle"
	const isHypercubeOpen = activeTopPanel === "hypercube"
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
		const className = "new-demo-asset-sidebar-open"
		if (showSelectedAssetUi) {
			document.body.classList.add(className)
			return () => {
				document.body.classList.remove(className)
			}
		}
		document.body.classList.remove(className)
		return undefined
	}, [showSelectedAssetUi])

	useEffect(() => {
		if (!showSelectedAssetUi || !assetSidebarPanelRef.current) {
			setAssetSidebarSafeInset(0)
			return undefined
		}

		const panel = assetSidebarPanelRef.current
		const updateInset = () => {
			const nextInset = Math.ceil(panel.getBoundingClientRect().height) + 16
			setAssetSidebarSafeInset(nextInset)
		}

		updateInset()
		const observer =
			typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateInset) : null
		observer?.observe(panel)
		window.addEventListener("resize", updateInset)

		return () => {
			observer?.disconnect()
			window.removeEventListener("resize", updateInset)
		}
	}, [showSelectedAssetUi])

	useEffect(() => {
		document.body.style.setProperty(
			"--new-demo-asset-sidebar-safe-bottom",
			`${assetSidebarSafeInset}px`,
		)
		return () => {
			document.body.style.removeProperty("--new-demo-asset-sidebar-safe-bottom")
		}
	}, [assetSidebarSafeInset])

	return (
		<div className={styles.page}>
			<section className={styles.sceneFrame}>
				<div className={styles.topArea}>
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
							bottomOverlaySafeInset={assetSidebarSafeInset}
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
				{showSelectedAssetUi ? (
					<NewDemoSelectedAssetSidebar
						assetId={selectedAssetId}
						selectedAsset={selectedAsset}
						assetStatusLabel={assetStatusLabel}
						assetStatusIcon={assetStatusIcon}
						scenarioComparisonRevision={scenarioComparisonRevision}
						agreedInfluenceLine={agreedInfluenceLine}
						onClose={handleClearSelectedAsset}
						panelRef={assetSidebarPanelRef}
					/>
				) : null}
			</section>
		</div>
	)
}
