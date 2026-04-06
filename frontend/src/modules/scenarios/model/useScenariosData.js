import { useMemo } from "react"
import { useRepositories } from "../../../app/providers/DataRepositoriesProvider"

/** Список сценариев и фильтры: представление поверх ScenariosRepository. */
export function useScenariosData() {
	const { scenarios } = useRepositories()
	const scenarioStageFilters = useMemo(() => scenarios.getScenarioStageFilters(), [scenarios])
	const periodOptions = useMemo(() => scenarios.getPeriodOptions(), [scenarios])
	const scenarioDirections = useMemo(() => scenarios.getScenarioDirections(), [scenarios])
	const allScenarios = useMemo(() => scenarios.getScenarios(), [scenarios])
	const filterScenariosByPeriod = useMemo(
		() => (list, periodValue) => scenarios.filterScenariosByPeriod(list, periodValue),
		[scenarios],
	)

	return useMemo(
		() => ({
			scenarioStageFilters,
			periodOptions,
			scenarioDirections,
			allScenarios,
			filterScenariosByPeriod,
		}),
		[
			scenarioStageFilters,
			periodOptions,
			scenarioDirections,
			allScenarios,
			filterScenariosByPeriod,
		],
	)
}
