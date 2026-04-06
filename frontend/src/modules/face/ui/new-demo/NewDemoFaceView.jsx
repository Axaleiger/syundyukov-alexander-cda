import { useMemo, useState } from "react"
import { useStand } from "../../../../app/stands/standContext"
import { useFacePageModel } from "../../model/useFacePageModel"
import { NewDemoPlanetScene } from "../../../globe/ui/new-demo/NewDemoPlanetScene"
import { NewDemoHealthCard } from "./health/NewDemoHealthCard"
import { NewDemoHealthExpandedPanel } from "./health/NewDemoHealthExpandedPanel"
import styles from "./NewDemoFaceView.module.css"

const TOP_PLACEHOLDER_ITEMS = [
	{ id: "health", label: "Карта здоровья ЦД" },
	{ id: "lifecycle", label: "ЖЦ Актива" },
	{ id: "hypercube", label: "Гиперкуб рычагов влияния" },
]

export function NewDemoFaceView() {
	const { routePrefix } = useStand()
	const [activeTopPanel, setActiveTopPanel] = useState(null)

	const {
		mapPointsData,
		selectedAssetId,
		handleMapAssetSelect,
		leftRoseData,
		rightRoseData,
	} = useFacePageModel(routePrefix)

	const selectedAsset = useMemo(
		() => mapPointsData.find((point) => point.id === selectedAssetId) || null,
		[mapPointsData, selectedAssetId],
	)

	const leftMetrics = useMemo(
		() =>
			leftRoseData
				.slice(0, 5)
				.map((item) => ({ name: item.name, value: Math.round(item.value || 0) })),
		[leftRoseData],
	)

	const rightMetrics = useMemo(
		() =>
			rightRoseData
				.slice(0, 5)
				.map((item) => ({ name: item.name, value: Math.round(item.value || 0) })),
		[rightRoseData],
	)

	const isHealthOpen = activeTopPanel === "health"

	const toggleHealthPanel = () => {
		setActiveTopPanel((prev) => (prev === "health" ? null : "health"))
	}

	return (
		<div className={styles.page}>
			<section className={styles.sceneFrame}>
				<div className={styles.topArea}>
					<div className={styles.topCardsRow}>
						<NewDemoHealthCard
							data={leftRoseData}
							isActive={isHealthOpen}
							onToggle={toggleHealthPanel}
						/>
						{TOP_PLACEHOLDER_ITEMS.filter((item) => item.id !== "health").map((item) => (
							<div key={item.id} className={styles.topPlaceholderCard} aria-hidden>
								<h2 className={styles.topPlaceholderTitle}>{item.label}</h2>
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
						leftData={leftRoseData}
						rightData={rightRoseData}
						leftMetrics={leftMetrics}
						rightMetrics={rightMetrics}
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
