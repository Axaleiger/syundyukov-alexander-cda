/**
 * Семантика запроса по `semantic_rules.json`, `asset_modeling_knowledge.json`, `lexicon.json`.
 * Упрощённый порт идей из prompt-builder (без Groq, без DOM мастера).
 */

import {
	semanticRules,
	lexicon,
	assetModelingKnowledge,
	promptDeepCauses,
	hypothesisExactPhrase,
} from "./knowledge.js"
import { SCENARIO_BRANCH_COUNT } from "../thinking/lib/scenarioGraphData.js"

const DOMAIN_CORPUS = [
	"добыч",
	"нефт",
	"скважин",
	"месторожден",
	"актив",
	"capex",
	"капекс",
	"opex",
	"опекс",
	"fcf",
	"бурен",
	"гтм",
	"запас",
	"модел",
	"пласт",
	"днс",
	"кнс",
	"риск",
	"npv",
	"инвест",
]

export function aiNormalizeTextRu(text) {
	return String(text || "")
		.toLowerCase()
		.replace(/\s+/g, " ")
		.replace(/ё/g, "е")
		.trim()
}

export function aiIsDomainRelevant(text) {
	const n = aiNormalizeTextRu(text)
	if (n.length < 8) return false
	return DOMAIN_CORPUS.some((k) => n.includes(k))
}

/** Какие интенты сработали (по подстроке триггера в нормализованном тексте). */
export function aiExtractMatchedIntentNames(normText) {
	const intents = semanticRules.intents || {}
	const matched = []
	for (const [name, def] of Object.entries(intents)) {
		const triggers = def.triggers || []
		const hit = triggers.some((t) => {
			const s = String(t || "").toLowerCase()
			return s && normText.includes(s)
		})
		if (hit) matched.push(name)
	}
	return matched
}

function tokenOverlapScore(normText, paragraph) {
	const p = aiNormalizeTextRu(paragraph)
	if (!p) return 0
	const words = p.split(/[^a-zа-яё0-9]+/i).filter((w) => w.length >= 3)
	let s = 0
	for (const w of words) {
		if (normText.includes(w)) s += 1
	}
	return Math.min(6, s)
}

function scoreDimensionItems(norm, items, helpBlock, policy) {
	const scores = new Map()
	for (const item of items) {
		if (!item?.id) continue
		let sc = 0
		const nameNorm = aiNormalizeTextRu(String(item.name || ""))
		for (const w of nameNorm.split(/[^a-zа-яё0-9]+/i)) {
			if (w.length >= 3 && norm.includes(w)) sc += (policy.name_weight ?? 1) * 1.0
		}
		const help = helpBlock?.[item.id]
		if (help) sc += tokenOverlapScore(norm, help) * (policy.dimension_help_weight ?? 0.35)
		scores.set(item.id, sc)
	}
	return scores
}

/** Усиление скоринга рычагов по lexicon.lever_keywords (как в PIPELINE_SOURCES). */
export function scoreLeversFromText(normText) {
	const lk = lexicon.lever_keywords || {}
	const scores = new Map()
	for (const [leverId, words] of Object.entries(lk)) {
		let s = 0
		for (const w of words || []) {
			const t = String(w || "").toLowerCase()
			if (t.length >= 2 && normText.includes(t)) s += 1
		}
		if (s) scores.set(leverId, s)
	}
	return scores
}

/**
 * Подбор измерений сценария по тексту и интентам (аналог полей aiWizard.state в prompt-builder).
 * @param {string[]} objectiveIds — выбранные цели (id вида G01)
 */
export function buildSemanticWizardSets(norm, matchedIntents, objectiveIds) {
	const policy = semanticRules.policy || {}
	const dims = assetModelingKnowledge.dimensions || {}
	const dimHelp = assetModelingKnowledge.dimension_help || {}
	const intentsBlock = semanticRules.intents || {}

	const basesArr = Array.isArray(dims.bases) ? dims.bases : []
	const baseScores = scoreDimensionItems(norm, basesArr, dimHelp.bases || {}, policy)
	const basesSorted = [...basesArr].sort(
		(a, b) => (baseScores.get(b.id) ?? 0) - (baseScores.get(a.id) ?? 0),
	)
	const bestBase = basesSorted[0]
	const bases =
		bestBase?.id && (baseScores.get(bestBase.id) ?? 0) >= 1
			? [bestBase.id]
			: ["B01"]

	const hzFromIntent = []
	for (const name of matchedIntents) {
		const hid = intentsBlock[name]?.horizon
		if (typeof hid === "string" && hid) hzFromIntent.push(hid)
	}
	const hzList = Array.isArray(dims.horizons) ? dims.horizons : []
	const hzScores = scoreDimensionItems(norm, hzList, dimHelp.horizons || {}, policy)
	let horizons = [...new Set(hzFromIntent)]
	if (!horizons.length) {
		const sortedHz = [...hzList].sort(
			(a, b) => (hzScores.get(b.id) ?? 0) - (hzScores.get(a.id) ?? 0),
		)
		horizons = sortedHz[0]?.id ? [sortedHz[0].id] : ["T02"]
	}
	if (horizons.length > 2) horizons = horizons.slice(0, 2)

	let horizon_phases = []
	if (horizons.includes("T04") || /фаз|этап\s*цикл/i.test(norm)) {
		const hpList = Array.isArray(dims.horizon_phases) ? dims.horizon_phases : []
		horizon_phases = hpList.map((x) => x.id).filter(Boolean)
	}

	const cList = Array.isArray(dims.constraints) ? dims.constraints : []
	const cHelp = dimHelp.constraints || {}
	const constraintAllowed =
		matchedIntents.includes("constraints_requested") ||
		/огранич|лимит|потолок|не более|без нового|без бурен/i.test(norm)
	const cScores = scoreDimensionItems(norm, cList, cHelp, policy)
	const maxC = policy.max_constraints ?? 3
	let constraints = []
	if (!policy.constraints_only_if_intent || constraintAllowed) {
		constraints = [...cList]
			.map((c) => ({ id: c.id, s: cScores.get(c.id) ?? 0 }))
			.filter((x) => x.s >= (policy.constraint_score_threshold ?? 5))
			.sort((a, b) => b.s - a.s)
			.slice(0, maxC)
			.map((x) => x.id)
	}

	const leverScores = scoreLeversFromText(norm)
	for (const name of matchedIntents) {
		const defs = intentsBlock[name]?.default_levers
		if (!Array.isArray(defs)) continue
		for (const lid of defs) {
			if (typeof lid === "string")
				leverScores.set(lid, (leverScores.get(lid) ?? 0) + 3)
		}
	}
	const levGates = policy.lever_gates || {}
	for (const [lid, gate] of Object.entries(levGates)) {
		const need = gate?.must_have_intents
		if (Array.isArray(need) && need.length) {
			const ok = need.some((ni) => matchedIntents.includes(ni))
			if (!ok) leverScores.delete(lid)
		}
	}
	const maxL = policy.max_levers ?? 4
	const levTh = policy.lever_score_threshold ?? 3
	let levers = [...leverScores.entries()]
		.filter(([, s]) => s >= levTh)
		.sort((a, b) => b[1] - a[1])
		.slice(0, maxL)
		.map(([id]) => id)
	if (levers.length < 2) {
		for (const name of matchedIntents) {
			const defs = intentsBlock[name]?.default_levers
			if (!Array.isArray(defs)) continue
			for (const lid of defs) {
				if (typeof lid === "string" && !levers.includes(lid) && levers.length < maxL)
					levers.push(lid)
			}
		}
	}

	const objectives = objectiveIds
		.filter((id) => typeof id === "string" && /^G\d+$/i.test(id))
		.slice(0, SCENARIO_BRANCH_COUNT)

	return {
		bases,
		horizons,
		horizon_phases,
		objectives,
		constraints,
		levers,
	}
}

function mapInfluencePhrase(raw) {
	const p = String(raw ?? "").trim()
	if (!p) return ""
	const m = hypothesisExactPhrase[p] ?? hypothesisExactPhrase[String(p)]
	if (typeof m === "string" && m.trim()) return m.trim()
	return p
}

/**
 * Подбор пресета доски new-demo по сработавшим интентам и ключевым словам.
 * @param {string[]} matchedIntents
 * @param {string} normText
 */
export function inferAiFacePresetFromIntents(matchedIntents, normText) {
	const s = new Set(matchedIntents)
	if (
		s.has("cashflow_focus") ||
		s.has("capex_focus") ||
		/(fcf|кэш|денежн|ребаланс|капекс|capex)/i.test(normText)
	) {
		return "fcf_no_drill"
	}
	if (
		s.has("resource_efficiency") ||
		/(opex|опекс|операцион|энерг|себестоим|затрат)/i.test(normText)
	) {
		return "opex_reduction"
	}
	return "base_drilling"
}

/**
 * @returns {{
 *   domainOk: boolean,
 *   matchedIntents: string[],
 *   goals: { id: string, name: string }[],
 *   suggestedPreset: string,
 *   summaryLine: string,
 * }}
 */
export function buildSemanticStateFromText(rawText) {
	const text = String(rawText || "").trim()
	const norm = aiNormalizeTextRu(text.split("\n")[0] || text)
	const policy = semanticRules.policy || {}
	const dims = assetModelingKnowledge.dimensions || {}
	const objectives = Array.isArray(dims.objectives) ? dims.objectives : []
	const dimensionHelp = dims.dimension_help?.objectives || {}

	const matchedIntents = aiExtractMatchedIntentNames(norm)

	const forbid = policy.forbid_objectives_without_intents || {}
	const intentSet = new Set(matchedIntents)

	const scores = new Map()
	for (const o of objectives) {
		let sc = 0
		const name = String(o.name || "")
		const nameNorm = aiNormalizeTextRu(name)
		for (const w of nameNorm.split(/[^a-zа-яё0-9]+/i)) {
			if (w.length >= 4 && norm.includes(w)) sc += (policy.name_weight ?? 1) * 1.2
		}
		const help = dimensionHelp[o.id]
		if (help) sc += tokenOverlapScore(norm, help) * (policy.dimension_help_weight ?? 0.35)

		const intentsBlock = semanticRules.intents || {}
		for (const intentName of matchedIntents) {
			const def = intentsBlock[intentName]
			const ow = def?.objective_weights?.[o.id]
			if (typeof ow === "number") sc += ow * (policy.intent_weight_multiplier ?? 1)
		}
		const need = forbid[o.id]
		if (Array.isArray(need) && need.length && !need.some((x) => intentSet.has(x))) {
			sc = 0
		}
		scores.set(o.id, sc)
	}

	const sorted = [...objectives]
		.map((o) => ({ ...o, _s: scores.get(o.id) ?? 0 }))
		.sort((a, b) => b._s - a._s)

	const domainOk =
		aiIsDomainRelevant(text) &&
		(matchedIntents.length > 0 || (sorted[0] && sorted[0]._s >= 2))

	const th = policy.objective_score_threshold ?? 4
	let picked = sorted.filter((o) => o._s >= th).slice(0, SCENARIO_BRANCH_COUNT)
	if (picked.length < SCENARIO_BRANCH_COUNT) {
		const rest = sorted
			.filter((o) => !picked.includes(o))
			.slice(0, SCENARIO_BRANCH_COUNT - picked.length)
		picked = picked.concat(rest)
	}
	picked = picked.slice(0, SCENARIO_BRANCH_COUNT)

	const objectiveIdsForWizard = picked
		.map((o) => o.id)
		.filter((id) => typeof id === "string" && /^G\d+$/i.test(id))

	const goals = []
	for (let i = 0; i < SCENARIO_BRANCH_COUNT; i++) {
		const o = picked[i]
		if (o) goals.push({ id: o.id, name: String(o.name || o.id) })
		else goals.push({ id: `G_PLACEHOLDER_${i}`, name: `Цель ${i + 1}` })
	}

	const suggestedPreset = inferAiFacePresetFromIntents(matchedIntents, norm)
	const summaryLine = goals.map((g) => g.name).join(" · ")
	const semanticWizardSets = buildSemanticWizardSets(
		norm,
		matchedIntents,
		objectiveIdsForWizard,
	)

	return {
		domainOk,
		matchedIntents,
		goals,
		/** Параллельно веткам scenario-1…N: id цели G** или null (не сжимать в список — нужен для графа). */
		goalKeys: goals.map((g) =>
			typeof g.id === "string" && /^G\d+$/i.test(g.id) ? g.id : null,
		),
		suggestedPreset,
		summaryLine,
		normText: norm,
		semanticWizardSets,
	}
}

/**
 * Тексты причин и гипотез под выбранные цели (для подстановки в узлы графа).
 * @param {(string | null | undefined)[]} goalKeys — id вида G01 по веткам; null пропускается
 */
export function buildCauseAndHypothesisLines(goalKeys) {
	const deep = promptDeepCauses && typeof promptDeepCauses === "object" ? promptDeepCauses : {}
	const causes = []
	const hyps = []
	const seenC = new Set()
	const seenH = new Set()

	for (const gid of goalKeys) {
		if (!gid || typeof gid !== "string") continue
		const row = deep[gid]
		if (!row || typeof row !== "object") continue
		for (const c of Array.isArray(row.causes) ? row.causes : []) {
			const t = String(c || "").trim()
			if (!t || seenC.has(t)) continue
			seenC.add(t)
			causes.push(t)
		}
		const infl = Array.isArray(row.influences) ? row.influences : []
		for (const raw of infl) {
			const mapped = mapInfluencePhrase(raw)
			if (!mapped || seenH.has(mapped)) continue
			seenH.add(mapped)
			hyps.push(mapped)
		}
	}

	return { causes, hyps }
}

/**
 * Для каждой ветки цели — полные списки причин и «влияний» из `prompt_deep_causes`
 * (как в prompt-builder / formalizator: без усечения до N/M строк).
 * @param {(string | null | undefined)[]} goalKeys — id вида G01 по позициям scenario-1…N
 */
/**
 * Как в docs/formalizator/prompt-builder.html (`pickHeavyTextIndices`):
 * 1–2 самые «тяжёлые» строки по длине; вторая — если ≥ 0,85 от максимума.
 */
export function pickHeavyTextIndices(arr, maxPick = 2) {
	if (!arr || !arr.length) return []
	const scored = arr.map((t, i) => ({ i, L: String(t || "").length }))
	scored.sort((a, b) => (b.L !== a.L ? b.L - a.L : b.i - a.i))
	const out = [scored[0].i]
	if (
		maxPick >= 2 &&
		scored.length >= 2 &&
		scored[1].L >= scored[0].L * 0.85
	) {
		out.push(scored[1].i)
	}
	return out
}

export function buildPerGoalCauseHypothesisPanels(goalKeys) {
	const deep = promptDeepCauses && typeof promptDeepCauses === "object" ? promptDeepCauses : {}

	const out = []
	for (let gi = 0; gi < SCENARIO_BRANCH_COUNT; gi++) {
		const gid = goalKeys[gi]
		const causes = []
		const hyps = []
		const row =
			gid && deep[gid] && typeof deep[gid] === "object" ? deep[gid] : null
		if (row) {
			for (const c of Array.isArray(row.causes) ? row.causes : []) {
				const t = String(c || "").trim()
				if (t) causes.push(t)
			}
			for (const raw of Array.isArray(row.influences) ? row.influences : []) {
				const m = mapInfluencePhrase(raw)
				if (m) hyps.push(m)
			}
		} else if (gid && /^G\d+$/i.test(String(gid))) {
			causes.push(`Нет блока причин для ${gid} в каталоге prompt_deep_causes.`)
		}
		out.push({ causes, hyps })
	}
	return out
}
