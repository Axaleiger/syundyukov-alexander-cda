import styles from "./NewDemoLifecycleCard.module.css"

function buildSmoothPath(points) {
	if (points.length === 0) return ""
	if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
	if (points.length === 2) {
		return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
	}

	let path = `M ${points[0].x} ${points[0].y}`
	for (let i = 0; i < points.length - 1; i += 1) {
		const p0 = points[i - 1] ?? points[i]
		const p1 = points[i]
		const p2 = points[i + 1]
		const p3 = points[i + 2] ?? p2

		const cp1x = p1.x + (p2.x - p0.x) / 6
		const cp1y = p1.y + (p2.y - p0.y) / 6
		const cp2x = p2.x - (p3.x - p1.x) / 6
		const cp2y = p2.y - (p3.y - p1.y) / 6

		path += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`
	}

	return path
}

const PREVIEW_POINTS = [130, 180, 270, 120, 175, 230]
const Y_TICKS = [0, 60, 120, 180, 240, 300]

export function NewDemoLifecyclePreviewChart() {
	const width = 276
	const height = 196
	const padding = { top: 10, right: 8, bottom: 16, left: 34 }
	const plotWidth = width - padding.left - padding.right
	const plotHeight = height - padding.top - padding.bottom
	const yMax = 300
	const plotBottom = padding.top + plotHeight

	const points = PREVIEW_POINTS.map((value, index) => {
		const xRatio = PREVIEW_POINTS.length > 1 ? index / (PREVIEW_POINTS.length - 1) : 0
		const yRatio = value / yMax
		return {
			key: `${index}-${value}`,
			x: padding.left + (plotWidth * xRatio),
			y: padding.top + (plotHeight * (1 - yRatio)),
		}
	})

	const linePath = buildSmoothPath(points)
	const areaPath = `${linePath} L ${points[points.length - 1].x} ${plotBottom} L ${points[0].x} ${plotBottom} Z`
	const xDivisions = 8
	const xGrid = Array.from({ length: xDivisions + 1 }, (_, idx) => (
		padding.left + (plotWidth * idx) / xDivisions
	))

	return (
		<div className={styles.lifecycleChartRoot}>
			<svg
				viewBox={`0 0 ${width} ${height}`}
				className={styles.lifecycleChartSvg}
				role="img"
				aria-label="График жизненного цикла актива"
			>
				<defs>
					<linearGradient id="new-demo-lifecycle-fill" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor="rgba(59, 130, 246, 0.74)" />
						<stop offset="100%" stopColor="rgba(15, 23, 42, 0)" />
					</linearGradient>
				</defs>

				{Y_TICKS.map((tick) => {
					const yRatio = tick / yMax
					const y = padding.top + plotHeight * (1 - yRatio)
					return (
						<g key={tick}>
							<line
								x1={padding.left}
								y1={y}
								x2={width - padding.right}
								y2={y}
								className={styles.lifecycleGridLine}
							/>
							<text x={8} y={y + 3} className={styles.lifecycleAxisLabel}>
								{tick}
							</text>
						</g>
					)
				})}

				{xGrid.map((x) => (
					<line
						key={x}
						x1={x}
						y1={padding.top}
						x2={x}
						y2={plotBottom}
						className={styles.lifecycleGridLine}
					/>
				))}

				<path d={areaPath} className={styles.lifecycleArea} />

				{points.map((point) => (
					<line
						key={`guide-${point.key}`}
						x1={point.x}
						y1={point.y}
						x2={point.x}
						y2={plotBottom}
						className={styles.lifecycleGuide}
					/>
				))}

				<path d={linePath} className={styles.lifecycleLine} />

				{points.map((point) => (
					<g key={point.key}>
						<circle cx={point.x} cy={point.y} r={4.2} className={styles.lifecyclePointGlow} />
						<circle cx={point.x} cy={point.y} r={2.4} className={styles.lifecyclePointCore} />
					</g>
				))}
			</svg>
		</div>
	)
}
