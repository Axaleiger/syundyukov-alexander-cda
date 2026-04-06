import {
	getAssetStatus,
	getAssetStatusLabel,
	getAssetStatusIcon,
} from "../../static/assetStatus.js"

/**
 * @returns {import('../contracts/repositoryContracts.js').AssetStatusRepository}
 */
export function createStaticAssetStatusRepository() {
	return {
		getAssetStatus,
		getAssetStatusLabel,
		getAssetStatusIcon,
	}
}
