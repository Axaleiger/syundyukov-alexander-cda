import styles from "./NewDemoHealth.module.css"

export function NewDemoWindRoseMetricList({
	data,
	selectedIndex,
	onSegmentClick,
	getItemLabel = (item) => item.name,
}) {
	return (
		<div className={styles.ndMetricList}>
			{data.map((item, index) => {
				const value = Math.round(item.value || 0)
				const isSelected = selectedIndex === index
				const label = getItemLabel(item)
				return (
					<button
						key={`${item.name}-${index}`}
						type="button"
						className={`${styles.ndMetricRow} ${isSelected ? styles.ndMetricRowSelected : ""}`}
						onClick={() => onSegmentClick(index)}
						aria-pressed={isSelected}
						aria-label={`${label}, ${value}%`}
					>
						<span className={styles.ndMetricName}>{label}</span>
						<span className={styles.ndMetricValue}>{value}%</span>
						<span className={styles.ndMetricTrack} aria-hidden>
							<span className={styles.ndMetricFill} style={{ width: `${value}%` }} />
						</span>
					</button>
				)
			})}
		</div>
	)
}
