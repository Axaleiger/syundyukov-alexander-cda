/**
 * LLM-сводка сценария для new-demo.
 * Принцип: без baselineSummary, только гипотезы + контекст цели + запрос пользователя.
 */

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]

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

function buildPrompt({
	scenarioLabel,
	hypotheses,
	digitalTwins,
	userQuery,
	goalContext,
	previousSummaries = [],
}) {
	const hyps = hypotheses?.length ? hypotheses.map((x, i) => `${i + 1}. ${x}`).join("\n") : "—"
	const twins = digitalTwins?.length ? digitalTwins.join(", ") : "—"
	const uq = String(userQuery || "").trim() || "—"
	const goal = String(goalContext || "").trim() || "—"
	const prev =
		previousSummaries.length > 0
			? previousSummaries.map((x, i) => `${i + 1}. ${x}`).join("\n")
			: "—"
	return `Ты эксперт в нефтегазовом инжиниринге, экономике разработки и управлении активами.
Твоя задача — выдать живой и непохожий на другие прогноз для конкретного сценария.

Требования:
- 3-4 предложения, без списков.
- Русский язык, деловой стиль.
- Начинай сразу с технического эффекта в диапазоне (добыча/обводнённость/давление).
- Отдельно дай экономику диапазонами (NPV/IRR/OPEX/денежный поток).
- Обязательно дай риск и условие реализации.
- Нельзя использовать шаблонные фразы:
  «проверка гипотез показала позитивный сценарий»,
  «выполнен пакет мероприятий»,
  «итог моделирования».
- Не повторяй стиль и формулировки предыдущих сценариев.
- Используй только входные данные, но при нехватке данных формулируй ориентировочный инженерный вывод.
- Не добавляй markdown.

СЦЕНАРИЙ: ${scenarioLabel}
ГИПОТЕЗЫ:
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
	const n = Math.max(1, (payload?.hypotheses || []).length)
	const twins = Array.isArray(payload?.digitalTwins) && payload.digitalTwins.length
		? payload.digitalTwins.join(", ")
		: "ЦД скважин и пласта"
	return [
		`По сценарию ${label} ориентировочно ожидается неравномерный прирост добычи при реализации ${n} гипотез, проверяемых через ${twins}.`,
		`Экономически вероятен положительный сдвиг по NPV и денежному потоку при контролируемом росте операционных затрат на этапе разгона.`,
		`Ключевой риск — ускорение обводнённости по части фонда, поэтому эффект подтверждается только при поэтапном внедрении и контроле факта.`,
	].join(" ")
}

/**
 * @param {{ scenarioLabel: string, hypotheses: string[], digitalTwins: string[], baselineSummary: string }} payload
 * @returns {Promise<{summary: string, source: 'groq'|'fallback', reason?: string}>}
 */
export async function generateScenarioSummaryDetailed(payload) {
	const key = getApiKey()
	const fallback = makeZeroBaselineFallback(payload)
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
			for (let attempt = 0; attempt < 2; attempt++) {
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
								content: buildPrompt({ ...payload, previousSummaries }),
							},
						],
						temperature: attempt === 0 ? 0.95 : 1.1,
						top_p: 0.95,
						max_tokens: 520,
					}),
				})
				if (!response.ok) {
					debugLog("model failed", { model, status: response.status })
					break
				}
				const data = await response.json()
				const content = String(data?.choices?.[0]?.message?.content || "").trim()
				if (!content) continue
				const summary = extractSummaryFromModelContent(content)
				if (!summary) continue
				const maxSim = previousSummaries.reduce(
					(acc, s) => Math.max(acc, jaccardSimilarity(summary, s)),
					0,
				)
				if (maxSim > 0.72 && attempt === 0) {
					debugLog("retry by similarity", { model, maxSim })
					continue
				}
				return { summary, source: "groq" }
			}
		}
		return { summary: fallback, source: "fallback", reason: "no_model_succeeded" }
	} catch (e) {
		debugLog("fallback: exception", e?.message)
		return { summary: fallback, source: "fallback", reason: "exception" }
	}
}

export async function generateScenarioSummary(payload) {
	const x = await generateScenarioSummaryDetailed(payload)
	return x.summary
}

