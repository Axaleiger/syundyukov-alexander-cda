import styles from "./NewDemoHealth.module.css"

function point(cx, cy, radius, angle) {
	return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
}

function arcPath(cx, cy, radius, start, end) {
	const startPoint = point(cx, cy, radius, start)
	const endPoint = point(cx, cy, radius, end)
	const delta = end - start
	const largeArcFlag = delta > Math.PI ? 1 : 0
	return [
		`M ${cx} ${cy}`,
		`L ${startPoint.x} ${startPoint.y}`,
		`A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endPoint.x} ${endPoint.y}`,
		"Z",
	].join(" ")
}

export function NewDemoExpandedLeftWindRoseRadar({
	data,
	selectedIndex,
	onSegmentClick,
	getItemLabel = (item) => item.name,
}) {
	const items = data || []
	const numItems = items.length
	const angleStep = numItems > 0 ? (2 * Math.PI) / numItems : 0
	const box = 200
	const center = box / 2
	const radius = 75
	const startAngle = -Math.PI / 2
	const ringCount = 3

	const displayedSelectedIndex =
		selectedIndex != null && numItems > 0 ? ((selectedIndex % numItems) + numItems) % numItems : null

	const segments = items.map((item, index) => {
		const spokeAngle = startAngle + index * angleStep
		const segmentStart = spokeAngle - angleStep / 2
		const segmentEnd = spokeAngle + angleStep / 2
		const axisPoint = point(center, center, radius, spokeAngle)
		const valueRadius = (radius * Math.max(0, Math.min(100, item.value || 0))) / 100
		const valuePoint = point(center, center, valueRadius, spokeAngle)
		return { item, index, spokeAngle, segmentStart, segmentEnd, axisPoint, valuePoint }
	})

	const activeSegment =
		displayedSelectedIndex != null && segments[displayedSelectedIndex]
			? segments[displayedSelectedIndex]
			: null

	const ringPolygons = Array.from({ length: ringCount }, (_, ringIndex) => {
		const ringRadius = (radius * (ringIndex + 1)) / ringCount
		return segments
			.map((segment) => {
				const p = point(center, center, ringRadius, segment.spokeAngle)
				return `${p.x},${p.y}`
			})
			.join(" ")
	})

	const contourPoints = segments.map((segment) => `${segment.valuePoint.x},${segment.valuePoint.y}`).join(" ")

	return (
		<div className={styles.expandedLeftRadar} role="group" aria-label="Диаграмма производственных этапов">
			<svg viewBox={`0 0 ${box} ${box}`} className={styles.expandedChartSvg} aria-hidden>
				{ringPolygons.map((points, idx) => (
					<polygon key={`ring-${idx}`} points={points} className={styles.expandedLeftRing} />
				))}
				{segments.map((segment, idx) => (
					<line
						key={`axis-${idx}`}
						x1={center}
						y1={center}
						x2={segment.axisPoint.x}
						y2={segment.axisPoint.y}
						className={styles.expandedLeftAxis}
					/>
				))}
				<polygon
					points={contourPoints}
					className={`${styles.expandedLeftContour} ${
						displayedSelectedIndex != null ? styles.expandedContourSelected : ""
					}`}
				/>
				{activeSegment ? (
					<>
						<line
							x1={center}
							y1={center}
							x2={activeSegment.valuePoint.x}
							y2={activeSegment.valuePoint.y}
							className={styles.expandedLeftActiveRay}
						/>
						<circle
							cx={activeSegment.valuePoint.x}
							cy={activeSegment.valuePoint.y}
							r="3"
							className={styles.expandedLeftActiveDot}
						/>
					</>
				) : null}
				{segments.map((segment, idx) => (
					<path
						key={`hit-${idx}`}
						d={arcPath(center, center, radius, segment.segmentStart, segment.segmentEnd)}
						className={styles.expandedRadarHitArea}
						onClick={() => onSegmentClick(idx)}
					/>
				))}
			</svg>
			<div className={styles.expandedLeftLabels}>
				{segments.map((segment, idx) => {
					const p = point(50, 50, 49, segment.spokeAngle)
					const isSelected = displayedSelectedIndex != null && idx === displayedSelectedIndex
					const label = getItemLabel(segment.item)
					return (
						<div
							key={`${segment.item.name}-${idx}`}
							className={`${styles.expandedLeftLabel} ${
								isSelected ? styles.expandedLeftLabelSelected : ""
							}`}
							style={{ left: `${p.x}%`, top: `${p.y}%` }}
						>
							<span className={styles.expandedLeftLabelName}>{label}</span>
							<span className={styles.expandedLeftLabelValue}>
								{Math.round(segment.item.value || 0)}%
							</span>
						</div>
					)
				})}
			</div>
		</div>
	)
}
