import { NavLink } from "react-router-dom"
import { useStand } from "../../stands/standContext"
import { standHref } from "../../stands/standPathUtils"
import { getExpoDisableTabsFromEnv } from "../../../shared/lib/expoDisableTabsEnv"
import styles from "./NewDemoSidebar.module.css"
import faceIcon from "../../../shared/assets/icons/face.svg"
import scenariosIcon from "../../../shared/assets/icons/scenarios.svg"
import planningIcon from "../../../shared/assets/icons/planning.svg"
import ontologyIcon from "../../../shared/assets/icons/ontology.svg"
import resultsIcon from "../../../shared/assets/icons/results.svg"
import adminIcon from "../../../shared/assets/icons/admin.svg"

const NAV_ITEMS = [
	{ id: "face", label: "Главная", icon: faceIcon },
	{ id: "scenarios", label: "Сценарии", icon: scenariosIcon },
	{ id: "planning", label: "Планирование", icon: planningIcon },
	{ id: "ontology", label: "Онтология", icon: ontologyIcon },
	{ id: "results", label: "Результаты", icon: resultsIcon },
	{ id: "admin", label: "Админ", icon: adminIcon },
]

const DEMO_UNAVAILABLE = "Недоступно в рамках демо-стенда"

export function NewDemoSidebar() {
	const { routePrefix } = useStand()
	const disabledTabs = getExpoDisableTabsFromEnv()

	return (
		<aside className={styles.sidebar}>
			<nav className={styles.nav} aria-label="Навигация new-demo">
				{NAV_ITEMS.map((item) => {
					const isDisabled = disabledTabs.has(item.id)
					const ariaLabel = isDisabled ? `${item.label}. ${DEMO_UNAVAILABLE}` : item.label
					return (
						<div key={item.id} className={styles.navItemWrap}>
							<NavLink
								to={isDisabled ? "#" : standHref(routePrefix, item.id)}
								onClick={(e) => {
									if (!isDisabled) return
									e.preventDefault()
								}}
								className={({ isActive }) =>
									`${styles.navItem} ${isActive ? styles.navItemActive : ""} ${
										isDisabled ? styles.navItemDisabled : ""
									}`
								}
								end={item.id === "face"}
								aria-label={ariaLabel}
								aria-disabled={isDisabled || undefined}
							>
								<span
									className={styles.iconGlyph}
									style={{ "--icon-url": `url(${item.icon})` }}
									aria-hidden
								/>
							</NavLink>
							<div className={styles.navTooltip} role="tooltip">
								<span className={styles.navTooltipTitle}>{item.label}</span>
								{isDisabled ? (
									<span className={styles.navTooltipHint}>{DEMO_UNAVAILABLE}</span>
								) : null}
							</div>
						</div>
					)
				})}
			</nav>
		</aside>
	)
}
