import { useEffect, useMemo, useState } from "react"
import { useRepositories } from "../../../app/providers/DataRepositoriesProvider"

/**
 * Гиперкуб / воронка: размеры уровней и подписи сущностей (в т.ч. после Excel).
 */
export function useFunnelData() {
	const { funnel } = useRepositories()
	const pointsPerLevel = useMemo(() => funnel.getPointsPerLevel(), [funnel])
	const [getEntityLabel, setGetEntityLabel] = useState(() => funnel.getEntityLabel)

	// Источник истины — данные приложения/API. Не загружаем Excel из public.
	useEffect(() => {
		setGetEntityLabel(() => funnel.getEntityLabel)
	}, [funnel])

	return { pointsPerLevel, getEntityLabel }
}
