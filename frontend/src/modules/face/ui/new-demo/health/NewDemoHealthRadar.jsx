import styles from "./NewDemoHealth.module.css"

function polarPoint(cx, cy, radius, angleRad) {
	return {
		x: cx + radius * Math.cos(angleRad),
		y: cy + radius * Math.sin(angleRad),
	}
}

export function NewDemoHealthRadar({ data, size = "large" }) {
	const isSmall = size === "small"
	const points = data.slice(0, isSmall ? 6 : 8)
	const box = isSmall ? 124 : 210
	const center = box / 2
	const radius = isSmall ? 44 : 74
	const rings = 4

	const radarPoints = points
		.map((item, index) => {
			const angle = (-Math.PI / 2) + (index * Math.PI * 2) / points.length
			const r = (radius * Math.max(0, Math.min(100, item.value || 0))) / 100
			const p = polarPoint(center, center, r, angle)
			return `${p.x},${p.y}`
		})
		.join(" ")

	const axisLines = points.map((_, index) => {
		const angle = (-Math.PI / 2) + (index * Math.PI * 2) / points.length
		const p = polarPoint(center, center, radius, angle)
		return (
			<line
				key={`axis-${index}`}
				x1={center}
				y1={center}
				x2={p.x}
				y2={p.y}
				className={styles.radarAxis}
			/>
		)
	})

	const ringPolygons = Array.from({ length: rings }, (_, ringIndex) => {
		const ringRadius = (radius * (ringIndex + 1)) / rings
		const ringPoints = points
			.map((_, index) => {
				const angle = (-Math.PI / 2) + (index * Math.PI * 2) / points.length
				const p = polarPoint(center, center, ringRadius, angle)
				return `${p.x},${p.y}`
			})
			.join(" ")

		return <polygon key={`ring-${ringIndex}`} points={ringPoints} className={styles.radarRing} />
	})

	return (
		<div className={`${styles.radarWrap} ${isSmall ? styles.radarWrapSmall : styles.radarWrapLarge}`}>
			<svg
				viewBox={`0 0 ${box} ${box}`}
				role="img"
				aria-label="Радар карты здоровья"
				className={styles.radarSvg}
			>
				{ringPolygons}
				{axisLines}
				<polygon points={radarPoints} className={styles.radarArea} />
				<circle cx={center} cy={center} r="2.8" className={styles.radarCore} />
			</svg>
		</div>
	)
}
