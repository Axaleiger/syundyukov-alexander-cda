import {
	SCENARIO_STAGE_FILTERS,
	PERIOD_OPTIONS,
	generateScenarios,
	filterScenariosByPeriod,
	SCENARIO_DIRECTIONS,
} from "../../static/scenariosData.js"

/** Один снимок списка, как раньше при `const ALL = generateScenarios()` на уровне модуля. */
const CACHED_SCENARIOS = generateScenarios()

/**
 * @returns {import('../contracts/repositoryContracts.js').ScenariosRepository}
 */
export function createStaticScenariosRepository() {
	return {
		getScenarioStageFilters: () => SCENARIO_STAGE_FILTERS,
		getPeriodOptions: () => PERIOD_OPTIONS,
		getScenarioDirections: () => SCENARIO_DIRECTIONS,
		getScenarios: () => CACHED_SCENARIOS,
		filterScenariosByPeriod: (scenarios, periodValue) =>
			filterScenariosByPeriod(scenarios, periodValue),
	}
}
