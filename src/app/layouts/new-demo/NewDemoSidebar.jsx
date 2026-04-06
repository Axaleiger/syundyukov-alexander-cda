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

	return (
		<aside className={styles.sidebar}>
			<nav className={styles.nav} aria-label="Навигация new-demo">
				{NAV_ITEMS.map((item) => (
					<NavLink
						key={item.id}
						to={standHref(routePrefix, item.id)}
						className={({ isActive }) =>
							`${styles.navItem} ${isActive ? styles.navItemActive : ""}`
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
