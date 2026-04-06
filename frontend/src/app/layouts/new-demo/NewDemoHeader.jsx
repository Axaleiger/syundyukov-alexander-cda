import { useNavigate } from "react-router-dom"
import styles from "./NewDemoHeader.module.css"

export function NewDemoHeader() {
	const navigate = useNavigate()

	return (
		<header className={styles.header}>
			<div className={styles.leftSide}>
				<h1 className={styles.title}>ОРКЕСТРАТОР АКТИВА</h1>
			</div>
			<div className={styles.rightSide}>
				<button
					type="button"
					className={styles.actionButton}
					onClick={() => navigate("/face")}
				>
					На главную
				</button>
			</div>
		</header>
	)
}
