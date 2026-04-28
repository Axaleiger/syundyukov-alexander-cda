/**
 * LLM-сводка сценария для new-demo через тот же Groq API, что и в ИИ-помощнике.
 * Ключ берётся из import.meta.env.VITE_GROQ_API_KEY (секреты CI / локальный env).
 */

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"

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

function buildPrompt({ scenarioLabel, hypotheses, digitalTwins, baselineSummary }) {
	const hyps = hypotheses?.length ? hypotheses.map((x, i) => `${i + 1}. ${x}`).join("\n") : "—"
	const twins = digitalTwins?.length ? digitalTwins.join(", ") : "—"
	const base = String(baselineSummary || "").trim() || "—"
	return `Ты эксперт в нефтегазовом инжиниринге, экономике разработки и управлении активами.
На вход подаются гипотезы и цифровые двойники объектов, через которые эти гипотезы проверяются.
Сформируй короткую инженерную сводку ожидаемого эффекта для месторождения после реализации гипотез.

Требования:
- 3-4 предложения, без списков.
- Русский язык, деловой стиль.
- Пиши сразу по сути, без вступлений и без шаблонов вида «Сценарий N...».
- Обязательно отрази: какие действия/изменения выполнены, как это повлияло на показатели и экономический эффект.
- Используй только данные из входа. Не придумывай новые инструменты, модели и метрики.
- Не добавляй markdown.
- Если данных недостаточно для точного вывода, аккуратно укажи это («ориентировочно», «вероятно»), но дай практичную интерпретацию.

СЦЕНАРИЙ: ${scenarioLabel}
ГИПОТЕЗЫ:
${hyps}
ЦД ОБЪЕКТЫ: ${twins}
БАЗОВАЯ РАСЧЁТНАЯ СВОДКА:
${base}

Верни строго JSON:
{"summary":"..."}`
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
		const response = await fetch(GROQ_CHAT_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${key}`,
			},
			body: JSON.stringify({
				model: "llama-3.1-8b-instant",
				messages: [{ role: "user", content: buildPrompt(payload) }],
				temperature: 0.25,
				max_tokens: 420,
			}),
		})
		if (!response.ok) {
			debugLog("fallback: non-ok response", response.status)
			return {
				summary: fallback,
				source: "fallback",
				reason: `http_${response.status}`,
			}
		}
		const data = await response.json()
		const content = String(data?.choices?.[0]?.message?.content || "").trim()
		if (!content) {
			debugLog("fallback: empty content")
			return { summary: fallback, source: "fallback", reason: "empty_content" }
		}
		const jsonStr = content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()
		let parsed
		try {
			parsed = JSON.parse(jsonStr)
		} catch {
			debugLog("fallback: json parse error")
			return { summary: fallback, source: "fallback", reason: "json_parse_error" }
		}
		const summary = String(parsed?.summary || "").trim()
		if (!summary) {
			debugLog("fallback: empty summary in json")
			return { summary: fallback, source: "fallback", reason: "empty_summary" }
		}
		return { summary, source: "groq" }
	} catch (e) {
		debugLog("fallback: exception", e?.message)
		return { summary: fallback, source: "fallback", reason: "exception" }
	}
}

export async function generateScenarioSummary(payload) {
	const x = await generateScenarioSummaryDetailed(payload)
	return x.summary
}

