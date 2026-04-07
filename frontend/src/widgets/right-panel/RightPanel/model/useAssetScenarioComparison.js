import { useMemo } from "react"
import { useRepositories } from "../../../../app/providers/DataRepositoriesProvider"

/** Панель сравнения сценариев актива (демо-данные через репозиторий). */
export function useAssetScenarioComparison(assetId) {
	const { assetScenarioComparison } = useRepositories()
	const metricDefs = useMemo(
		() => assetScenarioComparison.getMetricDefs(),
		[assetScenarioComparison],
	)
	const comparison = useMemo(
		() => assetScenarioComparison.getComparison(assetId),
		[assetId, assetScenarioComparison],
	)

	return { metricDefs, comparison }
}
