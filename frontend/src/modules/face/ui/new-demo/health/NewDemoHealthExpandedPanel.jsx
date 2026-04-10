import { NewDemoWindRoseMetricList } from "./NewDemoWindRoseMetricList"
import { NewDemoExpandedLeftWindRoseRadar } from "./NewDemoExpandedLeftWindRoseRadar"
import { NewDemoExpandedRightWindRoseRadar } from "./NewDemoExpandedRightWindRoseRadar"
import styles from "./NewDemoHealth.module.css"

export function NewDemoHealthExpandedPanel({
	PRODUCTION_STAGES,
	leftData,
	rightData,
	selectedLeftStageIndex,
	selectedRightObjectIndex,
	onLeftSegmentClick,
	onRightSegmentClick,
	onClose,
}) {
	return (
		<div className={styles.expandedRoot}>
			<section className={styles.expandedPanel} aria-label="Цифровая зрелость ЦД">
				<div className={styles.expandedPanelGlow} aria-hidden />
				<button
					type="button"
					className={styles.closeButton}
					onClick={onClose}
					aria-label="Закрыть панель цифровой зрелости"
				>
					×
				</button>
				<header className={styles.expandedHeader}>
					<p className={styles.expandedTitle}>Цифровая зрелость ЦД</p>
				</header>
				<div className={styles.expandedWindRoseContainer}>
					<section className={styles.expandedWindRoseItem}>
						<h3 className={styles.expandedBlockTitle}>1. ЦД производственных этапов</h3>
						<div className={styles.expandedChartBox}>
							<NewDemoExpandedLeftWindRoseRadar
								data={leftData}
								selectedIndex={selectedLeftStageIndex}
								onSegmentClick={onLeftSegmentClick}
							/>
						</div>
						<div className={styles.expandedWindRoseContent}>
							<NewDemoWindRoseMetricList
								data={leftData}
								selectedIndex={selectedLeftStageIndex}
								onSegmentClick={onLeftSegmentClick}
							/>
						</div>
					</section>
					<section className={styles.expandedWindRoseItem}>
						<h3 className={styles.expandedBlockTitle}>2. ЦД объектов</h3>
						<div className={styles.expandedChartBox}>
							<NewDemoExpandedRightWindRoseRadar
								data={rightData}
								selectedIndex={selectedRightObjectIndex}
								onSegmentClick={onRightSegmentClick}
							/>
						</div>
						<div className={styles.expandedWindRoseContent}>
							<NewDemoWindRoseMetricList
								data={rightData}
								selectedIndex={selectedRightObjectIndex}
								onSegmentClick={onRightSegmentClick}
							/>
						</div>
					</section>
				</div>
				<span
					className={`${styles.expandedPanelTriangle}`}
					aria-hidden
				/>
			</section>
		</div>
	)
}
