import styles from "./NewDemoHealth.module.css"

export function NewDemoHealthMetricList({ rows }) {
	return (
		<div className={styles.metricsList}>
			{rows.map((row) => (
				<div key={row.name} className={styles.metricRow}>
					<div className={styles.metricRowHead}>
						<span className={styles.metricLabel}>{row.name}</span>
						<span className={styles.metricValue}>{row.value}%</span>
					</div>
					<div className={styles.metricTrack} aria-hidden>
						<span className={styles.metricFill} style={{ width: `${row.value}%` }} />
					</div>
				</div>
			))}
		</div>
	)
}
