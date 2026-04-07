import { STAND_ROUTE_CONFIGS } from "./standsConfig.js"

/** Первые сегменты URL для стендов с префиксом (например `demo` для `/demo`). */
export function getStandFirstUrlSegments() {
	return STAND_ROUTE_CONFIGS.map((c) =>
		c.routePrefix.replace(/^\//, "").replace(/\/$/, ""),
	).filter(Boolean)
}

/**
 * Абсолютный путь к сегменту стенда: main → `/face`, demo → `/demo/face`.
 * @param {string} routePrefix — `""` или `"/demo"`
 * @param {string} segment — например `face`, `planning`
 */
export function standHref(routePrefix, segment) {
	const s = String(segment).replace(/^\//, "")
	if (!routePrefix) return `/${s}`
	const base = routePrefix.replace(/\/$/, "")
	return `${base}/${s}`
}
