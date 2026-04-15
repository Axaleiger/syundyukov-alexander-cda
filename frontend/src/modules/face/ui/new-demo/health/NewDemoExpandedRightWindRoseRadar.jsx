import styles from "./NewDemoHealth.module.css"

function point(cx, cy, radius, angle) {
	return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
}

function labelPositionClamped(cx, cy, r, angle, margin = 7) {
	const x = cx + r * Math.cos(angle)
	const y = cy + r * Math.sin(angle)
	return {
		x: Math.min(100 - margin, Math.max(margin, x)),
		y: Math.min(100 - margin, Math.max(margin, y)),
	}
}

/** «ЦД энергетики» → три строки: ЦД / энергетики / % (без разрыва слов). */
function splitCdObjectLabel(name) {
	const s = String(name || "").trim()
	const m = s.match(/^ЦД\s+(.+)$/)
	if (m) return { head: "ЦД", body: m[1].trim() }
	return { head: s, body: null }
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

export function NewDemoExpandedRightWindRoseRadar({ data, selectedIndex, onSegmentClick }) {
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

	const activeSegment =
		displayedSelectedIndex != null && segments[displayedSelectedIndex]
			? segments[displayedSelectedIndex]
			: null

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
				<polygon
					points={rosePoints}
					className={`${styles.expandedRightContour} ${
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
							className={styles.expandedRightActiveRay}
						/>
						<circle
							cx={activeSegment.valuePoint.x}
							cy={activeSegment.valuePoint.y}
							r="3"
							className={styles.expandedRightActiveDot}
						/>
					</>
				) : null}
				{segments.map((segment, idx) => (
					<path
						key={`hit-${idx}`}
						d={arcPath(center, center, radius, segment.segmentStart, segment.segmentEnd)}
						className={`${styles.expandedRadarHitArea} ${
							displayedSelectedIndex != null && idx === displayedSelectedIndex
								? styles.expandedRadarHitAreaSelected
								: ""
						}`}
						onClick={() => onSegmentClick(idx)}
					/>
				))}
			</svg>
			<div className={styles.expandedRightLabels}>
				{segments.map((segment, idx) => {
					/* Чуть дальше от контура; clamp только от края блока. Две строки: имя / % — без разрыва слов. */
					const p = labelPositionClamped(50, 50, 58, segment.spokeAngle)
					const isSelected = displayedSelectedIndex != null && idx === displayedSelectedIndex
					const { head, body } = splitCdObjectLabel(segment.item.name)
					const pct = `${Math.round(segment.item.value || 0)}%`
					return (
						<div
							key={`${segment.item.name}-${idx}`}
							className={`${styles.expandedRightLabel} ${
								isSelected ? styles.expandedRightLabelSelected : ""
							}`}
							style={{ left: `${p.x}%`, top: `${p.y}%` }}
						>
							{body != null ? (
								<>
									<span className={styles.expandedRightLabelCd}>{head}</span>
									<span className={styles.expandedRightLabelBody}>{body}</span>
									<span className={styles.expandedRightLabelValue}>{pct}</span>
								</>
							) : (
								<>
									<span className={styles.expandedRightLabelName}>{head}</span>
									<span className={styles.expandedRightLabelValue}>{pct}</span>
								</>
							)}
						</div>
					)
				})}
			</div>
		</div>
	)
}
