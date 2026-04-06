import { useAppStore } from "../../../core/store/appStore"

/** Та же логика, что `handleMapAssetSelect` в useFacePageModel (без навигации). */
export function demoFaceMapAssetSelect(pointId) {
	const {
		resetDemoFaceScenarioWorkflow,
		setSelectedAssetId,
		setScenarioComparisonRevision,
	} = useAppStore.getState()
	resetDemoFaceScenarioWorkflow()
	setSelectedAssetId(pointId || null)
	setScenarioComparisonRevision(0)
}
