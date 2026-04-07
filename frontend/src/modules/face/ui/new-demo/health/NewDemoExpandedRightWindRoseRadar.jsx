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

function rotateToStart(items, startIndex) {
	if (!items.length) return { rotated: items, startIndex: 0 }
	const i = ((startIndex % items.length) + items.length) % items.length
	if (i === 0) return { rotated: items, startIndex: 0 }
	return { rotated: [...items.slice(i), ...items.slice(0, i)], startIndex: i }
}

export function NewDemoExpandedRightWindRoseRadar({ data, selectedIndex, onSegmentClick }) {
	const rawItems = data || []
	const topSemanticIndex = Math.max(
		0,
		rawItems.findIndex((x) => (x?.name || "").toLowerCase().includes("добыч")),
	)
	const { rotated: items, startIndex: rotation } = rotateToStart(rawItems, topSemanticIndex)
	const numItems = items.length
	const angleStep = numItems > 0 ? (2 * Math.PI) / numItems : 0
	const box = 200
	const center = box / 2
	const radius = 75
	const startAngle = -Math.PI / 2
	const ringCount = 3

	const displayedSelectedIndex =
		selectedIndex != null && numItems > 0
			? (((selectedIndex - rotation) % numItems) + numItems) % numItems
			: 0

	const mapDisplayedIndexToRaw = (displayedIndex) => {
		if (!numItems) return 0
		return (displayedIndex + rotation) % numItems
	}

	const segments = items.map((item, index) => {
		const spokeAngle = startAngle + index * angleStep
		const segmentStart = spokeAngle - angleStep / 2
		const segmentEnd = spokeAngle + angleStep / 2
		const axisPoint = point(center, center, radius, spokeAngle)
		const valueRadius = (radius * Math.max(0, Math.min(100, item.value || 0))) / 100
		const valuePoint = point(center, center, valueRadius, spokeAngle)
		return { item, index, spokeAngle, segmentStart, segmentEnd, axisPoint, valuePoint }
	})

	const rosePoints = segments.map((segment) => `${segment.valuePoint.x},${segment.valuePoint.y}`).join(" ")
	const ringPolygons = Array.from({ length: ringCount }, (_, ringIndex) => {
		const ringRadius = (radius * (ringIndex + 1)) / ringCount
		return segments
			.map((segment) => {
				const p = point(center, center, ringRadius, segment.spokeAngle)
				return `${p.x},${p.y}`
			})
			.join(" ")
	})

	return (
		<div className={styles.expandedRightRadar} role="group" aria-label="Диаграмма объектов">
			<svg viewBox={`0 0 ${box} ${box}`} className={styles.expandedChartSvg} aria-hidden>
				{ringPolygons.map((points, idx) => (
					<polygon key={`ring-${idx}`} points={points} className={styles.expandedRightRing} />
				))}
				{segments.map((segment, idx) => (
					<line
						key={`axis-${idx}`}
						x1={center}
						y1={center}
						x2={segment.axisPoint.x}
						y2={segment.axisPoint.y}
						className={styles.expandedRightAxis}
					/>
				))}
				<polygon points={rosePoints} className={styles.expandedRightContour} />
				{segments.map((segment, idx) => (
					<path
						key={`hit-${idx}`}
						d={arcPath(center, center, radius, segment.segmentStart, segment.segmentEnd)}
						className={`${styles.expandedRadarHitArea} ${
							idx === displayedSelectedIndex ? styles.expandedRadarHitAreaSelected : ""
						}`}
						onClick={() => onSegmentClick(mapDisplayedIndexToRaw(idx))}
					/>
				))}
			</svg>
			<div className={styles.expandedRightLabels}>
				{segments.map((segment, idx) => {
					const p = point(50, 50, 46, segment.spokeAngle)
					const isSelected = idx === displayedSelectedIndex
					return (
						<div
							key={`${segment.item.name}-${idx}`}
							className={`${styles.expandedRightLabel} ${
								isSelected ? styles.expandedRightLabelSelected : ""
							}`}
							style={{ left: `${p.x}%`, top: `${p.y}%` }}
						>
							{segment.item.name} {Math.round(segment.item.value || 0)}%
						</div>
					)
				})}
			</div>
		</div>
	)
}
