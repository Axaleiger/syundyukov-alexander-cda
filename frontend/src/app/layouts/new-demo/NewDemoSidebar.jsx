import { NavLink } from "react-router-dom"
import { useCallback, useEffect, useRef, useState } from "react"
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

const DEMO_UNAVAILABLE = "Недоступно в рамках демо-стенда"
const DISABLED_TOAST_MS = 5000

export function NewDemoSidebar() {
	const { routePrefix } = useStand()
	const disabledTabs = getDisabledTabsFromEnv()
	const [disabledToast, setDisabledToast] = useState(null)
	const toastTimerRef = useRef(null)

	const showDisabledToast = useCallback((label) => {
		if (toastTimerRef.current != null) {
			clearTimeout(toastTimerRef.current)
			toastTimerRef.current = null
		}
		setDisabledToast({ title: label, hint: DEMO_UNAVAILABLE })
		toastTimerRef.current = window.setTimeout(() => {
			setDisabledToast(null)
			toastTimerRef.current = null
		}, DISABLED_TOAST_MS)
	}, [])

	useEffect(() => {
		return () => {
			if (toastTimerRef.current != null) clearTimeout(toastTimerRef.current)
		}
	}, [])

	return (
		<aside className={styles.sidebar}>
			{disabledToast ? (
				<div className={styles.demoToast} role="status" aria-live="polite">
					<span className={styles.demoToastTitle}>{disabledToast.title}</span>
					<span className={styles.demoToastHint}>{disabledToast.hint}</span>
				</div>
			) : null}
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
									showDisabledToast(item.label)
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
