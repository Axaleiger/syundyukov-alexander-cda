import styles from "./NewDemoHeader.module.css"

const staticBase = `${(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}`

export function NewDemoHeader() {
	return (
		<header className={styles.header}>
			<div className={styles.leftSide}>
				<img
					src={`${staticBase}/gazprom-neft-logo.png`}
					alt="Газпром нефть"
					className={styles.brandLogo}
				/>
				<h1 className={styles.title}>ОРКЕСТРАТОР АКТИВА</h1>
			</div>
		</header>
	)
}
