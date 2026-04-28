/**
 * LLM-сводка сценария для new-demo через тот же Groq API, что и в ИИ-помощнике.
 * Ключ берётся из import.meta.env.VITE_GROQ_API_KEY (секреты CI / локальный env).
 */

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODELS = ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"]

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

function buildPrompt({
	scenarioLabel,
	hypotheses,
	digitalTwins,
	baselineSummary,
	userQuery,
	goalContext,
}) {
	const hyps = hypotheses?.length ? hypotheses.map((x, i) => `${i + 1}. ${x}`).join("\n") : "—"
	const twins = digitalTwins?.length ? digitalTwins.join(", ") : "—"
	const base = String(baselineSummary || "").trim() || "—"
	const uq = String(userQuery || "").trim() || "—"
	const goal = String(goalContext || "").trim() || "—"
	return `Ты эксперт в нефтегазовом инжиниринге, экономике разработки и управлении активами.
На вход подаются гипотезы и цифровые двойники объектов, через которые эти гипотезы проверяются.
Сформируй короткую инженерную сводку ожидаемого эффекта для месторождения после реализации гипотез.

Требования:
- 3-4 предложения, без списков.
- Русский язык, деловой стиль.
- Пиши сразу по сути, без вступлений.
- Запрещены шаблонные фразы вроде «проверка гипотез показала позитивный сценарий», «выполнен пакет мероприятий», «итог моделирования».
- Первое предложение должно сразу начинаться с конкретного изменения и диапазона эффекта (например, добыча, обводнённость, OPEX, NPV, IRR).
- Обязательно отрази: какие действия/изменения выполнены, как это повлияло на показатели и экономический эффект.
- Указывай ориентировочные диапазоны эффекта там, где это уместно (например: добыча, обводнённость, OPEX, NPV, IRR), и обязательно дай краткое пояснение по рискам.
- Используй только данные из входа. Не придумывай новые инструменты, модели и метрики.
- Не добавляй markdown.
- Если данных недостаточно для точного вывода, аккуратно укажи это («ориентировочно», «вероятно»), но дай практичную интерпретацию.

СЦЕНАРИЙ: ${scenarioLabel}
ГИПОТЕЗЫ:
${hyps}
ЦД ОБЪЕКТЫ: ${twins}
ИСХОДНЫЙ ЗАПРОС ПОЛЬЗОВАТЕЛЯ:
${uq}
КОНТЕКСТ ЦЕЛИ:
${goal}
БАЗОВАЯ РАСЧЁТНАЯ СВОДКА:
${base}

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

/**
 * @param {{ scenarioLabel: string, hypotheses: string[], digitalTwins: string[], baselineSummary: string }} payload
 * @returns {Promise<{summary: string, source: 'groq'|'fallback', reason?: string}>}
 */
export async function generateScenarioSummaryDetailed(payload) {
	const key = getApiKey()
	const fallback = String(payload?.baselineSummary || "").trim()
	if (!key) {
		debugLog("fallback: missing api key")
		return { summary: fallback, source: "fallback", reason: "missing_api_key" }
	}

	try {
		for (let i = 0; i < GROQ_MODELS.length; i++) {
			const model = GROQ_MODELS[i]
			const response = await fetch(GROQ_CHAT_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${key}`,
				},
				body: JSON.stringify({
					model,
					messages: [{ role: "user", content: buildPrompt(payload) }],
					temperature: 0.35,
					max_tokens: 520,
				}),
			})
			if (!response.ok) {
				debugLog("model failed", { model, status: response.status })
				if (i < GROQ_MODELS.length - 1) continue
				return {
					summary: fallback,
					source: "fallback",
					reason: `http_${response.status}`,
				}
			}
			const data = await response.json()
			const content = String(data?.choices?.[0]?.message?.content || "").trim()
			if (!content) {
				debugLog("model empty content", { model })
				if (i < GROQ_MODELS.length - 1) continue
				return { summary: fallback, source: "fallback", reason: "empty_content" }
			}
			const summary = extractSummaryFromModelContent(content)
			if (!summary) {
				debugLog("model empty summary after extract", { model })
				if (i < GROQ_MODELS.length - 1) continue
				return { summary: fallback, source: "fallback", reason: "empty_summary" }
			}
			return { summary, source: "groq" }
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

