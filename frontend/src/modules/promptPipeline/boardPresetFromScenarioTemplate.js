/**
 * Соответствие пресета конструктора (`scenario_presets.json`) → ключ доски new-demo.
 */

/** @param {string | null | undefined} scenarioPresetId */
export function boardPresetFromScenarioTemplateId(scenarioPresetId) {
	const id = String(scenarioPresetId || "")
	if (!id) return null
	/** Та же палитра полос этапов и доска, что у base_oil / npv — не отдельный «fcf» тон графа */
	if (id === "fcf_no_drill_capex") return "base_drilling"
	if (id === "opex_program") return "opex_reduction"
	if (id === "base_oil" || id === "npv_push" || id === "recovery_kin") return "base_drilling"
	if (id === "capex_phasing" || id === "stress_macro" || id === "compare_abc") return "fcf_no_drill"
	if (id === "wc_release" || id === "esg_water") return "opex_reduction"
	return "base_drilling"
}
