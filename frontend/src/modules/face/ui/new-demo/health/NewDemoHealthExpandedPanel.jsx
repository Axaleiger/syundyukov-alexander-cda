import { NewDemoWindRoseMetricList } from "./NewDemoWindRoseMetricList"
import { NewDemoExpandedLeftWindRoseRadar } from "./NewDemoExpandedLeftWindRoseRadar"
import { NewDemoExpandedRightWindRoseRadar } from "./NewDemoExpandedRightWindRoseRadar"
import { NewDemoHealthMetricToggle } from "./NewDemoHealthMetricToggle"
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
	metricLeft = "coverage",
	metricRight = "coverage",
	onMetricLeftChange,
	onMetricRightChange,
}) {
	const targetLeft = metricLeft === "coverage" ? 100 : 40
	const targetRight = metricRight === "coverage" ? 100 : 40

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
						<div className={styles.expandedRoseHeaderRow}>
							<h3 className={styles.expandedBlockTitle}>
								1. Цифровые двойники программ
							</h3>
							<NewDemoHealthMetricToggle
								value={metricLeft}
								onChange={onMetricLeftChange}
								ariaLabel="Метрика розы программ"
							/>
						</div>
						<div className={styles.expandedChartBox}>
							<NewDemoExpandedLeftWindRoseRadar
								data={leftData}
								selectedIndex={selectedLeftStageIndex}
								onSegmentClick={onLeftSegmentClick}
								getItemLabel={(item) => getNewDemoHealthStageRoseLabel(item.name)}
								targetLevelPercent={targetLeft}
							/>
						</div>
						<div className={styles.roseLegendRow} aria-hidden>
							<span className={styles.roseLegendItem}>
								Текущий уровень
								<i className={styles.roseLegendLineOrange} />
							</span>
							<span className={styles.roseLegendItem}>
								Целевой уровень
								<i className={styles.roseLegendLineGreen} />
							</span>
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
						<div className={styles.expandedRoseHeaderRow}>
							<h3 className={styles.expandedBlockTitle}>2. Цифровые двойники объектов</h3>
							<NewDemoHealthMetricToggle
								value={metricRight}
								onChange={onMetricRightChange}
								ariaLabel="Метрика розы объектов"
							/>
						</div>
						<div className={styles.expandedChartBox}>
							<NewDemoExpandedRightWindRoseRadar
								data={rightData}
								selectedIndex={selectedRightObjectIndex}
								onSegmentClick={onRightSegmentClick}
								targetLevelPercent={targetRight}
							/>
						</div>
						<div className={styles.roseLegendRow} aria-hidden>
							<span className={styles.roseLegendItem}>
								Текущий уровень
								<i className={styles.roseLegendLineOrange} />
							</span>
							<span className={styles.roseLegendItem}>
								Целевой уровень
								<i className={styles.roseLegendLineGreen} />
							</span>
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
