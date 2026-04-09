import styles from "./MapPointTooltip.module.css"

export function MapPointTooltip({ title }) {
	return <div className={styles.tooltip}>{title}</div>
}
