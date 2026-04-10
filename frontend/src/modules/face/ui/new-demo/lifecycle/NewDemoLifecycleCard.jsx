import { NewDemoLifecyclePreviewChart } from "./NewDemoLifecyclePreviewChart"
import styles from "./NewDemoLifecycleCard.module.css"

export function NewDemoLifecycleCard({
	isActive,
	isCompact,
	onToggle,
	viewMode,
	faceSeed,
}) {
	return (
		<button
			type="button"
			className={`${styles.lifecycleCard} ${isActive ? styles.lifecycleCardActive : ""} ${
				isCompact ? styles.lifecycleCardCompact : ""
			}`}
			onClick={onToggle}
			aria-expanded={isActive}
			aria-label={
				isActive
					? "Свернуть блок жизненного цикла актива"
					: "Открыть блок жизненного цикла актива"
			}
		>
			<div className={styles.lifecycleCardHeader}>
				<p className={styles.lifecycleCardTitle}>Жизненный цикл актива</p>
			</div>
			<div className={styles.lifecycleCardBody}>
				{isCompact ? null : (
					<NewDemoLifecyclePreviewChart
						viewMode={viewMode}
						faceSeed={faceSeed}
					/>
				)}
			</div>
			<span className={styles.lifecycleCardTriangle} aria-hidden />
		</button>
	)
}
