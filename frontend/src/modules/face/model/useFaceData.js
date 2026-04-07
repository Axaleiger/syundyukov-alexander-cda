import { useMemo } from "react"
import { useRepositories } from "../../../app/providers/DataRepositoriesProvider"

/**
 * Экран «Лицо»: карта, розы, статусы активов, имена этапов для навигации в сценарии.
 */
export function useFaceData() {
	const { mapGlobe, roses, assetStatus, scenarios } = useRepositories()

	const mapPointsData = useMemo(() => mapGlobe.getMapPoints(), [mapGlobe])
	const productionStages = useMemo(() => roses.getProductionStages(), [roses])
	const objectsByStage = useMemo(() => roses.getObjectsByStage(), [roses])
	const defaultObjects = useMemo(() => roses.getDefaultObjects(), [roses])
	const scenarioStageFilters = useMemo(() => scenarios.getScenarioStageFilters(), [scenarios])

	return {
		mapPointsData,
		productionStages,
		objectsByStage,
		defaultObjects,
		scenarioStageFilters,
		getAssetStatus: assetStatus.getAssetStatus,
		getAssetStatusLabel: assetStatus.getAssetStatusLabel,
		getAssetStatusIcon: assetStatus.getAssetStatusIcon,
	}
}
