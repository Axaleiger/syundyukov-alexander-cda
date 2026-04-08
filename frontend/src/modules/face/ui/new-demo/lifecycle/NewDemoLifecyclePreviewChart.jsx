import { useMemo } from "react"
import {
	Area,
	AreaChart,
	CartesianGrid,
	ReferenceLine,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from "recharts"
import { CURRENT_YEAR, stages } from "../../../../globe/ui/LifecycleChart/lifecycleChartConstants"
import { useNewDemoLifecycleModel } from "./useNewDemoLifecycleModel"
import styles from "./NewDemoLifecycleCard.module.css"

export function NewDemoLifecyclePreviewChart({ viewMode, faceSeed }) {
	const model = useNewDemoLifecycleModel({ faceSeed, viewMode, legendOnly: null })

	const chartData = useMemo(() => {
		if (!model.chartData.length) return []
		return model.chartData
	}, [model.chartData])

	const yTicks = useMemo(() => {
		if (!chartData.length) return undefined
		const max = chartData.reduce((m, row) => {
			const sum = stages.reduce((acc, stage) => acc + (Number(row[stage.key]) || 0), 0)
			return Math.max(m, sum)
		}, 0)
		if (!Number.isFinite(max) || max <= 0) return [0]
		const step = max / 3
		const snap = (v) => Math.round(v * 10) / 10
		return [0, snap(step), snap(step * 2), snap(max)]
	}, [chartData])

	const xTicks = useMemo(() => {
		if (!chartData.length) return undefined
		const first = String(chartData[0].year)
		const last = String(chartData[chartData.length - 1].year)
		const current = String(CURRENT_YEAR)
		if (first === last) return [first]
		if (current === first || current === last) return [first, last]
		return [first, current, last]
	}, [chartData])

	if (model.isLoading) {
		return <div className={styles.lifecycleChartLoading}>Загрузка…</div>
	}

	return (
		<div className={styles.lifecycleChartRoot}>
			<ResponsiveContainer width="100%" height="100%">
				<AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 14, left: 4 }}>
					<CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="4 8" />
					<XAxis
						dataKey="year"
						axisLine={{ stroke: "#4e9bcd", strokeWidth: 1.1 }}
						tick={{
							fill: "rgba(255,255,255,0.9)",
							fontSize: 10,
						}}
						tickLine={false}
						ticks={xTicks}
						allowDuplicatedCategory={false}
						dy={8}
					/>
					<YAxis
						domain={[0, "auto"]}
						axisLine={{ stroke: "rgba(255,255,255,0.92)", strokeWidth: 1 }}
						ticks={yTicks}
						tick={{
							fill: "rgba(255,255,255,0.92)",
							fontSize: 10,
						}}
						tickFormatter={(v) => (typeof v === "number" ? v.toFixed(0) : v)}
						tickLine={false}
						width={24}
					/>
					<ReferenceLine y={0} stroke="#4e9bcd" strokeWidth={1.4} />
					<ReferenceLine
						x={String(CURRENT_YEAR)}
						stroke="rgba(0, 112, 186, 1)"
						strokeWidth={1.4}
						strokeDasharray="2 2"
					/>
					{chartData.length ? (
						<ReferenceLine
							segment={[
								{ x: String(CURRENT_YEAR), y: 0 },
								{ x: String(chartData[chartData.length - 1].year), y: 0 },
							]}
							stroke="rgba(230, 89, 7, 1)"
							strokeWidth={1.8}
						/>
					) : null}
					<defs>
						{stages.map((stage) => (
							<linearGradient
								key={stage.key}
								id={`nd-mini-grad-${stage.key}`}
								x1="0"
								y1="0"
								x2="0"
								y2="1"
							>
								<stop offset="0%" stopColor={stage.color} stopOpacity={0.42} />
								<stop offset="100%" stopColor={stage.color} stopOpacity={0.08} />
							</linearGradient>
						))}
					</defs>
					{stages.map((stage) => (
						<Area
							key={stage.key}
							type="monotone"
							dataKey={stage.key}
							stackId={viewMode === "sum" ? "stack" : undefined}
							stroke={stage.color}
							strokeWidth={1.4}
							fill={`url(#nd-mini-grad-${stage.key})`}
							isAnimationActive={false}
						/>
					))}
				</AreaChart>
			</ResponsiveContainer>
		</div>
	)
}
