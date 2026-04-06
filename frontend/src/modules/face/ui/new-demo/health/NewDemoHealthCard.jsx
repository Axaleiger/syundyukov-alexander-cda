import { NewDemoHealthRadar } from "./NewDemoHealthRadar"
import styles from "./NewDemoHealth.module.css"

const PREVIEW_LABELS = ["ГРР", "Разр", "План", "Бур", "Доб", "Объ"]

export function NewDemoHealthCard({ data, isActive, onToggle }) {
	return (
		<button
			type="button"
			className={`${styles.healthCard} ${isActive ? styles.healthCardActive : ""}`}
			onClick={onToggle}
			aria-expanded={isActive}
			aria-label={isActive ? "Свернуть карту здоровья ЦД" : "Открыть карту здоровья ЦД"}
		>
			<h2 className={styles.healthCardTitle}>Карта здоровья ЦД</h2>
			<span className={styles.healthCardIndex}>1.</span>
			<div className={styles.healthCardRadar}>
				<NewDemoHealthRadar data={data} size="small" />
				{PREVIEW_LABELS.map((label, index) => (
					<span key={label} className={`${styles.healthLabel} ${styles[`healthLabel${index}`]}`}>
						{label}
					</span>
				))}
			</div>
			<span className={styles.healthCardTriangle} aria-hidden />
		</button>
	)
}
