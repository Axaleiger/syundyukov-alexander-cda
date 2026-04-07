import { loadLifecycleFromExcel } from "../../static/loadLifecycleExcel.js"
import { getLifecycleStreamData } from "../../static/lifecycleData.js"

/**
 * @returns {import('../contracts/repositoryContracts.js').LifecycleRepository}
 */
export function createStaticLifecycleRepository() {
	return {
		loadLifecycleFromExcel,
		getLifecycleStreamData,
	}
}
