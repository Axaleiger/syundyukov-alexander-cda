import {
	PRODUCTION_STAGES,
	OBJECTS_BY_STAGE,
	DEFAULT_OBJECTS,
	petalColorFromCoverage,
} from "../../static/rosesData.js"

/**
 * @returns {import('../contracts/repositoryContracts.js').RosesRepository}
 */
export function createStaticRosesRepository() {
	return {
		getProductionStages: () => PRODUCTION_STAGES,
		getObjectsByStage: () => OBJECTS_BY_STAGE,
		getDefaultObjects: () => DEFAULT_OBJECTS,
		petalColorFromCoverage,
	}
}
