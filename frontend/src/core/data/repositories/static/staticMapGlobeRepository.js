import mapPointsData from "../../static/mapPoints.json"
import chainsData from "../../static/chains.json"
import { CF_ARROWS } from "../../static/cfArrows.js"
import {
	ASSET_REGION_NAMES,
	BUDGET_BY_ASSET,
	budgetToColor,
	getAssetRegionKey,
	getBudgetForAssetId,
} from "../../static/mapBudgetData.js"

/**
 * @returns {import('../contracts/repositoryContracts.js').MapGlobeRepository}
 */
export function createStaticMapGlobeRepository() {
	return {
		getMapPoints: () => mapPointsData,
		getChains: () => chainsData,
		getCfArrows: () => CF_ARROWS,
		getBudgetForAssetId,
		getBudgetByAsset: () => BUDGET_BY_ASSET,
		budgetToColor,
		getAssetRegionKey,
		getAssetRegionNames: () => ASSET_REGION_NAMES,
	}
}
