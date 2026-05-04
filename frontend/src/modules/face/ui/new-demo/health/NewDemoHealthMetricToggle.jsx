import styles from "./NewDemoHealth.module.css"

export function NewDemoHealthMetricToggle({ value, onChange, ariaLabel }) {
	return (
		<div className={styles.healthMetricToggle} role="group" aria-label={ariaLabel}>
			<button
				type="button"
				className={`${styles.healthMetricToggleBtn} ${
					value === "coverage" ? styles.healthMetricToggleBtnActive : ""
				}`}
				onClick={() => onChange("coverage")}
			>
				Охват актива
			</button>
			<button
				type="button"
				className={`${styles.healthMetricToggleBtn} ${
					value === "depth" ? styles.healthMetricToggleBtnActive : ""
				}`}
				onClick={() => onChange("depth")}
			>
				Глубина
			</button>
		</div>
	)
}
