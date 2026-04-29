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

function buildPrompt({
	scenarioLabel,
	hypotheses,
	digitalTwins,
	userQuery,
	goalContext,
	focusHypothesis,
	hypothesisLevers = [],
	previousSummaries = [],
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
- Запрещено выдавать ответ в виде однотипного перечисления пяти–шести показателей подряд без привязки к формулировкам рычагов.
- Русский язык, деловой стиль, без markdown и без нумерованных списков.
- Начинай сразу с сути (первая фраза — про конкретный эффект первого по смыслу рычага).
- Запрещены вступления: «Реализация сценария», «может привести к», «в рамках сценария», «в результате реализации».
- Нельзя: «проверка гипотез показала позитивный сценарий», «выполнен пакет мероприятий», «итог моделирования».
- Не копируй структуру и обороты из предыдущих ответов ниже.
- Допускай разумные диапазоны и условия, опираясь на вход; не выдумывай названий месторождений и контрактов, если их нет во входе.
- Не длиннее ${SUMMARY_MAX_CHARS} символов.

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

export async function generateScenarioSummary(payload) {
	const x = await generateScenarioSummaryDetailed(payload)
	return x.summary
}

