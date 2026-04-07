import { NewDemoLifecyclePreviewChart } from "./NewDemoLifecyclePreviewChart"
import styles from "./NewDemoLifecycleCard.module.css"

export function NewDemoLifecycleCard({ isActive, isCompact, onToggle }) {
	return (
		<button
			type="button"
			className={`${styles.lifecycleCard} ${isActive ? styles.lifecycleCardActive : ""} ${
				isCompact ? styles.lifecycleCardCompact : ""
			}`}
			onClick={onToggle}
			aria-expanded={isActive}
			aria-label={isActive ? "Свернуть блок ЖЦ Актива" : "Открыть блок ЖЦ Актива"}
		>
			<div className={styles.lifecycleCardHeader}>
				<p className={styles.lifecycleCardTitle}>ЖЦ Актива</p>
			</div>
			<div className={styles.lifecycleCardBody}>
				{isCompact ? null : <NewDemoLifecyclePreviewChart />}
			</div>
			<span className={styles.lifecycleCardTriangle} aria-hidden />
		</button>
	)
}
