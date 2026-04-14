import { NewDemoWindRoseMetricList } from "./NewDemoWindRoseMetricList"
import { NewDemoExpandedLeftWindRoseRadar } from "./NewDemoExpandedLeftWindRoseRadar"
import { NewDemoExpandedRightWindRoseRadar } from "./NewDemoExpandedRightWindRoseRadar"
import {
	getNewDemoHealthStageLabel,
	getNewDemoHealthStageRoseLabel,
} from "./newDemoHealthStageLabels"
import styles from "./NewDemoHealth.module.css"

export function NewDemoHealthExpandedPanel({
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
			<section className={styles.expandedPanel} aria-label="Зрелость цифровых двойников">
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
					<p className={styles.expandedTitle}>Зрелость цифровых двойников</p>
				</header>
				<div className={styles.expandedWindRoseContainer}>
					<section className={styles.expandedWindRoseItem}>
						<h3 className={styles.expandedBlockTitle}>
							1. Цифровые двойники
						</h3>
						<div className={styles.expandedChartBox}>
							<NewDemoExpandedLeftWindRoseRadar
								data={leftData}
								selectedIndex={selectedLeftStageIndex}
								onSegmentClick={onLeftSegmentClick}
								getItemLabel={(item) => getNewDemoHealthStageRoseLabel(item.name)}
							/>
						</div>
						<div className={styles.expandedWindRoseContent}>
							<NewDemoWindRoseMetricList
								data={leftData}
								selectedIndex={selectedLeftStageIndex}
								onSegmentClick={onLeftSegmentClick}
								getItemLabel={(item) => getNewDemoHealthStageLabel(item.name)}
							/>
						</div>
					</section>
					<section className={styles.expandedWindRoseItem}>
						<h3 className={styles.expandedBlockTitle}>2. Цифровые двойники объектов</h3>
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
