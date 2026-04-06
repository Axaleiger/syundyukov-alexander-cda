import { createStaticScenariosRepository } from "./static/staticScenariosRepository.js"
import { createStaticMapGlobeRepository } from "./static/staticMapGlobeRepository.js"
import { createStaticRosesRepository } from "./static/staticRosesRepository.js"
import { createStaticAssetStatusRepository } from "./static/staticAssetStatusRepository.js"
import { createStaticLifecycleRepository } from "./static/staticLifecycleRepository.js"
import { createStaticFunnelRepository } from "./static/staticFunnelRepository.js"
import { createStaticAssetScenarioComparisonRepository } from "./static/staticAssetScenarioComparisonRepository.js"

/**
 * Сборка всех статических репозиториев (текущий источник истины).
 * @returns {import('./contracts/repositoryContracts.js').AppRepositories}
 */
export function createStaticRepositories() {
	return {
		scenarios: createStaticScenariosRepository(),
		mapGlobe: createStaticMapGlobeRepository(),
		roses: createStaticRosesRepository(),
		assetStatus: createStaticAssetStatusRepository(),
		lifecycle: createStaticLifecycleRepository(),
		funnel: createStaticFunnelRepository(),
		assetScenarioComparison: createStaticAssetScenarioComparisonRepository(),
	}
}
