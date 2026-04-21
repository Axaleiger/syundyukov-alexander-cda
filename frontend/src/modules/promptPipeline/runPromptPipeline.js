/**
 * Точка входа: текст запроса → семантика → строки для графа мышления.
 */

import { buildFormalizatorScenarioPools } from "../thinking/lib/formalizatorScenarioPools.js"
import { SCENARIO_BRANCH_COUNT } from "../thinking/lib/scenarioGraphData.js"
import {
	buildSemanticStateFromText,
	buildCauseAndHypothesisLines,
} from "./semanticState.js"
import { hypothesisExactPhrase } from "./knowledge.js"
import { labelObjective } from "./constructorLabels.js"
import { normalizeWizardSets } from "./wizardSets.js"

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
 * @param {string} rawText
 */
export function runPromptPipeline(rawText) {
	const state = buildSemanticStateFromText(rawText)
	const { causes: semCauses, hyps: semHyps } = buildCauseAndHypothesisLines(state.goalKeys)

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

	return {
		...state,
		userQueryText: String(rawText || "").trim(),
		causeLines,
		hypLines,
	}
}

/**
 * Применить выбор конструктора (шаги мастера) к результату пайплайна: цели, причины/гипотезы, semanticWizardSets.
 * @param {object} pipe — результат `runPromptPipeline`
 * @param {object} rawSets — наборы id (bases, horizons, …)
 */
export function applyWizardSetsToPipeline(pipe, rawSets) {
	const sets = normalizeWizardSets(rawSets)
	const objIds = (sets.objectives || [])
		.filter((id) => typeof id === "string" && /^G\d+$/i.test(id))
		.slice(0, SCENARIO_BRANCH_COUNT)
	const goals = []
	for (let i = 0; i < SCENARIO_BRANCH_COUNT; i++) {
		const oid = objIds[i]
		if (oid) goals.push({ id: oid, name: labelObjective(oid) })
		else goals.push({ id: `G_PLACEHOLDER_${i}`, name: `Цель ${i + 1}` })
	}
	const goalKeys = goals.map((g) =>
		typeof g.id === "string" && /^G\d+$/i.test(g.id) ? g.id : null,
	)
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

	return {
		...pipe,
		domainOk: Boolean(pipe?.domainOk || objIds.length > 0),
		goals,
		goalKeys,
		causeLines,
		hypLines,
		summaryLine: goals.map((g) => g.name).join(" · "),
		semanticWizardSets: sets,
	}
}

if (import.meta.env.DEV && typeof window !== "undefined") {
	import("./semanticRegression.js").then(({ aiRunSemanticRegression }) => {
		window.__promptPipelineDev = { runPromptPipeline, aiRunSemanticRegression }
	})
}
