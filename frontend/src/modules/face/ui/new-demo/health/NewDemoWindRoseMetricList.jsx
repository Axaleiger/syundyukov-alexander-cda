import styles from "./NewDemoHealth.module.css"

export function NewDemoWindRoseMetricList({ data, selectedIndex, onSegmentClick }) {
	return (
		<div className={styles.ndMetricList}>
			{data.map((item, index) => {
				const value = Math.round(item.value || 0)
				const isSelected = selectedIndex === index
				return (
					<button
						key={`${item.name}-${index}`}
						type="button"
						className={`${styles.ndMetricRow} ${isSelected ? styles.ndMetricRowSelected : ""}`}
						onClick={() => onSegmentClick(index)}
						aria-pressed={isSelected}
						aria-label={`${item.name}, ${value}%`}
					>
						<span className={styles.ndMetricName}>{item.name}</span>
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
