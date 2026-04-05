import { useEffect, useMemo, useState } from "react"
import { useRepositories } from "../../../app/providers/DataRepositoriesProvider"

/**
 * Гиперкуб / воронка: размеры уровней и подписи сущностей (в т.ч. после Excel).
 */
export function useFunnelData() {
	const { funnel } = useRepositories()
	const pointsPerLevel = useMemo(() => funnel.getPointsPerLevel(), [funnel])
	const [getEntityLabel, setGetEntityLabel] = useState(() => funnel.getEntityLabel)

	useEffect(() => {
		funnel
			.loadFunnelFromExcel()
			.then(funnel.buildFunnelFromEntities)
			.then((built) => {
				if (built && built.getEntityLabel) setGetEntityLabel(() => built.getEntityLabel)
			})
			.catch(() => {})
	}, [funnel])

	return { pointsPerLevel, getEntityLabel }
}
