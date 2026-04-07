import { useLocation } from "react-router-dom"
import styles from "./SecondarySidebar.module.css"

import { useAppStore } from "../../../core/store/appStore"
import { useAdminStore } from "../../../modules/admin/model/adminStore"
import { useScenariosData } from "../../../modules/scenarios/model/useScenariosData"

const ADMIN_SUB_TABS = [
	{ id: "roles", label: "Ролевая модель" },
	{ id: "catalog", label: "Каталог сервисов" },
	{ id: "integration", label: "Заявки на интеграцию" },
	{ id: "changes", label: "Заявки на доработку сервисов" },
	{ id: "add-service", label: "Заявки на добавление своего сервиса" },
]

export function SecondarySidebar() {
	const location = useLocation()
	const path = location.pathname
	const { scenarioStageFilters: SCENARIO_STAGE_FILTERS } = useScenariosData()

	const {
		scenarioStageFilters,
		setScenarioStageFilters,
		setScenariosStageFilter,
	} = useAppStore()
	const { adminSubTab, setAdminSubTab } = useAdminStore()

	if (path.startsWith("/scenarios")) {
		return (
			<nav
				className={`${styles["app-sidebar"]} ${styles["app-sidebar-secondary"]}`}
			>
				{SCENARIO_STAGE_FILTERS.map((name) => (
					<button
						key={name}
						type="button"
						className={`${styles["app-sidebar-tab"]} ${scenarioStageFilters[name] ? styles["app-sidebar-tab-active"] : ""}`}
						onClick={() => {
							setScenarioStageFilters((prev = {}) => ({
								...prev,
								[name]: !prev[name],
							}))
							setScenariosStageFilter(null)
						}}
					>
						{name}
					</button>
				))}
			</nav>
		)
	}

	if (path.startsWith("/admin")) {
		return (
			<nav
				className={`${styles["app-sidebar"]} ${styles["app-sidebar-secondary"]}`}
			>
				{ADMIN_SUB_TABS.map((t) => (
					<button
						key={t.id}
						type="button"
						className={`${styles["app-sidebar-tab"]} ${adminSubTab === t.id ? styles["app-sidebar-tab-active"] : ""}`}
						onClick={() => setAdminSubTab(t.id)}
					>
						{t.label}
					</button>
				))}
			</nav>
		)
	}

	return null
}
