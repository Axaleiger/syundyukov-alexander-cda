import { NewDemoWindRoseRadar } from "./NewDemoWindRoseRadar"
import { getNewDemoHealthStageRoseLabel } from "./newDemoHealthStageLabels"
import styles from "./NewDemoHealth.module.css"

export function NewDemoHealthCard({
	data,
	selectedIndex,
	onSegmentClick,
	isActive,
	isCompact,
	onToggle,
	targetLevelPercent = 100,
}) {
	const handleKeyDown = (event) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault()
			onToggle()
		}
	}

	return (
		<div
			role="button"
			tabIndex={0}
			className={`${styles.healthCard} ${isActive ? styles.healthCardActive : ""} ${
				isCompact ? styles.healthCardCompact : ""
			}`}
			onClick={onToggle}
			onKeyDown={handleKeyDown}
			aria-expanded={isActive}
			aria-label={isActive ? "Свернуть цифровую зрелость ЦД" : "Открыть цифровую зрелость ЦД"}
		>
			<div className={styles.healthCardHeader}>
				<p className={styles.healthCardTitle}>Зрелость цифровых двойников</p>
			</div>
			<div className={styles.healthCardBody}>
				<div className={styles.healthCardRosePreview}>
					{isCompact ? null : (
						<NewDemoWindRoseRadar
							data={data}
							selectedIndex={selectedIndex}
							onSegmentClick={onSegmentClick}
							size="small"
							showLabels
							variant="collapsedCard"
							getItemLabel={(item) => getNewDemoHealthStageRoseLabel(item.name)}
							targetLevelPercent={targetLevelPercent}
						/>
					)}
				</div>
			</div>
			<span className={styles.healthCardTriangle} aria-hidden />
		</div>
	)
}
