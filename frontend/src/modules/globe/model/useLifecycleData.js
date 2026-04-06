import { useEffect, useState } from "react"
import { useRepositories } from "../../../app/providers/DataRepositoriesProvider"

/**
 * Поток данных для графика жизненного цикла: загрузка Excel + fallback.
 * Состояние и эффект совпадают с прежней логикой LifecycleChart.
 */
export function useLifecycleData() {
	const { lifecycle } = useRepositories()
	const [streamData, setStreamData] = useState(null)

	useEffect(() => {
		const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "") + "/"
		lifecycle
			.loadLifecycleFromExcel(base)
			.then(setStreamData)
			.catch(() => setStreamData(lifecycle.getLifecycleStreamData()))
	}, [lifecycle])

	return { streamData }
}
