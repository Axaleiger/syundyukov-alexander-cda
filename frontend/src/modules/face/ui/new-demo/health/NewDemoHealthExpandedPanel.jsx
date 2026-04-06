import { NewDemoHealthRadar } from "./NewDemoHealthRadar"
import { NewDemoHealthMetricList } from "./NewDemoHealthMetricList"
import styles from "./NewDemoHealth.module.css"

export function NewDemoHealthExpandedPanel({
	leftData,
	rightData,
	leftMetrics,
	rightMetrics,
	onClose,
}) {
	return (
		<div className={styles.expandedRoot}>
			<section className={styles.expandedPanel} aria-label="Карта здоровья ЦД">
				<button
					type="button"
					className={styles.closeButton}
					onClick={onClose}
					aria-label="Закрыть панель карты здоровья"
				>
					×
				</button>
				<h2 className={styles.expandedTitle}>Карта здоровья ЦД</h2>
				<div className={styles.expandedRadars}>
					<div className={styles.expandedRadarBlock}>
						<h3 className={styles.expandedBlockTitle}>1. ЦД производственных этапов</h3>
						<NewDemoHealthRadar data={leftData} />
					</div>
					<div className={styles.expandedRadarBlock}>
						<h3 className={styles.expandedBlockTitle}>2. ЦД объектов</h3>
						<NewDemoHealthRadar data={rightData} />
					</div>
				</div>
				<div className={styles.expandedMetrics}>
					<NewDemoHealthMetricList rows={leftMetrics} />
					<NewDemoHealthMetricList rows={rightMetrics} />
				</div>
			</section>
		</div>
	)
}
