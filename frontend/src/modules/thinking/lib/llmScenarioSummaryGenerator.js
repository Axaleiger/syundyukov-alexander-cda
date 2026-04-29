/**
 * LLM-сводка сценария для new-demo.
 * Принцип: без baselineSummary, только гипотезы + контекст цели + запрос пользователя.
 */

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function getApiKey() {
	try {
		const key = import.meta.env.VITE_GROQ_API_KEY
		return typeof key === "string" && key.trim() ? key.trim() : null
	} catch {
		return null
	}
}

function isDebugEnabled() {
	try {
		return String(import.meta.env.VITE_AI_DEBUG || "").trim() === "1"
	} catch {
		return false
	}
}

function debugLog(...args) {
	if (!isDebugEnabled()) return
	// eslint-disable-next-line no-console
	console.log("[llmScenarioSummary]", ...args)
}

function normalizeText(s) {
	return String(s || "")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.replace(/\s+/g, " ")
		.trim()
}

function jaccardSimilarity(a, b) {
	const wa = new Set(normalizeText(a).split(" ").filter(Boolean))
	const wb = new Set(normalizeText(b).split(" ").filter(Boolean))
	if (!wa.size || !wb.size) return 0
	let inter = 0
	for (const w of wa) {
		if (wb.has(w)) inter += 1
	}
	const union = wa.size + wb.size - inter
	return union > 0 ? inter / union : 0
}

/** Дробим ключевую гипотезу на смысловые «рычаги» для явной привязки ответа. */
export function extractHypothesisLevers(focusHypothesis) {
	const raw = String(focusHypothesis || "")
		.trim()
		.replace(/\s+/g, " ")
	if (!raw) return []
	const out = []
	const bySemi = raw.split(/;/).map((s) => s.trim()).filter(Boolean)
	if (bySemi.length > 1) {
		for (const s of bySemi) {
			if (s.length > 2) out.push(s)
		}
		return out.slice(0, 10)
	}
	const colon = raw.indexOf(":")
	if (colon > 0 && colon < raw.length - 1) {
		const left = raw.slice(0, colon).trim()
		const right = raw.slice(colon + 1).trim()
		if (left.length > 2) out.push(left)
		for (const chunk of right.split(/\s*,\s*/)) {
			const c = chunk.trim()
			if (c.length > 2) out.push(c)
		}
		return out.length ? out.slice(0, 10) : [raw]
	}
	for (const chunk of raw.split(/\s*,\s*/)) {
		const c = chunk.trim()
		if (c.length > 2) out.push(c)
	}
	return out.length ? out.slice(0, 10) : [raw]
}

const SUMMARY_MAX_CHARS = 380
const RANKING_MAX_SCENARIOS = 12

function buildPrompt({
	scenarioLabel,
	hypotheses,
	digitalTwins,
	userQuery,
	goalContext,
	focusHypothesis,
	hypothesisLevers = [],
	previousSummaries = [],
	enforcePercentRanges = false,
}) {
	const hyps = hypotheses?.length ? hypotheses.map((x, i) => `${i + 1}. ${x}`).join("\n") : "—"
	const levers =
		hypothesisLevers?.length > 0
			? hypothesisLevers.map((x, i) => `${i + 1}. ${x}`).join("\n")
			: "—"
	const twins = digitalTwins?.length ? digitalTwins.join(", ") : "—"
	const uq = String(userQuery || "").trim() || "—"
	const goal = String(goalContext || "").trim() || "—"
	const focus = String(focusHypothesis || "").trim() || "—"
	const prev =
		previousSummaries.length > 0
			? previousSummaries
					.slice(0, 2)
					.map((x, i) => `${i + 1}. ${String(x).slice(0, 200)}`)
					.join("\n")
			: "—"
	return `Ты эксперт в нефтегазовом инжиниринге, экономике разработки и управлении активами.
Твоя задача — по результатам «мысленного» прогона ключевой гипотезы на цифровых двойниках дать короткий вывод: какие эффекты даёт каждый названный рычаг, с оценкой порядка величин.

Формат ответа (не буквально заголовками — связным текстом):
- В 2–3 предложениях свяжи прогноз с РЫЧАГАМИ: если пунктов несколько — назови минимум два из списка ниже своими словами и кратко опиши эффект каждого; если в списке один общий блок — раздели его на две смысловые части (как в тексте гипотезы) и опиши эффект каждой.
- Метрики (добыча, обводнённость, давление, NPV, IRR, OPEX, денежный поток, риск) вплетай в предложения как следствие мер, а не отдельной строкой «добыча x–y%, NPV x–y%…» подряд.
- Для каждого ключевого эффекта обязательно укажи оценочный диапазон в процентах (например, +2–4%, -1–3%) прямо в тексте рядом с эффектом.
- Нужны минимум два числовых диапазона с символом % в ответе.
- Запрещено выдавать ответ в виде однотипного перечисления пяти–шести показателей подряд без привязки к формулировкам рычагов.
- Русский язык, деловой стиль, без markdown и без нумерованных списков.
- Начинай сразу с сути (первая фраза — про конкретный эффект первого по смыслу рычага).
- Запрещены вступления: «Реализация сценария», «может привести к», «в рамках сценария», «в результате реализации».
- Нельзя: «проверка гипотез показала позитивный сценарий», «выполнен пакет мероприятий», «итог моделирования».
- Не копируй структуру и обороты из предыдущих ответов ниже.
- Допускай разумные диапазоны и условия, опираясь на вход; не выдумывай названий месторождений и контрактов, если их нет во входе.
- Не длиннее ${SUMMARY_MAX_CHARS} символов.
${enforcePercentRanges ? "- Критично: верни ответ только если в нем есть минимум два диапазона в %; иначе исправь и дополни оценками." : ""}

СЦЕНАРИЙ: ${scenarioLabel}
КЛЮЧЕВАЯ ГИПОТЕЗА:
${focus}
РЫЧАГИ (ОБЯЗАТЕЛЬНО ИСПОЛЬЗУЙ ИХ ФОРМУЛИРОВКИ В ТЕКСТЕ):
${levers}
ВСЕ ГИПОТЕЗЫ В ВЕТКЕ:
${hyps}
ЦД ОБЪЕКТЫ: ${twins}
ИСХОДНЫЙ ЗАПРОС ПОЛЬЗОВАТЕЛЯ:
${uq}
КОНТЕКСТ ЦЕЛИ:
${goal}
ПРЕДЫДУЩИЕ ОТВЕТЫ (ИЗБЕГАЙ ПОХОЖЕСТИ):
${prev}

Верни строго JSON:
{"summary":"..."}`
}

function hasPercentEstimates(text) {
	const s = String(text || "")
	const rangeMatches = s.match(/\b[+-]?\d+(?:[.,]\d+)?\s*[–-]\s*[+-]?\d+(?:[.,]\d+)?\s*%/g) || []
	const singlePercentMatches = s.match(/\b[+-]?\d+(?:[.,]\d+)?\s*%/g) || []
	return rangeMatches.length >= 1 || singlePercentMatches.length >= 2
}

function extractSummaryFromModelContent(content) {
	const text = String(content || "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim()
	if (!text) return ""
	try {
		const parsed = JSON.parse(text)
		const s = String(parsed?.summary || "").trim()
		if (s) return s
	} catch {
		// no-op
	}
	const jsonLike = text.match(/\{[\s\S]*?"summary"\s*:\s*"([\s\S]*?)"[\s\S]*?\}/)
	if (jsonLike?.[1]) {
		return String(jsonLike[1])
			.replace(/\\"/g, '"')
			.replace(/\\n/g, "\n")
			.trim()
	}
	const m = text.match(/summary\s*:\s*([\s\S]+)/i)
	if (m?.[1]) return String(m[1]).trim()
	return text
}

function extractJsonObjectFromContent(content) {
	const text = String(content || "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim()
	if (!text) return null
	try {
		return JSON.parse(text)
	} catch {
		// no-op
	}
	const m = text.match(/\{[\s\S]*\}/)
	if (!m?.[0]) return null
	try {
		return JSON.parse(m[0])
	} catch {
		return null
	}
}

function makeZeroBaselineFallback(payload) {
	const label = String(payload?.scenarioLabel || "сценарий").trim()
	const twins = Array.isArray(payload?.digitalTwins) && payload.digitalTwins.length
		? payload.digitalTwins.join(", ")
		: "ЦД скважин и пласта"
	const levers = Array.isArray(payload?.hypothesisLevers) ? payload.hypothesisLevers.filter(Boolean) : []
	const a = levers[0] || String(payload?.focusHypothesis || "").trim().slice(0, 140) || "заданных мер"
	const b = levers[1]
	const first = `На ${twins}: «${a}» в модельном контуре даёт рост добычи и денежного потока в умеренных диапазонах; `
	const second = b
		? `часть «${b}» сдвигает профиль обводнённости и OPEX; риск — несогласованность графика работ и логистики.`
		: `NPV и IRR улучшаются при соблюдении поэтапного внедрения; риск — опережающий рост обводнённости и OPEX.`
	let out = (first + second).replace(/\s+/g, " ").trim()
	if (out.length > SUMMARY_MAX_CHARS) {
		out = out.slice(0, SUMMARY_MAX_CHARS)
		const cut = Math.max(out.lastIndexOf("."), out.lastIndexOf("!"), out.lastIndexOf("?"))
		if (cut > 80) out = out.slice(0, cut + 1)
	}
	return out || `Сценарий ${label}: эффекты по гипотезе умеренно позитивны на фоне контроля обводнённости (модель ${twins}).`
}

function compactSummary(raw) {
	let text = String(raw || "").replace(/\s+/g, " ").trim()
	if (!text) return ""
	text = text
		.replace(/^Реализация сценария[^,.!?]*[,.!?]\s*/i, "")
		.replace(/^В рамках сценария[^,.!?]*[,.!?]\s*/i, "")
		.replace(/\bможет привести к\b/gi, "даёт")
		.replace(/\bможет\b/gi, "")
		.replace(/\bв результате реализации\b/gi, "")
		.replace(/\s{2,}/g, " ")
		.trim()
	const sentences = text
		.split(/(?<=[.!?])\s+/)
		.map((s) => s.trim())
		.filter(Boolean)
		.slice(0, 3)
	let out = sentences.join(" ")
	if (out.length > SUMMARY_MAX_CHARS) {
		out = out.slice(0, SUMMARY_MAX_CHARS)
		const cut = Math.max(out.lastIndexOf("."), out.lastIndexOf("!"), out.lastIndexOf("?"))
		if (cut > 120) out = out.slice(0, cut + 1)
	}
	return out.trim()
}

/**
 * @param {{ scenarioLabel: string, hypotheses: string[], digitalTwins: string[], baselineSummary: string }} payload
 * @returns {Promise<{summary: string, source: 'groq'|'fallback', reason?: string}>}
 */
export async function generateScenarioSummaryDetailed(payload) {
	const key = getApiKey()
	const levers =
		Array.isArray(payload?.hypothesisLevers) && payload.hypothesisLevers.length
			? payload.hypothesisLevers
			: extractHypothesisLevers(payload?.focusHypothesis)
	const enrichedPayload = { ...payload, hypothesisLevers: levers }
	const fallback = makeZeroBaselineFallback(enrichedPayload)
	if (!key) {
		debugLog("fallback: missing api key")
		return {
			summary: fallback,
			source: "fallback",
			reason: "missing_api_key",
		}
	}

	try {
		for (let i = 0; i < GROQ_MODELS.length; i++) {
			const model = GROQ_MODELS[i]
			const previousSummaries = Array.isArray(payload?.previousSummaries)
				? payload.previousSummaries.filter(Boolean)
				: []
			for (let attempt = 0; attempt < 3; attempt++) {
				const response = await fetch(GROQ_CHAT_URL, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${key}`,
					},
					body: JSON.stringify({
						model,
						messages: [
							{
								role: "user",
								content: buildPrompt({
									...enrichedPayload,
									previousSummaries,
									enforcePercentRanges: attempt > 0,
								}),
							},
						],
						temperature: attempt === 0 ? 0.95 : 1.1,
						top_p: 0.95,
						max_tokens: 300,
					}),
				})
				if (!response.ok) {
					let errorBody = ""
					try {
						errorBody = String(await response.text()).slice(0, 220)
					} catch {
						// no-op
					}
					debugLog("model failed", { model, status: response.status, errorBody })
					if ((response.status === 429 || response.status >= 500) && attempt < 2) {
						await sleep(450 * (attempt + 1))
						continue
					}
					break
				}
				const data = await response.json()
				const content = String(data?.choices?.[0]?.message?.content || "").trim()
				if (!content) continue
				const summary = compactSummary(extractSummaryFromModelContent(content))
				if (!summary) continue
				if (!hasPercentEstimates(summary) && attempt < 2) {
					debugLog("retry by missing percent estimates", { model, attempt })
					continue
				}
				const maxSim = previousSummaries.reduce(
					(acc, s) => Math.max(acc, jaccardSimilarity(summary, s)),
					0,
				)
				if (previousSummaries.length > 0 && maxSim > 0.9 && attempt === 0) {
					debugLog("retry by similarity", { model, maxSim })
					continue
				}
				return { summary, source: "groq" }
			}
		}
		return {
			summary: compactSummary(fallback),
			source: "fallback",
			reason: "no_model_succeeded",
		}
	} catch (e) {
		debugLog("fallback: exception", e?.message)
		return { summary: compactSummary(fallback), source: "fallback", reason: "exception" }
	}
}

function buildRankingPrompt({ userQuery, scenarios = [] }) {
	const uq = String(userQuery || "").trim() || "—"
	const rows = scenarios
		.slice(0, RANKING_MAX_SCENARIOS)
		.map((s, i) => {
			const id = String(s?.id || "")
			const label = String(s?.label || id || `scenario-${i + 1}`)
			const goal = String(s?.goalContext || "").trim() || "—"
			const focus = String(s?.focusHypothesis || "").trim() || "—"
			const levers =
				Array.isArray(s?.hypothesisLevers) && s.hypothesisLevers.length
					? s.hypothesisLevers.map((x) => String(x).trim()).filter(Boolean).join("; ")
					: "—"
			const summary = String(s?.summary || "").trim() || "—"
			return `ID: ${id}\nНазвание: ${label}\nКонтекст цели: ${goal}\nКлючевая гипотеза: ${focus}\nРычаги: ${levers}\nКраткая оценка: ${summary}`
		})
		.join("\n\n---\n\n")
	return `Ты старший эксперт по выбору оптимального сценария разработки нефтегазового актива.
Нужно сопоставить сценарии между собой и выбрать TOP-1 и TOP-3 исходя из исходного запроса пользователя и ожидаемого баланса: рост добычи/денежного потока/экономики против рисков, сроков, ограничений.

Важно:
- Используй только переданные данные.
- Оцени все сценарии сравнительно.
- score: целое число 0..100 (чем выше, тем лучше).
- Если сценариев меньше 3, top3Ids содержит все доступные id.
- top1Id обязан входить в top3Ids и в scores.

ИСХОДНЫЙ ЗАПРОС ПОЛЬЗОВАТЕЛЯ:
${uq}

СЦЕНАРИИ ДЛЯ СРАВНЕНИЯ:
${rows || "—"}

Верни строго JSON:
{"top1Id":"out-scenario-1","top3Ids":["out-scenario-1","out-scenario-2","out-scenario-3"],"scores":{"out-scenario-1":87,"out-scenario-2":81},"reasoning":"1-2 фразы почему top1 лучше"}`
}

function fallbackRanking(scenarios = []) {
	const sorted = scenarios
		.map((s) => ({ id: String(s?.id || ""), order: Number(/^out-scenario-(\d+)$/.exec(String(s?.id || ""))?.[1] || 0) }))
		.filter((x) => x.id)
		.sort((a, b) => a.order - b.order)
		.map((x) => x.id)
	const top3Ids = sorted.slice(0, Math.min(3, sorted.length))
	const top1Id = top3Ids[0] || null
	const scores = {}
	for (let i = 0; i < sorted.length; i++) {
		scores[sorted[i]] = Math.max(1, 100 - i * 4)
	}
	return { top1Id, top3Ids, scores, reasoning: "", source: "fallback", reason: "fallback_by_id" }
}

function normalizeRanking(raw, allowedIds = new Set()) {
	const top3Raw = Array.isArray(raw?.top3Ids) ? raw.top3Ids : []
	const top3Ids = top3Raw.map((x) => String(x || "").trim()).filter((id) => id && allowedIds.has(id))
	const top1Candidate = String(raw?.top1Id || "").trim()
	const top1Id = allowedIds.has(top1Candidate) ? top1Candidate : top3Ids[0] || null
	const scoresRaw = raw?.scores && typeof raw.scores === "object" ? raw.scores : {}
	const scores = {}
	for (const [k, v] of Object.entries(scoresRaw)) {
		const id = String(k || "").trim()
		if (!id || !allowedIds.has(id)) continue
		const n = Math.round(Number(v))
		if (!Number.isFinite(n)) continue
		scores[id] = Math.max(0, Math.min(100, n))
	}
	if (top1Id && !top3Ids.includes(top1Id)) top3Ids.unshift(top1Id)
	return {
		top1Id,
		top3Ids: top3Ids.slice(0, 3),
		scores,
		reasoning: String(raw?.reasoning || "").trim(),
	}
}

/**
 * @param {{ userQuery?: string, scenarios: Array<{id:string,label?:string,goalContext?:string,focusHypothesis?:string,hypothesisLevers?:string[],summary?:string}> }} payload
 * @returns {Promise<{top1Id: string|null, top3Ids: string[], scores: Record<string, number>, reasoning: string, source: 'groq'|'fallback', reason?: string}>}
 */
export async function rankScenariosDetailed(payload) {
	const scenarios = Array.isArray(payload?.scenarios) ? payload.scenarios.filter((x) => x?.id) : []
	if (!scenarios.length) return fallbackRanking([])
	const fallback = fallbackRanking(scenarios)
	const key = getApiKey()
	if (!key) return { ...fallback, reason: "missing_api_key" }
	const allowedIds = new Set(scenarios.map((x) => String(x.id)))
	const prompt = buildRankingPrompt({ userQuery: payload?.userQuery, scenarios })
	try {
		for (let i = 0; i < GROQ_MODELS.length; i++) {
			const model = GROQ_MODELS[i]
			for (let attempt = 0; attempt < 2; attempt++) {
				const response = await fetch(GROQ_CHAT_URL, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${key}`,
					},
					body: JSON.stringify({
						model,
						messages: [{ role: "user", content: prompt }],
						temperature: attempt === 0 ? 0.35 : 0.2,
						top_p: 0.9,
						max_tokens: 500,
					}),
				})
				if (!response.ok) {
					if ((response.status === 429 || response.status >= 500) && attempt < 1) {
						await sleep(450 * (attempt + 1))
						continue
					}
					break
				}
				const data = await response.json()
				const content = String(data?.choices?.[0]?.message?.content || "").trim()
				const parsed = extractJsonObjectFromContent(content)
				if (!parsed) continue
				const normalized = normalizeRanking(parsed, allowedIds)
				if (!normalized.top1Id || normalized.top3Ids.length === 0) continue
				return { ...normalized, source: "groq" }
			}
		}
		return { ...fallback, reason: "no_model_succeeded" }
	} catch (e) {
		debugLog("ranking fallback: exception", e?.message)
		return { ...fallback, reason: "exception" }
	}
}

export async function generateScenarioSummary(payload) {
	const x = await generateScenarioSummaryDetailed(payload)
	return x.summary
}

