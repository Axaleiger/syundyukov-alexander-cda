import { useEffect, useMemo, useRef, useState } from "react"
import {
	Area,
	AreaChart,
	CartesianGrid,
	Line,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts"
import { useNewDemoLifecycleModel } from "./useNewDemoLifecycleModel"
import {
	CURRENT_YEAR,
	stages,
	VIEW_MODES,
} from "../../../../globe/ui/LifecycleChart/lifecycleChartConstants"
import styles from "./NewDemoLifecycleExpandedPanel.module.css"

const STAGE_SHORT_LABELS = {
	geologorazvedka: "Геологоразведка",
	razrabotka: "Разработка",
	planirovanie: "Планирование и обустройство",
	burenie: "Бурение и ВСР",
	dobycha: "Добыча",
}

function formatValue(value) {
	if (typeof value !== "number" || Number.isNaN(value)) return "0,0"
	return value.toFixed(1).replace(".", ",")
}

function getNearestYearIndex(rows, yearTarget) {
	if (!rows.length) return 0
	let bestIndex = 0
	let bestDistance = Number.POSITIVE_INFINITY
	rows.forEach((row, index) => {
		const year = Number(row.year)
		const distance = Number.isNaN(year) ? Number.POSITIVE_INFINITY : Math.abs(year - yearTarget)
		if (distance < bestDistance) {
			bestDistance = distance
			bestIndex = index
		}
	})
	return bestIndex
}

const VISUAL_Y_LABELS = [0, 20, 40, 60, 80, 100]

export function NewDemoLifecycleExpandedPanel({
	onClose,
	faceSeed = 0,
	viewMode,
	onViewModeChange,
	legendOnly,
	onLegendOnlyChange,
}) {
	const model = useNewDemoLifecycleModel({ faceSeed, viewMode, legendOnly })
	const [tooltipIndex, setTooltipIndex] = useState(0)
	const [activeChartX, setActiveChartX] = useState(null)
	const [chartAreaWidth, setChartAreaWidth] = useState(0)
	const chartAreaRef = useRef(null)

	const rows = useMemo(() => {
		if (!model.chartData.length) return []
		return model.chartData.map((row) => {
			const total = stages.reduce(
				(sum, stage) => sum + (Number(row[stage.key]) || 0),
				0,
			)
			return { ...row, __total: total }
		})
	}, [model.chartData])

	const effectiveTooltipIndex = useMemo(() => {
		if (!rows.length) return 0
		if (tooltipIndex > 0) return Math.min(tooltipIndex, rows.length - 1)
		return getNearestYearIndex(rows, 2037)
	}, [rows, tooltipIndex])

	const tooltipRow = rows[effectiveTooltipIndex] || null

	const yMax = useMemo(() => {
		const max = rows.reduce((m, row) => Math.max(m, row.__total || 0), 0)
		if (max <= 0) return 5
		return Math.ceil(max / 5) * 5
	}, [rows])

	const yTicks = useMemo(() => {
		const step = yMax / 5
		return Array.from({ length: 6 }, (_, idx) => Number((idx * step).toFixed(2)))
	}, [yMax])

	const futureSegmentEndYear = useMemo(
		() => (rows.length ? String(rows[rows.length - 1].year) : null),
		[rows],
	)

	useEffect(() => {
		const node = chartAreaRef.current
		if (!node) return undefined
		const update = () => setChartAreaWidth(node.clientWidth)
		update()
		const observer = new ResizeObserver(update)
		observer.observe(node)
		return () => observer.disconnect()
	}, [])

	const tooltipPosition = useMemo(() => {
		const tooltipWidth = 340
		const minLeft = 8
		const maxLeft = Math.max(minLeft, chartAreaWidth - tooltipWidth - 8)
		const target = (activeChartX ?? chartAreaWidth * 0.62) - tooltipWidth / 2
		const left = Math.max(minLeft, Math.min(target, maxLeft))
		return { left: `${left}px`, top: "0px" }
	}, [activeChartX, chartAreaWidth])

	return (
		<div className={styles.expandedRoot}>
			<section className={styles.modal} aria-label="Этап выбранного жизненного цикла актива">
				<header className={styles.header}>
					<p className={styles.title}>Этап выбранного жизненного цикла актива</p>
					<button
						type="button"
						className={styles.closeBtn}
						onClick={onClose}
						aria-label="Закрыть панель ЖЦ Актива"
					>
						×
					</button>
				</header>

				<div className={styles.tabs}>
					{VIEW_MODES.map((mode) => (
						<button
							key={mode.id}
							type="button"
							className={`${styles.tab} ${viewMode === mode.id ? styles.tabActive : ""}`}
							onClick={() => onViewModeChange(mode.id)}
						>
							{mode.id === "default" ? "Детализировано" : mode.label}
						</button>
					))}
				</div>

				<div className={styles.stagesNav}>
					{stages.map((stage) => {
						const isActive = legendOnly === stage.key
						return (
							<button
								key={stage.key}
								type="button"
								className={`${styles.stageItem} ${isActive ? styles.stageItemActive : ""}`}
								onClick={() => {
									onLegendOnlyChange(legendOnly === stage.key ? null : stage.key)
								}}
							>
								<span className={styles.stageDot} />
								<span>{STAGE_SHORT_LABELS[stage.key] || stage.name}</span>
							</button>
						)
					})}
				</div>

				<div className={styles.chartArea} ref={chartAreaRef}>
					{tooltipRow ? (
						<aside className={styles.tooltip} style={tooltipPosition}>
							<p className={styles.tooltipYear}>{tooltipRow.year} год</p>
							{stages.map((stage) => (
								<div
									key={stage.key}
									className={`${styles.tooltipRow} ${
										legendOnly === stage.key ? styles.tooltipRowActive : ""
									}`}
								>
									<span>{stage.name}:</span>
									<span>{formatValue(Number(tooltipRow[stage.key]) || 0)}</span>
								</div>
							))}
						</aside>
					) : null}

					<div className={styles.chartWrap}>
						<p className={styles.axisTitle}>
							<span>Объем затрат,</span>
							<span>млрд руб</span>
						</p>
						<ResponsiveContainer width="100%" height={400}>
							<AreaChart
								data={rows}
								margin={{ top: 10, right: 12, bottom: 20, left: 4 }}
								onMouseMove={(state) => {
									if (typeof state?.activeTooltipIndex === "number") {
										setTooltipIndex(state.activeTooltipIndex)
									}
									if (typeof state?.activeCoordinate?.x === "number") {
										setActiveChartX(state.activeCoordinate.x)
									}
								}}
							>
								<defs>
									{stages.map((stage) => (
										<linearGradient
											key={stage.key}
											id={`nd-lifecycle-grad-${stage.key}`}
											x1="0"
											y1="0"
											x2="0"
											y2="1"
										>
											<stop offset="0%" stopColor={stage.color} stopOpacity={0.44} />
											<stop offset="100%" stopColor={stage.color} stopOpacity={0.08} />
										</linearGradient>
									))}
									<filter id="nd-selected-stage-glow" x="-50%" y="-50%" width="200%" height="200%">
										<feGaussianBlur stdDeviation="2.2" result="blur" />
										<feMerge>
											<feMergeNode in="blur" />
											<feMergeNode in="SourceGraphic" />
										</feMerge>
									</filter>
								</defs>
								<CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="4 8" />
								<XAxis
									dataKey="year"
									tick={{ fill: "rgba(255,255,255,0.9)", fontSize: 12 }}
									axisLine={{ stroke: "#4e9bcd", strokeWidth: 1.2 }}
									tickLine={false}
									minTickGap={20}
									dy={10}
								/>
								<YAxis
									domain={[0, yMax]}
									ticks={yTicks}
									tick={{ fill: "rgba(255,255,255,0.92)", fontSize: 12 }}
									tickFormatter={(value) => {
										const idx = yTicks.findIndex((tick) => tick === value)
										return idx >= 0 ? String(VISUAL_Y_LABELS[idx]) : ""
									}}
									axisLine={{ stroke: "rgba(255,255,255,0.92)", strokeWidth: 1 }}
									tickLine={false}
									width={56}
								/>
								<Tooltip content={() => null} />
								<ReferenceLine y={0} stroke="#4e9bcd" strokeWidth={1.4} />
								{futureSegmentEndYear ? (
									<ReferenceLine
										segment={[
											{ x: String(CURRENT_YEAR), y: 0 },
											{ x: futureSegmentEndYear, y: 0 },
										]}
										stroke="rgba(230, 89, 7, 1)"
										strokeWidth={2}
									/>
								) : null}
								<ReferenceLine
									x={String(CURRENT_YEAR)}
									stroke="rgba(0, 112, 186, 1)"
									strokeWidth={2}
									strokeDasharray="2 2"
								/>
								{(viewMode === "sum" && legendOnly == null ? stages : model.visibleStages).map((stage) => (
									<Area
										key={stage.key}
										type="monotone"
										dataKey={stage.key}
										stackId={viewMode === "sum" && legendOnly == null ? "stack" : undefined}
										stroke={stage.color}
										strokeWidth={1.2}
										fill={`url(#nd-lifecycle-grad-${stage.key})`}
										isAnimationActive={false}
									/>
								))}
								<Line
									type="monotone"
									dataKey="__total"
									stroke="#e66b21"
									strokeWidth={3}
									dot={false}
									isAnimationActive={false}
								/>
								{/* main semantics: legendOnly filters visibleStages; no extra emphasis line */}
							</AreaChart>
						</ResponsiveContainer>
					</div>

					<div className={styles.legendRow}>
						<span className={styles.legendItem}>
							История до {CURRENT_YEAR}
							<i className={styles.legendLineBlue} />
						</span>
						<span className={styles.legendItem}>
							Прогноз
							<i className={styles.legendLineOrange} />
						</span>
						<span className={styles.legendItem}>
							Прогноз
							<i className={styles.legendDashed} />
						</span>
					</div>
				</div>

				<span className={styles.cornerIndicator} aria-hidden />
			</section>
		</div>
	)
}
