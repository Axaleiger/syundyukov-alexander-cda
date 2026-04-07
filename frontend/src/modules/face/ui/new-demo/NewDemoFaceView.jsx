import { useMemo, useState } from "react"
import { useStand } from "../../../../app/stands/standContext"
import { useFacePageModel } from "../../model/useFacePageModel"
import { NewDemoPlanetScene } from "../../../globe/ui/new-demo/NewDemoPlanetScene"
import { NewDemoHealthCard } from "./health/NewDemoHealthCard"
import { NewDemoHealthExpandedPanel } from "./health/NewDemoHealthExpandedPanel"
import { NewDemoLifecycleCard } from "./lifecycle/NewDemoLifecycleCard"
import { NewDemoLifecycleExpandedPanel } from "./lifecycle/NewDemoLifecycleExpandedPanel"
import styles from "./NewDemoFaceView.module.css"

const TOP_PLACEHOLDER_ITEMS = [{ id: "hypercube", label: "Гиперкуб рычагов влияния" }]

export function NewDemoFaceView() {
	const { routePrefix } = useStand()
	const [activeTopPanel, setActiveTopPanel] = useState(null)

	const {
		mapPointsData,
		selectedAssetId,
		handleMapAssetSelect,
		PRODUCTION_STAGES,
		leftRoseData,
		rightRoseData,
		faceSeed,
		selectedLeftStageIndex,
		selectedRightObjectIndex,
		handleLeftSegmentClick,
		handleRightSegmentClick,
	} = useFacePageModel(routePrefix)

	const selectedAsset = useMemo(
		() => mapPointsData.find((point) => point.id === selectedAssetId) || null,
		[mapPointsData, selectedAssetId],
	)

	const isHealthOpen = activeTopPanel === "health"
	const isLifecycleOpen = activeTopPanel === "lifecycle"
	const isTopRowCompact = activeTopPanel !== null

	const toggleHealthPanel = () => {
		setActiveTopPanel((prev) => (prev === "health" ? null : "health"))
	}

	const toggleLifecyclePanel = () => {
		setActiveTopPanel((prev) => (prev === "lifecycle" ? null : "lifecycle"))
	}

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
						/>
						{TOP_PLACEHOLDER_ITEMS.map((item) => (
							/* Keep active-state wiring consistent for all top blocks. */
							<div
								key={item.id}
								className={`${styles.topPlaceholderCard} ${
									isTopRowCompact ? styles.topPlaceholderCardCompact : ""
								} ${activeTopPanel === item.id ? styles.topPlaceholderCardActive : ""}`}
								aria-hidden
							>
								<p className={styles.topPlaceholderTitle}>{item.label}</p>
								<span className={styles.topPlaceholderTriangle} aria-hidden />
							</div>
						))}
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
					/>
				) : null}
			</section>
			{selectedAsset ? (
				<div className={styles.selectedAssetBadge}>
					<span className={styles.selectedAssetLabel}>Выбран актив:</span>
					<span className={styles.selectedAssetName}>{selectedAsset.name}</span>
				</div>
			) : null}
		</div>
	)
}
