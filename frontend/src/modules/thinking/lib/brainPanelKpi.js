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
	const map = { base_drilling: 7, fcf_no_drill: 3, opex_reduction: 5 }
	return map[preset] ?? OPTIMAL_SCENARIO_VARIANT
}

export function getBrainScenarioBranchCount() {
	return SCENARIO_BRANCH_COUNT
}
