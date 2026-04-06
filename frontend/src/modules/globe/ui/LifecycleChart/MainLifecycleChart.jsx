import React from "react"
import { useLifecycleChartModel } from "../../model/useLifecycleChartModel"
import { LifecycleChartPanels } from "./LifecycleChartPanels"
import styles from "./LifecycleChart.module.css"

/**
 * Жизненный цикл для основного `/face`.
 */
export default function MainLifecycleChart({ onStageClick, faceSeed = 0 }) {
	const model = useLifecycleChartModel({ onStageClick, faceSeed })

	if (model.isLoading) {
		return (
			<div className={styles.container}>
				<div className={styles.loading}>
					<div className={styles.spinner} />
					<span>Загрузка графика…</span>
				</div>
			</div>
		)
	}

	return (
		<div className={styles.container}>
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
			/>
		</div>
	)
}
