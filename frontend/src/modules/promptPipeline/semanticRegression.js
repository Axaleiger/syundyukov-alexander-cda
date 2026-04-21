/**
 * Регрессия по `semantic_regression_cases.json` — только для консоли в dev.
 */
import { semanticRegressionCases } from "./knowledge.js"
import { runPromptPipeline } from "./runPromptPipeline.js"

function goalIdsFromPipeline(result) {
	return (result.goals || []).map((g) => g.id).filter(Boolean)
}

function checkExpect(result, expect) {
	const ids = new Set(goalIdsFromPipeline(result))
	const errs = []
	if (expect.goals_include_any?.length) {
		const ok = expect.goals_include_any.some((id) => ids.has(id))
		if (!ok) errs.push(`goals_include_any: want one of ${expect.goals_include_any}, got ${[...ids]}`)
	}
	if (expect.goals_exclude?.length) {
		for (const id of expect.goals_exclude) {
			if (ids.has(id)) errs.push(`goals_exclude: should not have ${id}`)
		}
	}
	return errs
}

export function aiRunSemanticRegression() {
	const cases = semanticRegressionCases?.cases || []
	let passed = 0
	const failures = []
	for (const c of cases) {
		const input = c.input || ""
		const r = runPromptPipeline(input)
		const errs = c.expect ? checkExpect(r, c.expect) : []
		if (!errs.length) passed += 1
		else failures.push({ input: input.slice(0, 60), errs })
	}
	const report = { total: cases.length, passed, failed: failures.length, failures }
	console.info("[aiRunSemanticRegression]", report)
	return report
}
