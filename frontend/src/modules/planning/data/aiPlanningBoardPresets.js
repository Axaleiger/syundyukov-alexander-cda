/**
 * Доски планирования для сценариев ИИ: JSON из docs/scenario_exports/*.xlsx
 * (генерация: `node scripts/generateAiBoardsFromXlsx.mjs`).
 */
import boardsJson from "./generated/aiBoardsFromXlsx.json"

function reviveTaskDates(t) {
	return {
		...t,
		deadline: t.deadline ? new Date(t.deadline) : new Date(),
		periodStart: t.periodStart ? new Date(t.periodStart) : new Date(),
		periodEnd: t.periodEnd ? new Date(t.periodEnd) : new Date(),
	}
}

function reviveBoard(raw) {
	if (!raw) return null
	const tasks = {}
	for (const [stage, list] of Object.entries(raw.tasks || {})) {
		tasks[stage] = (list || []).map(reviveTaskDates)
	}
	return {
		scenarioName: raw.scenarioName || "",
		stages: Array.isArray(raw.stages) ? [...raw.stages] : [],
		tasks,
		connections: Array.isArray(raw.connections) ? [...raw.connections] : [],
	}
}

/** @type {Record<string, ReturnType<typeof reviveBoard>>} */
export const AI_PLANNING_BOARD_PRESETS = {
	base_drilling: reviveBoard(boardsJson.base_drilling),
	fcf_no_drill: reviveBoard(boardsJson.fcf_no_drill),
	opex_reduction: reviveBoard(boardsJson.opex_reduction),
}

export const AI_PLANNING_PRESET_KEYS = /** @type {const} */ ([
	"base_drilling",
	"fcf_no_drill",
	"opex_reduction",
])

/** Имена сценариев из xlsx-пресетов (в БД может не быть — доска только из BPMBoard). */
export const AI_PLANNING_PRESET_SCENARIO_NAMES = new Set(
	AI_PLANNING_PRESET_KEYS.map((k) => AI_PLANNING_BOARD_PRESETS[k]?.scenarioName).filter(Boolean),
)

/** Тексты для панели сравнения / влияние после возврата с планирования (кратко; подробнее — panelsScenarioContent). */
export const AI_PRESET_FACE_LINES = {
	base_drilling:
		"ИИ: принят сквозной сценарий «Управление добычей с учётом ближайшего бурения» — доска из xlsx согласована.",
	fcf_no_drill:
		"ИИ: принят сценарий «Ребаланс CAPEX / отказ от бурения» — доска tasks_board_fcf_no_drill согласована.",
	opex_reduction:
		"ИИ: принят сценарий «Удельный OPEX и энергозатраты» — доска tasks_board_opex_reduction согласована.",
}

/** Короткие описания для графа мышления (узлы). */
export const AI_PRESET_THINKING_SUMMARIES = {
	base_drilling:
		"Сквозной сценарий: базовая добыча и координация с ближайшим бурением; доска из файла «Управление добычей…».",
	fcf_no_drill:
		"Ребаланс CAPEX без нового бурения; доска tasks_board_fcf_no_drill.",
	opex_reduction:
		"Удельный OPEX и энергозатраты при удержании добычи; доска tasks_board_opex_reduction.",
}
