import { useAppStore } from "../../../core/store/appStore"
import styles from "./DemoHeader.module.css"

const staticBase = `${(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}`

/**
 * Шапка только для DemoLayout: брендинг stand-face vs остальные демо-страницы, ИИ, пользователь.
 * @param {{ isFaceRoute: boolean }} props
 */
export function DemoHeader({ isFaceRoute }) {
	const aiMode = useAppStore((s) => s.aiMode)
	const setAiMode = useAppStore((s) => s.setAiMode)

	return (
		<header className={`app-header ${styles.header}`}>
			<img
				src={
					isFaceRoute
						? `${staticBase}/gazprom-neft-logo.png`
						: `${staticBase}/emblem.png`
				}
				alt={
					isFaceRoute
						? "Цифровой двойник актива"
						: "Оркестратор актива"
				}
				className={`${styles.emblem} ${isFaceRoute ? styles.emblemStandFace : ""}`}
			/>
			<div className={styles.textBlock}>
				<h1 className={styles.title}>
					{isFaceRoute
						? "Цифровой двойник актива"
						: "Оркестратор актива"}
				</h1>
			</div>
			<div className={styles.actions}>
				<button
					type="button"
					className={`${styles.aiToggle} ${aiMode ? styles.aiToggleOn : ""}`}
					onClick={() => setAiMode(!aiMode)}
					title={aiMode ? "Выключить ИИ-режим" : "Включить ИИ-режим"}
				>
					{aiMode && <span className={styles.spinner} aria-hidden />}
					<span>ИИ-режим</span>
				</button>
				<div className={styles.user}>
					<span className={styles.userName}>
						Сюндюков А.В. · Ведущий эксперт
					</span>
					<img
						src={`${staticBase}/sanya-bodibilder.png`}
						alt=""
						className={styles.avatar}
					/>
				</div>
			</div>
		</header>
	)
}
