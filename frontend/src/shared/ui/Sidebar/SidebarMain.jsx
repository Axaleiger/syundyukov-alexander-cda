import React from "react"
import { useNavigate, useLocation } from "react-router-dom"
import styles from "./SidebarMain.module.css"
import { getExpoDisableTabsFromEnv } from "../../lib/expoDisableTabsEnv"

const TABS = [
	{ id: "face", label: "Главная страница" },
	{ id: "scenarios", label: "Список сценариев" },
	{ id: "planning", label: "Планирование" },
	{ id: "ontology", label: "Конфигуратор систем" },
	{ id: "results", label: "Результаты" },
	{ id: "admin", label: "Администрирование", separatorBefore: true },
]

export const SidebarMain = () => {
	const navigate = useNavigate()
	const location = useLocation()
	const current = location.pathname.split("/")[1] || "face"
	const disabledTabs = getExpoDisableTabsFromEnv()

	return (
		<nav className={styles["app-sidebar"]}>
			{TABS.map((t) => (
				<React.Fragment key={t.id}>
					{t.separatorBefore && (
						<hr className={styles["app-sidebar-divider"]} />
					)}
					<button
						type="button"
						disabled={disabledTabs.has(t.id)}
						className={`${styles["app-sidebar-tab"]} ${
							current === t.id ? styles["app-sidebar-tab-active"] : ""
						} ${disabledTabs.has(t.id) ? styles["app-sidebar-tab-disabled"] : ""}`}
						onClick={() => {
							if (disabledTabs.has(t.id)) return
							navigate(`/${t.id}`)
						}}
					>
						{t.label}
					</button>
				</React.Fragment>
			))}
		</nav>
	)
}
