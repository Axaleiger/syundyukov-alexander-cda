import { standHref } from "../../app/stands/standPathUtils"
import { API_V1_PREFIX, apiFetch } from "../../core/data/repositories/http/httpClient"
import { useAppStore } from "../../core/store/appStore"
import { useThinkingStore } from "../../modules/thinking/model/thinkingStore"
import { useResultsStore } from "../../modules/results/model/resultsStore"
import { useAdminStore } from "../../modules/admin/model/adminStore"
import { useOntologyStore } from "../../modules/ontology/model/ontologyStore"

function faceHomeUrl(routePrefix) {
	const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "")
	const path = standHref(routePrefix, "face")
	const pathOnly = path.startsWith("/") ? path : `/${path}`
	return `${window.location.origin}${base}${pathOnly}`
}

let restartInFlight = false

/**
 * Полный сброс демо-сессии (как «Начать с начала» в Expo idle): reset-demo в API при наличии кейса,
 * сброс сторов, переход на главную.
 * @param {string} [routePrefix]
 */
export async function restartDemoSessionFromPreset(routePrefix = "") {
	if (restartInFlight) return
	restartInFlight = true
	try {
		const selectedScenarioId = useAppStore.getState().selectedScenarioId
		try {
			if (selectedScenarioId) {
				const cases = await apiFetch(`${API_V1_PREFIX}/planning/cases`)
				const match = Array.isArray(cases)
					? cases.find((c) => String(c.scenarioId ?? "") === String(selectedScenarioId))
					: null
				if (match?.id) {
					await apiFetch(
						`${API_V1_PREFIX}/planning/cases/${match.id}/reset-demo`,
						{ method: "POST" },
					)
				}
			}
		} catch {
			/* не блокируем сброс UI */
		}

		try {
			useThinkingStore.getState().resetExpoPreset?.()
			useResultsStore.getState().resetExpoPreset?.()
			useAdminStore.getState().resetExpoPreset?.()
			useOntologyStore.getState().resetExpoPreset?.()
			useAppStore.getState().resetExpoPreset?.()
		} catch (e) {
			console.warn("[demo] resetExpoPreset stores", e)
		}

		window.location.assign(faceHomeUrl(routePrefix))
	} finally {
		restartInFlight = false
	}
}
