import { useMemo } from "react"
import { useScenariosData } from "../model/useScenariosData"

/** API, совместимый с ScenariosRepository, поверх useScenariosData. */
export function useScenariosRepository() {
	const vm = useScenariosData()
	return useMemo(
		() => ({
			getScenarioStageFilters: () => vm.scenarioStageFilters,
			getPeriodOptions: () => vm.periodOptions,
			getScenarioDirections: () => vm.scenarioDirections,
			getScenarios: () => vm.allScenarios,
			filterScenariosByPeriod: vm.filterScenariosByPeriod,
		}),
		[vm],
	)
}
