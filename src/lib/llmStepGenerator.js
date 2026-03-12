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

/**
 * Генерирует шаги для кейса по теме через Groq. При отсутствии ключа или ошибке возвращает статический список.
 * @param { string } topic — тема кейса (например "ремонт трубы", "управление базовой добычей")
 * @returns { Promise<string[]> } — массив названий этапов
 */
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'

export async function generateSmartSteps(topic) {
  const apiKey = getApiKey()
  if (!apiKey) return [...FALLBACK_STEPS]

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

    if (!response.ok) return [...FALLBACK_STEPS]

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content?.trim()
    if (!content) return [...FALLBACK_STEPS]

    const jsonStr = content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
    const parsed = JSON.parse(jsonStr)
    const steps = Array.isArray(parsed?.steps) ? parsed.steps : FALLBACK_STEPS

    const list = steps.length > 0 ? steps.map((s) => (typeof s === 'string' ? s : String(s))) : FALLBACK_STEPS
    return list.slice(0, 12)
  } catch {
    return [...FALLBACK_STEPS]
  }
}
