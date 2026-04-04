/**
 * Генерация умных шагов для кейса планирования через Groq (русский промпт, нефтяная тематика).
 * Ключ только из import.meta.env.VITE_GROQ_API_KEY. При отсутствии ключа или ошибке — статический fallback.
 */

const FALLBACK_STEPS = [
  'Инициация и постановка целей',
  'Сбор и анализ исходных данных',
  'Планирование объёмов и сроков',
  'Назначение ответственных',
  'Согласование с заинтересованными сторонами',
  'Закупки и логистика',
  'Контроль выполнения',
  'Отчётность и корректировка',
  'Итоговая приёмка',
]

const PROMPT_PREFIX = `Ты нефтяник с 20-летним опытом в планировании работ на месторождениях. По теме кейса предложи краткие названия этапов/карточек для доски планирования (от 6 до 12 этапов). Только названия, без нумерации и пояснений. Темы могут быть: ремонт трубопровода, управление базовой добычей, ГРП, КРС, бурение, геологоразведка, обустройство, мониторинг скважин и т.п.
Верни строго JSON в формате: { "steps": ["Этап 1", "Этап 2", ...] }. Только валидный JSON, без markdown и лишнего текста.`

function getApiKey() {
  try {
    // В GitHub Actions передавайте секрет с именем именно VITE_GROQ_API_KEY
    const key = import.meta.env.VITE_GROQ_API_KEY
    const valid = typeof key === 'string' && key.trim().length > 0
    return valid ? key.trim() : null
  } catch {
    return null
  }
}

function isDebugEnabled() {
  try {
    return String(import.meta.env.VITE_AI_DEBUG || '').trim() === '1'
  } catch {
    return false
  }
}

function debugLog(...args) {
  if (!isDebugEnabled()) return
  // eslint-disable-next-line no-console
  console.log('[llmStepGenerator]', ...args)
}

/**
 * Генерирует шаги для кейса по теме через Groq. При отсутствии ключа или ошибке возвращает статический список.
 * @param { string } topic — тема кейса (например "ремонт трубы", "управление базовой добычей")
 * @returns { Promise<string[]> } — массив названий этапов
 */
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'

/**
 * То же, что generateSmartSteps, но возвращает подробный статус для диагностики.
 * @param { string } topic
 * @returns { Promise<{ steps: string[], source: 'groq'|'fallback', reason?: string, httpStatus?: number }> }
 */
export async function generateSmartStepsDetailed(topic) {
  const apiKey = getApiKey()
  if (!apiKey) {
    debugLog('fallback: missing api key')
    return { steps: [...FALLBACK_STEPS], source: 'fallback', reason: 'missing_api_key' }
  }

  const prompt = `${PROMPT_PREFIX}\n\nТема кейса: ${topic || 'планирование'}`

  try {
    const response = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    })

    if (!response.ok) {
      debugLog('fallback: non-ok response', { status: response.status })
      return { steps: [...FALLBACK_STEPS], source: 'fallback', reason: `http_${response.status}`, httpStatus: response.status }
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content?.trim()
    if (!content) {
      debugLog('fallback: empty content')
      return { steps: [...FALLBACK_STEPS], source: 'fallback', reason: 'empty_content' }
    }

    const jsonStr = content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
    let parsed
    try {
      parsed = JSON.parse(jsonStr)
    } catch (e) {
      debugLog('fallback: json parse error', { message: e?.message })
      return { steps: [...FALLBACK_STEPS], source: 'fallback', reason: 'json_parse_error' }
    }

    const steps = Array.isArray(parsed?.steps) ? parsed.steps : FALLBACK_STEPS
    const list = steps.length > 0 ? steps.map((s) => (typeof s === 'string' ? s : String(s))) : FALLBACK_STEPS
    const result = list.slice(0, 12)
    debugLog('groq ok', { count: result.length })
    return { steps: result, source: 'groq' }
  } catch (e) {
    debugLog('fallback: exception', { message: e?.message })
    return { steps: [...FALLBACK_STEPS], source: 'fallback', reason: 'exception' }
  }
}

export async function generateSmartSteps(topic) {
  const detailed = await generateSmartStepsDetailed(topic)
  return detailed.steps
}
