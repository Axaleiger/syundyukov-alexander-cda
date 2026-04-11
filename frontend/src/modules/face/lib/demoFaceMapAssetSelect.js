import { useAppStore } from "../../../core/store/appStore"

/** Та же логика, что `handleMapAssetSelect` в useFacePageModel (без навигации). */
export function demoFaceMapAssetSelect(pointId) {
	const {
		resetDemoFaceScenarioWorkflow,
		setSelectedAssetId,
		setScenarioComparisonRevision,
	} = useAppStore.getState()
	/** Снятие выделения с точки — не сбрасываем face-workflow (иначе теряется согласованный пресет планирования и пр.). */
	if (pointId) {
		resetDemoFaceScenarioWorkflow()
	}
	setSelectedAssetId(pointId || null)
	setScenarioComparisonRevision(0)
}
