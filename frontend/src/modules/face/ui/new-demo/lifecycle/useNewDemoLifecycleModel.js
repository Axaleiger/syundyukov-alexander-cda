import { useMemo } from "react"
import { useLifecycleData } from "../../../../globe/model/useLifecycleData"
import { stages } from "../../../../globe/ui/LifecycleChart/lifecycleChartConstants"
import { buildCumulative, smoothSeries } from "../../../../globe/ui/LifecycleChart/lifecycleChartData"

/**
 * New-demo controlled lifecycle model:
 * - data source is shared (useLifecycleData)
 * - viewMode + legendOnly are controlled by parent (persist across open/close)
 */
export function useNewDemoLifecycleModel({ faceSeed = 0, viewMode, legendOnly }) {
	const { streamData } = useLifecycleData()

	const chartData = useMemo(() => {
		if (!streamData || streamData.length === 0) return []
		const factor = faceSeed ? 0.9 + (faceSeed % 20) / 100 : 1
		const keys = stages.map((s) => s.key)
		const scale = (row) => {
			const out = { year: row.year }
			keys.forEach((k) => {
				out[k] = (row[k] ?? 0) * factor
			})
			return out
		}
		let data = streamData.map(scale)
		if (viewMode === "cumulative") {
			data = buildCumulative(data)
		} else {
			keys.forEach((key) => {
				data = smoothSeries(data, key)
			})
		}
		return data
	}, [streamData, viewMode, faceSeed])

	const visibleStages = useMemo(() => {
		if (legendOnly == null) return stages
		return stages.filter((s) => s.key === legendOnly)
	}, [legendOnly])

	const isLoading = streamData == null || streamData.length === 0

	return { isLoading, chartData, visibleStages }
}

