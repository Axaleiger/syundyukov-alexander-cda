/**
 * Сборка «как runPromptPipeline», но из выбранного шаблона конструктора.
 */
import { buildCauseAndHypothesisLines } from "./semanticState.js"
import { buildFormalizatorScenarioPools } from "../thinking/lib/formalizatorScenarioPools.js"
import { SCENARIO_BRANCH_COUNT } from "../thinking/lib/scenarioGraphData.js"
import { hypothesisExactPhrase } from "./knowledge.js"
import {
	labelBase,
	labelConstraint,
	labelHorizon,
	labelHorizonPhase,
	labelLever,
	labelObjective,
} from "./constructorLabels.js"
import { ensureOilProductionObjectivesLikePromptBuilder } from "./wizardSets.js"

const GLOBAL_CAUSE_COUNT = SCENARIO_BRANCH_COUNT * 3
const GLOBAL_HYP_COUNT = SCENARIO_BRANCH_COUNT * 2

function padArray(base, len, filler) {
	const out = [...base]
	let i = 0
	while (out.length < len && filler.length) {
		const x = filler[i % filler.length]
		if (!out.includes(x)) out.push(x)
		i += 1
		if (i > len * 5) break
	}
	while (out.length < len) out.push(filler[out.length % filler.length] || "—")
	return out.slice(0, len)
}

/**
 * @param {object} template — элемент из scenario_presets.presets
 * @param {string} userText
 */
export function buildPipelineFromScenarioTemplate(template, userText) {
	const sets = template?.sets || {}
	/** Как после applyPreset + ensureOilProductionObjectiveChecked в prompt-builder.html */
	const rawObj = ensureOilProductionObjectivesLikePromptBuilder(
		(sets.objectives || []).filter(
			(x) => typeof x === "string" && /^G\d+$/i.test(x),
		),
	)
	const goalKeys = []
	for (let i = 0; i < SCENARIO_BRANCH_COUNT; i++) {
		goalKeys.push(rawObj[i] ?? null)
	}
	const { causes: semCauses, hyps: semHyps } = buildCauseAndHypothesisLines(goalKeys)

	const pools = buildFormalizatorScenarioPools()
	const fillerCauses = [
		...(pools.context || []),
		...(pools.analysisA || []),
		...(pools.analysisB || []),
	].filter(Boolean)
	const fillerHyps = Object.values(hypothesisExactPhrase || {}).filter(
		(x) => typeof x === "string" && x.trim(),
	)

	const causeLines = padArray(semCauses, GLOBAL_CAUSE_COUNT, fillerCauses)
	const hypLines = padArray(semHyps, GLOBAL_HYP_COUNT, fillerHyps)

	/** Только реальные цели из шаблона — без заглушек «Цель 2…», как список в prompt-builder */
	const goals = []
	for (let i = 0; i < SCENARIO_BRANCH_COUNT; i++) {
		const gid = goalKeys[i]
		if (gid) goals.push({ id: gid, name: labelObjective(gid) })
	}

	const objectiveSummary = rawObj.map((id) => labelObjective(id)).join(" · ")
	const userFirst =
		String(userText || "").trim().split("\n")[0] || template.label || ""
	const summaryLine = (objectiveSummary || userFirst).slice(0, 220)

	return {
		domainOk: true,
		matchedIntents: [],
		goals,
		goalKeys,
		suggestedPreset: null,
		summaryLine,
		userQueryText: String(userText || "").trim(),
		normText: "",
		causeLines,
		hypLines,
		templateSets: {
			...sets,
			objectives: [...rawObj],
		},
		templateLabel: template.label,
		semanticWizardSets: {
			bases: [...(sets.bases || [])],
			horizons: [...(sets.horizons || [])],
			horizon_phases: [...(sets.horizon_phases || [])],
			objectives: [...rawObj],
			constraints: [...(sets.constraints || [])],
			levers: [...(sets.levers || [])],
		},
	}
}

export function describeTemplateSets(sets) {
	const s = sets || {}
	return {
		bases: (s.bases || []).map((id) => ({ id, name: labelBase(id) })),
		horizons: (s.horizons || []).map((id) => ({ id, name: labelHorizon(id) })),
		horizonPhases: (s.horizon_phases || []).map((id) => ({ id, name: labelHorizonPhase(id) })),
		objectives: (s.objectives || []).map((id) => ({ id, name: labelObjective(id) })),
		constraints: (s.constraints || []).map((id) => ({ id, name: labelConstraint(id) })),
		levers: (s.levers || []).map((id) => ({ id, name: labelLever(id) })),
	}
}

/** Превью конструктора из свободного текста (без выбранного шаблона). */
export function describeSemanticPreview(pipe) {
	if (!pipe) return null
	if (pipe.semanticWizardSets && (pipe.domainOk || (pipe.goals?.length && pipe.semanticWizardSets.objectives?.length))) {
		const d = describeTemplateSets(pipe.semanticWizardSets)
		return { ...d, matchedIntents: pipe.matchedIntents || [] }
	}
	if (!pipe.domainOk || !pipe.goals?.length) return null
	return {
		bases: [{ id: "auto-base", name: "Утверждённый бизнес-план (по умолчанию)" }],
		horizons: [{ id: "auto-hor", name: "По смыслу запроса" }],
		horizonPhases: [],
		objectives: pipe.goals.map((g) => ({ id: g.id, name: g.name })),
		constraints: [],
		levers: [],
		matchedIntents: pipe.matchedIntents || [],
	}
}
