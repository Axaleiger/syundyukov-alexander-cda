import {
	getAssetScenarioComparisonDemo,
	SCENARIO_METRIC_DEFS,
} from "../../demo/assetScenarioComparison.demo.js"

/**
 * @returns {import('../contracts/repositoryContracts.js').AssetScenarioComparisonRepository}
 */
export function createStaticAssetScenarioComparisonRepository() {
	return {
		getComparison: (assetId) => getAssetScenarioComparisonDemo(assetId),
		getMetricDefs: () => SCENARIO_METRIC_DEFS,
	}
}
