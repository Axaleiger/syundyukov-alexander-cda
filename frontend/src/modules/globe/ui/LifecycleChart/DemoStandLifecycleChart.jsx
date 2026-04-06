import React from "react"
import { useLifecycleChartModel } from "../../model/useLifecycleChartModel"
import { LifecycleChartPanels } from "./LifecycleChartPanels"
import styles from "./DemoStandLifecycleChart.module.css"

/**
 * Жизненный цикл для `/demo/face`: как demo-stand LifecycleChart compactOverlay + hudExpanded.
 */
export default function DemoStandLifecycleChart({
	onStageClick,
	faceSeed = 0,
	hudExpanded = false,
}) {
	const model = useLifecycleChartModel({ onStageClick, faceSeed })

	if (model.isLoading) {
		return (
			<div className={`${styles.container} ${styles.containerCompact}`}>
				<div className={styles.loading}>
					<div className={styles.spinner} />
					<span>Загрузка графика…</span>
				</div>
			</div>
		)
	}

	return (
		<div className={`${styles.container} ${styles.containerCompact}`}>
			<LifecycleChartPanels
				viewMode={model.viewMode}
				onViewModeChange={model.setViewMode}
				legendOnly={model.legendOnly}
				onLegendClick={model.handleLegendClick}
				chartData={model.chartData}
				visibleStages={model.visibleStages}
				onStageClick={model.onStageClick}
				selectedStage={model.selectedStage}
				setSelectedStage={model.setSelectedStage}
				compactOverlay
				hudExpanded={hudExpanded}
			/>
		</div>
	)
}
