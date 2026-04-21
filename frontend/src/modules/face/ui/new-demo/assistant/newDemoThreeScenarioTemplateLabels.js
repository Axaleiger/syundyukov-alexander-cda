/**
 * Подписи первых трёх шаблонов сценария (форма «Шаблоны сценария»): без ★, единый префикс запроса.
 * Ключ — id из scenario_presets.json (порядок в JSON: 1, 2, 3).
 */
export const NEW_DEMO_THREE_SCENARIO_TEMPLATE_LABELS = {
	fcf_no_drill_capex:
		"Сформируй сквозной сценарий по росту свободного денежного потока на 10% к базе без нового бурения скважин и с ребалансом CAPEX.",
	base_oil:
		"Сформируй сквозной сценарий по управлению базовой добычей и устойчивому профилю добычи.",
	npv_push:
		"Сформируй сквозной сценарий по максимизации NPV при заданных лимитах капитальных и операционных затрат.",
}

/**
 * @param {{ id: string, label: string, sets?: object }[]} presetsList — полный список из scenario_presets
 * @returns {{ id: string, label: string, sets?: object }[]}
 */
export function mapThreeScenarioTemplatesForNewDemo(presetsList) {
	const slice = (presetsList || []).slice(0, 3)
	return slice.map((p) => ({
		...p,
		label:
			NEW_DEMO_THREE_SCENARIO_TEMPLATE_LABELS[p.id] ??
			String(p.label || "")
				.replace(/^\s*★\s*/u, "")
				.trim(),
	}))
}
