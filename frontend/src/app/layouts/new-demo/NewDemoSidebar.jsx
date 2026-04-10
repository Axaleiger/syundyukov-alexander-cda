import { NavLink } from "react-router-dom"
import { useStand } from "../../stands/standContext"
import { standHref } from "../../stands/standPathUtils"
import styles from "./NewDemoSidebar.module.css"
import faceIcon from "../../../shared/assets/icons/face.svg"
import scenariosIcon from "../../../shared/assets/icons/scenarios.svg"
import planningIcon from "../../../shared/assets/icons/planning.svg"
import ontologyIcon from "../../../shared/assets/icons/ontology.svg"
import resultsIcon from "../../../shared/assets/icons/results.svg"
import adminIcon from "../../../shared/assets/icons/admin.svg"

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

const NAV_ITEMS = [
	{ id: "face", label: "Лицо", icon: faceIcon },
	{ id: "scenarios", label: "Сценарии", icon: scenariosIcon },
	{ id: "planning", label: "Планирование", icon: planningIcon },
	{ id: "ontology", label: "Онтология", icon: ontologyIcon },
	{ id: "results", label: "Результаты", icon: resultsIcon },
	{ id: "admin", label: "Админ", icon: adminIcon },
]

export function NewDemoSidebar() {
	const { routePrefix } = useStand()
	const disabledTabs = getDisabledTabsFromEnv()

	return (
		<aside className={styles.sidebar}>
			<nav className={styles.nav} aria-label="Навигация new-demo">
				{NAV_ITEMS.map((item) => (
					<NavLink
						key={item.id}
						to={disabledTabs.has(item.id) ? "#" : standHref(routePrefix, item.id)}
						onClick={(e) => {
							if (!disabledTabs.has(item.id)) return
							e.preventDefault()
						}}
						className={({ isActive }) =>
							`${styles.navItem} ${isActive ? styles.navItemActive : ""} ${
								disabledTabs.has(item.id) ? styles.navItemDisabled : ""
							}`
						}
						end={item.id === "face"}
						aria-label={item.label}
						title={item.label}
					>
						<span
							className={styles.iconGlyph}
							style={{ "--icon-url": `url(${item.icon})` }}
							aria-hidden
						/>
					</NavLink>
				))}
			</nav>
		</aside>
	)
}
