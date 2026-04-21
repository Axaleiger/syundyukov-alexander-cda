/**
 * Нормализация наборов измерений конструктора (как `sets` в scenario_presets).
 */

export const EMPTY_WIZARD_SETS = {
	bases: [],
	horizons: [],
	horizon_phases: [],
	objectives: [],
	constraints: [],
	levers: [],
}

/**
 * Совпадает с `prompt-builder.html`: `DEFAULT_OIL_OBJECTIVE_ID`, вызов
 * `ensureOilProductionObjectiveChecked()` сразу после `applyPreset()` / `setChecks("objectives", …)` —
 * цель по добыче нефти (G03) всегда включается в состав выбранных целей.
 */
export const PROMPT_BUILDER_DEFAULT_OIL_OBJECTIVE_ID = "G03"

/**
 * @param {unknown[]} objectiveIds — id вида G01 из `scenario_presets.sets.objectives`
 * @returns {string[]} тот же порядок, что после чекбоксов в конструкторе (G03 добавляется вперёд при отсутствии)
 */
export function ensureOilProductionObjectivesLikePromptBuilder(objectiveIds) {
	const ids = []
	const seen = new Set()
	for (const x of objectiveIds || []) {
		if (typeof x !== "string" || !/^G\d+$/i.test(x.trim())) continue
		const id = String(x).trim().replace(/^g/i, "G")
		if (seen.has(id)) continue
		seen.add(id)
		ids.push(id)
	}
	const oil = PROMPT_BUILDER_DEFAULT_OIL_OBJECTIVE_ID
	if (!seen.has(oil)) return [oil, ...ids]
	return ids
}

export function normalizeWizardSets(raw) {
	const s = raw && typeof raw === "object" ? raw : {}
	return {
		bases: Array.isArray(s.bases) ? [...s.bases] : [],
		horizons: Array.isArray(s.horizons) ? [...s.horizons] : [],
		horizon_phases: Array.isArray(s.horizon_phases) ? [...s.horizon_phases] : [],
		objectives: Array.isArray(s.objectives) ? [...s.objectives] : [],
		constraints: Array.isArray(s.constraints) ? [...s.constraints] : [],
		levers: Array.isArray(s.levers) ? [...s.levers] : [],
	}
}

/**
 * Для шаблона из scenario_presets: если в мастере ещё пусто (или гонка до useEffect),
 * не затирать objectives/bases/… из `tpl.sets` — иначе пайплайн без G** и все ветки графа «пустые».
 * @param {object} [tplSets] — template.sets
 * @param {object} [wizardSets] — нормализованное состояние мастера
 */
export function mergeTemplateSetsWithWizard(tplSets, wizardSets) {
	const t = normalizeWizardSets(tplSets || {})
	const w = normalizeWizardSets(wizardSets || {})
	const pick = (key) => {
		const wv = w[key]
		if (Array.isArray(wv) && wv.length > 0) return [...wv]
		const tv = t[key]
		return Array.isArray(tv) ? [...tv] : []
	}
	return normalizeWizardSets({
		bases: pick("bases"),
		horizons: pick("horizons"),
		horizon_phases: pick("horizon_phases"),
		objectives: pick("objectives"),
		constraints: pick("constraints"),
		levers: pick("levers"),
	})
}

export const WIZARD_STEP_MAX = {
	bases: 2,
	horizons: 2,
	horizon_phases: 5,
	objectives: 4,
	constraints: 3,
	levers: 4,
}
