import { getStandFirstUrlSegments } from "../../app/stands/standPathUtils"

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
