import { useCallback, useMemo, useState } from "react"
import { useLifecycleData } from "./useLifecycleData"
import { stages } from "../ui/LifecycleChart/lifecycleChartConstants"
import { buildCumulative, smoothSeries } from "../ui/LifecycleChart/lifecycleChartData"

/**
 * Состояние и производные данные графика жизненного цикла (общие для main и demo stand).
 */
export function useLifecycleChartModel({ onStageClick, faceSeed = 0 }) {
	const { streamData } = useLifecycleData()
	const [selectedStage, setSelectedStage] = useState(null)
	const [viewMode, setViewMode] = useState("sum")
	const [legendOnly, setLegendOnly] = useState(null)

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

	const handleLegendClick = useCallback((key) => {
		setLegendOnly((prev) => (prev === key ? null : key))
	}, [])

	const isLoading = streamData == null || streamData.length === 0

	return {
		streamData,
		isLoading,
		chartData,
		visibleStages,
		viewMode,
		setViewMode,
		legendOnly,
		handleLegendClick,
		selectedStage,
		setSelectedStage,
		onStageClick,
	}
}
