import { useMemo } from "react"
import { useRepositories } from "../../../../app/providers/DataRepositoriesProvider"
import { useAppStore } from "../../../../core/store/appStore"

/**
 * Сравнение сценариев актива + дельты из panels.md после согласования ИИ-плана.
 */
export function useMergedAssetScenarioComparison(assetId) {
	const { assetScenarioComparison } = useRepositories()
	const metricDefs = useMemo(
		() => assetScenarioComparison.getMetricDefs(),
		[assetScenarioComparison],
	)
	const baseComparison = useMemo(
		() => assetScenarioComparison.getComparison(assetId),
		[assetId, assetScenarioComparison],
	)
	const deltaOverride = useAppStore((s) => s.aiScenarioMetricDeltaOverride)

	const comparison = useMemo(() => {
		if (!deltaOverride || !baseComparison?.scenarios?.length) return baseComparison
		return {
			...baseComparison,
			scenarios: baseComparison.scenarios.map((sc) => {
				if (!sc.isBest) return sc
				const nextDeltas = { ...sc.deltas }
				for (const [k, v] of Object.entries(deltaOverride)) {
					if (v && typeof v.amount === "number") nextDeltas[k] = v
				}
				return { ...sc, deltas: nextDeltas }
			}),
		}
	}, [baseComparison, deltaOverride])

	return { metricDefs, comparison }
}
