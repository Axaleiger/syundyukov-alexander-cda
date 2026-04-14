import styles from "./NewDemoHealth.module.css"

function point(cx, cy, radius, angle) {
	return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
}

export function NewDemoWindRoseRadar({
	data,
	selectedIndex,
	onSegmentClick,
	size = "large",
	showLabels = true,
	variant = "default",
	getItemLabel = (item) => item.name,
}) {
	const isSmall = size === "small"
	// Семантика как в main: порядок сегментов и индексы строго из `data` без ротаций.
	const items = data

	const numItems = items.length
	const angleStep = numItems > 0 ? (2 * Math.PI) / numItems : 0
	const box = isSmall ? 224 : 244
	const center = box / 2
	const radius = isSmall ? 74 : 82
	const ringCount = 4

	// Единый стартовый угол: первая спица строго вверх.
	const startAngle = -Math.PI / 2

	const displayedSelectedIndex =
		selectedIndex != null && numItems > 0 ? ((selectedIndex % numItems) + numItems) % numItems : null

	const segments = items.map((item, index) => {
		const spokeAngle = startAngle + index * angleStep
		const valueRadius = (radius * Math.max(0, Math.min(100, item.value || 0))) / 100

		const axisPoint = point(center, center, radius, spokeAngle)
		const vertexPoint = point(center, center, valueRadius, spokeAngle)

		return {
			item,
			index,
			spokeAngle,
			valueRadius,
			axisPoint,
			vertexPoint,
		}
	})

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

	const rosePoints = items
		.map((_, index) => {
			const p = segments[index].vertexPoint
			return `${p.x},${p.y}`
		})
		.join(" ")

	return (
		<div
			className={`${styles.ndRadar} ${isSmall ? styles.ndRadarSmall : styles.ndRadarLarge}`}
			data-size={size}
			data-variant={variant}
			role="group"
		>
			<svg viewBox={`0 0 ${box} ${box}`} className={styles.ndRadarSvg} aria-hidden>
				{ringPolygons.map((points, idx) => (
					<polygon key={`ring-${idx}`} points={points} className={styles.ndRadarRing} />
				))}
				{items.map((_, idx) => {
					const p = segments[idx].axisPoint
					return (
						<line
							key={`axis-${idx}`}
							x1={center}
							y1={center}
							x2={p.x}
							y2={p.y}
							className={styles.ndRadarAxis}
						/>
					)
				})}
				{activeSegment ? (
					<line
						x1={center}
						y1={center}
						x2={activeSegment.vertexPoint.x}
						y2={activeSegment.vertexPoint.y}
						className={`${styles.ndRadarRay} ${isSmall ? styles.ndRadarRaySmall : ""}`}
					/>
				) : null}
				<polygon points={rosePoints} className={styles.ndRadarArea} />
				<circle cx={center} cy={center} r="3" className={styles.ndRadarCore} />
			</svg>

			{showLabels ? (
				<div className={styles.ndRadarLabels}>
					{items.map((item, idx) => {
						const p = point(50, 50, isSmall ? 42 : 43, segments[idx].spokeAngle)
						const isSelected = displayedSelectedIndex === idx
						const label = getItemLabel(item)
						return (
							<button
								key={`${item.name}-${idx}`}
								type="button"
								className={`${styles.ndLabel} ${isSelected ? styles.ndLabelSelected : ""}`}
								style={{ left: `${p.x}%`, top: `${p.y}%` }}
								onClick={() => onSegmentClick(idx)}
								aria-label={`${label}, ${item.value}%`}
							>
								<span className={styles.ndLabelName}>{label}</span>
								<span className={styles.ndLabelValue}>{Math.round(item.value || 0)}%</span>
							</button>
						)
					})}
				</div>
			) : null}
		</div>
	)
}
