import React from "react"
import { LifecycleStreamGraphPanel } from "./LifecycleStreamGraphPanel"
import { LifecycleStagesPanel } from "./LifecycleStagesPanel"

/**
 * Верхняя (streamgraph) и нижняя (карточки этапов) зоны — без корневого контейнера/загрузки.
 */
export function LifecycleChartPanels({
	viewMode,
	onViewModeChange,
	legendOnly,
	onLegendClick,
	chartData,
	visibleStages,
	onStageClick,
	selectedStage,
	setSelectedStage,
	compactOverlay = false,
	hudExpanded = false,
}) {
	return (
		<>
			<LifecycleStreamGraphPanel
				viewMode={viewMode}
				onViewModeChange={onViewModeChange}
				legendOnly={legendOnly}
				onLegendClick={onLegendClick}
				chartData={chartData}
				visibleStages={visibleStages}
				onStageClick={onStageClick}
				compactOverlay={compactOverlay}
				hudExpanded={hudExpanded}
			/>
			{!compactOverlay ? (
				<LifecycleStagesPanel
					selectedStage={selectedStage}
					setSelectedStage={setSelectedStage}
					onStageClick={onStageClick}
				/>
			) : null}
		</>
	)
}
