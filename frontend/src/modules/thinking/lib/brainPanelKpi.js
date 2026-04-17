import { AI_PLANNING_BOARD_PRESETS } from "../../planning/data/aiPlanningBoardPresets.js"
import { kpiRows, SCENARIO_BRANCH_COUNT, OPTIMAL_SCENARIO_VARIANT } from "./scenarioGraphData.js"

/**
 * Подставляет дельты из таблички panels.md в строки KPI (базовые «абсолютные» значения из демо).
 * @param {string[] | undefined} tableLines
 * @returns {typeof kpiRows | null}
 */
export function mergeKpiDeltasFromTableLines(tableLines) {
	if (!Array.isArray(tableLines) || tableLines.length < kpiRows.length) return null
	return kpiRows.map((row, i) => ({
		...row,
		delta: String(tableLines[i] ?? row.delta).trim(),
	}))
}

/** Номер «оптимального» варианта в тексте панели (демо), по пресету ИИ. */
export function getBrainOptimalVariantForPreset(preset) {
	const map = { base_drilling: 2, fcf_no_drill: 3, opex_reduction: 5 }
	return map[preset] ?? OPTIMAL_SCENARIO_VARIANT
}

/** Число веток/сценариев в сводке под графом: для OPEX — число задач на доске пресета (≈18), иначе из графа. */
export function getBrainScenarioBranchCount(preset) {
	if (preset === "opex_reduction") {
		const board = AI_PLANNING_BOARD_PRESETS.opex_reduction
		if (board?.tasks) {
			let n = 0
			for (const list of Object.values(board.tasks)) {
				n += Array.isArray(list) ? list.length : 0
			}
			if (n > 0) return n
		}
		return 18
	}
	return SCENARIO_BRANCH_COUNT
}
