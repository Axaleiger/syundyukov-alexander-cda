/**
 * Только маршрутные поля стендов (без React-компонентов), чтобы утилиты путей
 * не тянули layouts и не создавали циклических импортов.
 *
 * @typedef {{ standId: string, routePrefix: string }} StandRouteConfig
 * @type {StandRouteConfig[]}
 */
export const STAND_ROUTE_CONFIGS = [
	{ standId: "main", routePrefix: "" },
	{ standId: "demo", routePrefix: "/demo" },
]
