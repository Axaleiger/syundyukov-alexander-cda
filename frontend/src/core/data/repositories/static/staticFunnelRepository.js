import {
	POINTS_PER_LEVEL,
	getEntityLabel,
	FUNNEL_ENTITY_LABELS,
} from "../../static/funnelEntities.js"
import {
	loadFunnelFromExcel,
	buildFunnelFromEntities,
} from "../../static/loadFunnelFromExcel.js"

/**
 * @returns {import('../contracts/repositoryContracts.js').FunnelRepository}
 */
export function createStaticFunnelRepository() {
	return {
		getPointsPerLevel: () => POINTS_PER_LEVEL,
		getEntityLabel,
		getFunnelEntityLabels: () => FUNNEL_ENTITY_LABELS,
		loadFunnelFromExcel,
		buildFunnelFromEntities,
	}
}
