import { getStandFirstUrlSegments } from "../../app/stands/standPathUtils"

/** Порядок вкладок для выбора первой доступной при редиректе с отключённого маршрута. */
export const STAND_TAB_IDS_ORDER = [
	"face",
	"scenarios",
	"planning",
	"ontology",
	"results",
	"admin",
]

/**
 * Первый «логический» сегмент приложения после префикса стенда.
 * `/face` → `face`, `/demo/planning` → `planning`, `/` → `face`.
 */
export function getAppRouteSegment(pathname) {
	const p = (pathname || "").replace(/\/$/, "") || "/"
	const parts = p.split("/").filter(Boolean)
	const first = parts[0]
	if (getStandFirstUrlSegments().includes(first)) {
		return parts[1] || "face"
	}
	return parts[0] || "face"
}

/**
 * Первая вкладка из {@link STAND_TAB_IDS_ORDER}, не входящая в `disabled` (Set).
 */
export function getFirstEnabledStandTab(disabled) {
	if (!disabled || disabled.size === 0) return "face"
	for (const id of STAND_TAB_IDS_ORDER) {
		if (!disabled.has(id)) return id
	}
	return "face"
}
