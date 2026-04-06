import { Navigate } from "react-router-dom"
import { STAND_ROUTE_CONFIGS } from "./standsConfig.js"
import { standHref } from "./standPathUtils.js"
import { AppLayout } from "../layouts/AppLayout"
import DemoLayout from "../layouts/DemoLayout"
import NewDemoLayout from "../layouts/NewDemoLayout"
import FacePage from "../../pages/Face/FacePage"
import DemoFacePage from "../../pages/demo/DemoFacePage"
import NewDemoFacePage from "../../pages/new-demo/NewDemoFacePage"
import PlanningPage from "../../pages/Planning/PlanningPage"
import ScenariosPage from "../../pages/Scenarios/ScenariosPage"
import OntologyPage from "../../pages/Ontology/OntologyPage"
import NotFoundPage from "../../pages/NotFound/NotFoundPage"
import ResultPage from "../../pages/Results/ResultsPage"
import AdminPage from "../../pages/Admin/AdminPage"

const SHELL_BY_STAND_ID = {
	main: AppLayout,
	demo: DemoLayout,
	newDemo: NewDemoLayout,
}

/** Только сегменты, где страница отличается от main. */
const PAGE_OVERRIDES_BY_STAND_ID = {
	main: {},
	demo: { face: DemoFacePage },
	newDemo: { face: NewDemoFacePage },
}

export const STANDS = STAND_ROUTE_CONFIGS.map((c) => ({
	standId: c.standId,
	routePrefix: c.routePrefix,
	Shell: SHELL_BY_STAND_ID[c.standId],
	pageOverrides: PAGE_OVERRIDES_BY_STAND_ID[c.standId] ?? {},
}))

function buildStandChildren(stand) {
	const Face = stand.pageOverrides.face ?? FacePage
	const faceHref = standHref(stand.routePrefix, "face")
	return [
		{ index: true, element: <Navigate to={faceHref} replace /> },
		{ path: "face", element: <Face /> },
		{ path: "scenarios", element: <ScenariosPage /> },
		{ path: "planning", element: <PlanningPage /> },
		{ path: "ontology", element: <OntologyPage /> },
		{ path: "results", element: <ResultPage /> },
		{ path: "admin", element: <AdminPage /> },
		{ path: "*", element: <NotFoundPage /> },
	]
}

/**
 * Ветки для createBrowserRouter: корневой path и дети как сейчас у main/demo.
 */
export function buildStandRouteBranches() {
	return STANDS.map((stand) => ({
		path: stand.routePrefix === "" ? "/" : stand.routePrefix,
		stand,
		children: buildStandChildren(stand),
	}))
}
