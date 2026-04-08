import {
	PERIOD_OPTIONS,
	SCENARIO_DIRECTIONS,
	filterScenariosByPeriod,
} from "../../static/scenariosData.js"
import { API_V1_PREFIX, apiFetch } from "./httpClient.js"

/** Соответствие месторождения → ДО (как во фронтовых демо-данных). */
const FIELD_TO_DO = {
	Зимнее: "Газпромнефть-Хантос",
	Новогоднее: "Газпромнефть-ННГ",
	Аганское: "Газпромнефть-Мегион",
}

/**
 * @param {string} iso
 * @returns {string}
 */
function formatDateRu(iso) {
	if (!iso) return "—"
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return String(iso)
	return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`
}

/**
 * @param {object} raw
 * @param {Map<string, string>} stageIdToLabel
 * @param {Map<string, { displayName: string }>} assetIdToAsset
 * @returns {import('../contracts/repositoryContracts.js').ScenarioRow}
 */
function mapScenarioRow(raw, stageIdToLabel, assetIdToAsset) {
	const sid =
		raw.productionStageId != null
			? String(raw.productionStageId)
			: ""
	const stageLabel = (sid && stageIdToLabel.get(sid)) || "—"
	const asset = raw.assetId
		? assetIdToAsset.get(String(raw.assetId))
		: null
	const field = asset?.displayName || "—"
	const doLabel = FIELD_TO_DO[field] || "—"
	const id = raw.externalCode || String(raw.id)

	return {
		id,
		scenarioId: String(raw.id),
		name: raw.name,
		stages: "—",
		do: doLabel,
		field,
		status: raw.status || "—",
		approved: Boolean(raw.isApproved),
		dateCreated: formatDateRu(raw.createdAt),
		timeCalc: raw.calculationDurationText || "—",
		dateUpdated: formatDateRu(raw.updatedAt),
		author: raw.authorDisplayName || "—",
		stageType: stageLabel,
		direction: raw.businessDirectionName || "",
	}
}

/**
 * Асинхронная загрузка витрины сценариев (список + справочники для маппинга).
 * Синхронные методы ниже — fallback до первой загрузки и для совместимости с контрактом.
 * @returns {import('../contracts/repositoryContracts.js').ScenariosRepository & { fetchScenarioViewModel?: () => Promise<object> }}
 */
export function createHttpScenariosRepository() {
	const fallbackStages = [
		"Геологоразведка и работа с ресурсной базой",
		"Разработка",
		"Планирование и обустройство",
		"Бурение и ВСР",
		"Добыча",
	]

	return {
		getScenarioStageFilters: () => fallbackStages,
		getPeriodOptions: () => PERIOD_OPTIONS,
		getScenarioDirections: () => SCENARIO_DIRECTIONS,
		getScenarios: () => [],

		filterScenariosByPeriod: (scenarios, periodValue) =>
			filterScenariosByPeriod(scenarios, periodValue),

		/**
		 * @param {string} scenarioId — UUID сценария
		 * @param {Record<string, unknown>} patch — camelCase, см. PATCH /scenarios/{id}
		 */
		async patchScenario(scenarioId, patch) {
			return apiFetch(`${API_V1_PREFIX}/scenarios/${scenarioId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(patch),
			})
		},

		async fetchScenarioViewModel() {
			const [tax, scenList, assets] = await Promise.all([
				apiFetch(`${API_V1_PREFIX}/taxonomy/production-stages`),
				apiFetch(`${API_V1_PREFIX}/scenarios`),
				apiFetch(`${API_V1_PREFIX}/assets`),
			])
			let businessDirections = []
			try {
				businessDirections = await apiFetch(
					`${API_V1_PREFIX}/taxonomy/business-directions`,
				)
			} catch {
				businessDirections = []
			}

			const stageIdToLabel = new Map(
				tax.map((s) => [String(s.id), s.labelFull]),
			)
			const scenarioStageFilters = [...tax]
				.sort((a, b) => a.sortOrder - b.sortOrder)
				.map((s) => s.labelFull)

			const assetIdToAsset = new Map(
				assets.map((a) => [
					String(a.id),
					{ displayName: a.displayName },
				]),
			)

			const scenarios = scenList.map((raw) =>
				mapScenarioRow(raw, stageIdToLabel, assetIdToAsset),
			)

			const scenarioDirections = [...businessDirections]
				.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
				.map((d) => d.name)

			return {
				scenarioStageFilters,
				periodOptions: PERIOD_OPTIONS,
				scenarioDirections:
					scenarioDirections.length > 0
						? scenarioDirections
						: SCENARIO_DIRECTIONS,
				allScenarios: scenarios,
				filterScenariosByPeriod: (list, periodValue) =>
					filterScenariosByPeriod(list, periodValue),
			}
		},
	}
}
