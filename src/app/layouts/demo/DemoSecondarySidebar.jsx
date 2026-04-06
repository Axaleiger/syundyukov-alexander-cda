import { useLocation } from "react-router-dom"
import { useAppStore } from "../../../core/store/appStore"
import { useAdminStore } from "../../../modules/admin/model/adminStore"
import { useScenariosData } from "../../../modules/scenarios/model/useScenariosData"
import { getAppRouteSegment } from "../../../shared/lib/appRouteSegment"
import styles from "./DemoSecondarySidebar.module.css"

const ADMIN_SUB_TABS = [
	{ id: "roles", label: "Ролевая модель" },
	{ id: "catalog", label: "Каталог сервисов" },
	{ id: "integration", label: "Заявки на интеграцию" },
	{ id: "changes", label: "Заявки на доработку сервисов" },
	{ id: "add-service", label: "Заявки на добавление своего сервиса" },
]

/** Вторичный сайдбар для `/demo/scenarios` и `/demo/admin`. */
export function DemoSecondarySidebar() {
	const location = useLocation()
	const { scenarioStageFilters: SCENARIO_STAGE_FILTERS } = useScenariosData()
	const {
		scenarioStageFilters,
		setScenarioStageFilters,
		setScenariosStageFilter,
	} = useAppStore()
	const { adminSubTab, setAdminSubTab } = useAdminStore()

	const segment = getAppRouteSegment(location.pathname)

	if (segment === "scenarios") {
		return (
			<nav
				className={`app-sidebar app-sidebar-secondary app-sidebar-secondary--demo ${styles.nav}`}
				aria-label="Фильтры этапов сценариев"
			>
				{SCENARIO_STAGE_FILTERS.map((name) => (
					<button
						key={name}
						type="button"
						className={`app-sidebar-tab ${styles.tab} ${scenarioStageFilters[name] ? `app-sidebar-tab-active ${styles.tabActive}` : ""}`}
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

	if (segment === "admin") {
		return (
			<nav
				className={`app-sidebar app-sidebar-secondary app-sidebar-secondary--demo ${styles.nav}`}
				aria-label="Подразделы администрирования"
			>
				{ADMIN_SUB_TABS.map((t) => (
					<button
						key={t.id}
						type="button"
						className={`app-sidebar-tab ${styles.tab} ${adminSubTab === t.id ? `app-sidebar-tab-active ${styles.tabActive}` : ""}`}
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
