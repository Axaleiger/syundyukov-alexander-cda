import { NewDemoWindRoseRadar } from "./NewDemoWindRoseRadar"
import styles from "./NewDemoHealth.module.css"

export function NewDemoHealthCard({
	data,
	selectedIndex,
	onSegmentClick,
	isActive,
	isCompact,
	onToggle,
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
			aria-label={isActive ? "Свернуть карту здоровья ЦД" : "Открыть карту здоровья ЦД"}
		>
			<div className={styles.healthCardHeader}>
				<p className={styles.healthCardTitle}>Карта здоровья ЦД</p>
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
						/>
					)}
				</div>
			</div>
			<span className={styles.healthCardTriangle} aria-hidden />
		</div>
	)
}
