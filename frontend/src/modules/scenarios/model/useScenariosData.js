import { useCallback, useEffect, useMemo, useState } from "react"
import { useRepositories } from "../../../app/providers/DataRepositoriesProvider"
import { useAppStore } from "../../../core/store/appStore"

/** Список сценариев и фильтры: представление поверх ScenariosRepository. */
export function useScenariosData() {
	const { scenarios } = useRepositories()
	const [vm, setVm] = useState(null)
	const [scenariosLoading, setScenariosLoading] = useState(
		() => typeof scenarios.fetchScenarioViewModel === "function",
	)
	const [scenariosError, setScenariosError] = useState(null)
	const mergeScenarioStageFilterKeys = useAppStore(
		(s) => s.mergeScenarioStageFilterKeys,
	)

	useEffect(() => {
		let cancelled = false
		if (typeof scenarios.fetchScenarioViewModel === "function") {
			setScenariosLoading(true)
			setScenariosError(null)
			scenarios
				.fetchScenarioViewModel()
				.then((data) => {
					if (!cancelled) setVm(data)
				})
				.catch((e) => {
					if (!cancelled) {
						setScenariosError(
							e instanceof Error ? e.message : String(e),
						)
					}
				})
				.finally(() => {
					if (!cancelled) setScenariosLoading(false)
				})
		} else {
			setVm({
				scenarioStageFilters: scenarios.getScenarioStageFilters(),
				periodOptions: scenarios.getPeriodOptions(),
				scenarioDirections: scenarios.getScenarioDirections(),
				allScenarios: scenarios.getScenarios(),
				filterScenariosByPeriod: (list, periodValue) =>
					scenarios.filterScenariosByPeriod(list, periodValue),
			})
			setScenariosLoading(false)
		}
		return () => {
			cancelled = true
		}
	}, [scenarios])

	const refetchScenarios = useCallback(async () => {
		if (typeof scenarios.fetchScenarioViewModel !== "function") return
		setScenariosLoading(true)
		setScenariosError(null)
		try {
			const data = await scenarios.fetchScenarioViewModel()
			setVm(data)
		} catch (e) {
			setScenariosError(e instanceof Error ? e.message : String(e))
		} finally {
			setScenariosLoading(false)
		}
	}, [scenarios])

	useEffect(() => {
		const names = vm?.scenarioStageFilters
		if (!names?.length) return
		mergeScenarioStageFilterKeys(names)
	}, [vm?.scenarioStageFilters, mergeScenarioStageFilterKeys])

	return useMemo(
		() => ({
			scenarioStageFilters:
				vm?.scenarioStageFilters ?? scenarios.getScenarioStageFilters(),
			periodOptions: vm?.periodOptions ?? scenarios.getPeriodOptions(),
			scenarioDirections:
				vm?.scenarioDirections ?? scenarios.getScenarioDirections(),
			allScenarios: vm?.allScenarios ?? scenarios.getScenarios(),
			filterScenariosByPeriod:
				vm?.filterScenariosByPeriod ??
				((list, periodValue) =>
					scenarios.filterScenariosByPeriod(list, periodValue)),
			scenariosLoading,
			scenariosError,
			refetchScenarios,
		}),
		[vm, scenarios, scenariosLoading, scenariosError, refetchScenarios],
	)
}
