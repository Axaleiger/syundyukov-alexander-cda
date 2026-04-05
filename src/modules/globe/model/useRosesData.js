import { useMemo } from "react"
import { useRepositories } from "../../../app/providers/DataRepositoriesProvider"

/** Розы / производственные этапы: данные из RosesRepository. */
export function useRosesData() {
	const { roses } = useRepositories()
	const productionStages = useMemo(() => roses.getProductionStages(), [roses])
	const objectsByStage = useMemo(() => roses.getObjectsByStage(), [roses])
	const defaultObjects = useMemo(() => roses.getDefaultObjects(), [roses])

	return {
		productionStages,
		objectsByStage,
		defaultObjects,
		petalColorFromCoverage: roses.petalColorFromCoverage,
	}
}
