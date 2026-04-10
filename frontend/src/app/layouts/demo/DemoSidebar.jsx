import React from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { getAppRouteSegment } from "../../../shared/lib/appRouteSegment"
import { useStand } from "../../stands/standContext"
import { standHref } from "../../stands/standPathUtils"
import { NavTabIcon } from "./NavTabIcon"
import styles from "./DemoSidebar.module.css"

function getDisabledTabsFromEnv() {
	const raw = (import.meta.env.VITE_EXPO_DISABLE_TABS || "").trim()
	if (!raw) return new Set()
	return new Set(
		raw
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean),
	)
}

const TABS = [
	{ id: "face", label: "Главная страница", icon: "home" },
	{ id: "scenarios", label: "Список сценариев", icon: "list" },
	{ id: "planning", label: "Планирование", icon: "calendar" },
	{ id: "ontology", label: "Конфигуратор систем", icon: "gear" },
	{ id: "results", label: "Результаты", icon: "chart" },
	{ id: "admin", label: "Администрирование", icon: "admin", separatorBefore: true },
]

/**
 * Первичный сайдбар демо-стенда: иконки, узкая колонка, палитра стенда.
 */
export function DemoSidebar() {
	const { routePrefix } = useStand()
	const navigate = useNavigate()
	const location = useLocation()
	const current = getAppRouteSegment(location.pathname)
	const disabledTabs = getDisabledTabsFromEnv()

	return (
		<nav
			className={`app-sidebar app-sidebar--icons ${styles.nav}`}
			data-demo-primary-sidebar="true"
		>
			{TABS.map((t) => (
				<React.Fragment key={t.id}>
					{t.separatorBefore && (
						<hr className={`app-sidebar-divider ${styles.divider}`} />
					)}
					<button
						type="button"
						disabled={disabledTabs.has(t.id)}
						className={`app-sidebar-tab ${styles.tab} ${current === t.id ? `app-sidebar-tab-active ${styles.tabActive}` : ""}`}
						onClick={() => {
							if (disabledTabs.has(t.id)) return
							navigate(standHref(routePrefix, t.id))
						}}
						title={t.label}
						aria-label={t.label}
						aria-current={current === t.id ? "page" : undefined}
					>
						<NavTabIcon name={t.icon} />
					</button>
				</React.Fragment>
			))}
		</nav>
	)
}
