import { createHttpScenariosRepository } from "./httpScenariosRepository.js"
import { createStaticMapGlobeRepository } from "../static/staticMapGlobeRepository.js"
import { createStaticRosesRepository } from "../static/staticRosesRepository.js"
import { createStaticAssetStatusRepository } from "../static/staticAssetStatusRepository.js"
import { createStaticLifecycleRepository } from "../static/staticLifecycleRepository.js"
import { createStaticFunnelRepository } from "../static/staticFunnelRepository.js"
import { createStaticAssetScenarioComparisonRepository } from "../static/staticAssetScenarioComparisonRepository.js"

/**
 * Репозитории с данными сценариев из REST API; остальное — статика до появления эндпоинтов.
 * @returns {import('../contracts/repositoryContracts.js').AppRepositories}
 */
export function createHttpRepositories() {
	return {
		scenarios: createHttpScenariosRepository(),
		mapGlobe: createStaticMapGlobeRepository(),
		roses: createStaticRosesRepository(),
		assetStatus: createStaticAssetStatusRepository(),
		lifecycle: createStaticLifecycleRepository(),
		funnel: createStaticFunnelRepository(),
		assetScenarioComparison: createStaticAssetScenarioComparisonRepository(),
	}
}
