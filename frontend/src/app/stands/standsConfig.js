/**
 * Только маршрутные поля стендов (без React-компонентов), чтобы утилиты путей
 * не тянули layouts и не создавали циклических импортов.
 *
 * Сборка продакшена: `VITE_STAND_SCOPE` задаёт, какие стенды попадают в бандл.
 * - `full` (по умолчанию, локальный dev): main + demo + new-demo в одном SPA.
 * - `main`: только main и demo — артефакт под `/` (new-demo отдаётся другим бандлом).
 * - `newDemo`: только new-demo — артефакт под `VITE_BASE=/new-demo/`.
 *
 * @typedef {{ standId: string, routePrefix: string }} StandRouteConfig
 * @type {StandRouteConfig[]}
 */
const ALL_STANDS = [
	{ standId: "main", routePrefix: "" },
	{ standId: "demo", routePrefix: "/demo" },
	{ standId: "newDemo", routePrefix: "/new-demo" },
]

const scope = import.meta.env.VITE_STAND_SCOPE || "full"

export const STAND_ROUTE_CONFIGS =
	scope === "main"
		? ALL_STANDS.filter((s) => s.standId !== "newDemo")
		: scope === "newDemo"
			? ALL_STANDS.filter((s) => s.standId === "newDemo")
			: ALL_STANDS
