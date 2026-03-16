/**
 * Классификатор намерений: русский текст → сценарий + уверенность + извлечённая тема/метрика.
 * Без внешнего API. «Сформируй кейс по X» → createPlanningCase с topic; «упор на NPV» и т.п. → focusMetric.
 */

export const SCENARIO_IDS = {
  createPlanningCase: 'createPlanningCase',
  focusMetric: 'focusMetric',
  buildFullProject: 'buildFullProject',
  analyzeRisks: 'analyzeRisks',
  generateCashflow: 'generateCashflow',
  addConfiguratorNode: 'addConfiguratorNode',
  appendPlanningCard: 'appendPlanningCard',
  addPlanningStage: 'addPlanningStage',
}

const CASE_TRIGGERS = [
  'сформируй кейс',
  'создай кейс',
  'сделай кейс',
  'построй кейс',
  'сформировать кейс',
  'создать кейс',
  'кейс на платформе',
  'новый кейс',
  'завести кейс',
  'добавить кейс',
  'подготовить кейс',
  'развернуть кейс',
  'кейс планирован',
  'планированный кейс',
  'кейс планирования',
  'кейс для планирования',
  // Сквозной бизнес-сценарий / бизнес-процесс через ИИ-помощника
  'сквозной бизнес-сценарий',
  'сквозной сценарий',
  'сквозной бизнес процесс',
  'сквозной бизнес-процесс',
  'сквозной процесс',
]
const TOPIC_PREFIXES = [/по\s+(.+?)(?:\s*$|\s+пожалуйста)/i, /на\s+тему\s+(.+?)(?:\s*$|\s+пожалуйста)/i, /тема[:\s]+(.+?)$/i]

const METRIC_PHRASES = {
  npv: ['npv', 'нпв', 'чистая приведённая стоимость', 'упор на npv', 'фокус на npv', 'дашборд по npv', 'покажи npv'],
  запасы: ['запасы', 'упор на запасы', 'фокус на запасы', 'покажи запасы', 'дашборд по запасам'],
  добыча: ['добыча', 'добычу', 'упор на добычу', 'фокус на добычу', 'покажи добычу', 'дашборд по добыче'],
  irr: ['irr', 'внутренняя норма доходности', 'упор на irr', 'фокус на irr', 'дашборд по irr'],
  payback: ['payback', 'окупаемость', 'срок окупаемости', 'упор на payback', 'фокус на окупаемость'],
  cashflow: ['cashflow', 'кэшфло', 'денежный поток', 'денежные потоки', 'упор на cashflow', 'фокус на cashflow'],
}

function normalize(text) {
  return String(text || '').toLowerCase().trim()
}

function extractTopic(text) {
  const norm = normalize(text)
  for (const re of TOPIC_PREFIXES) {
    const m = norm.match(re)
    if (m && m[1]) return m[1].trim().replace(/\s+/g, ' ')
  }
  const afterKейс = norm.match(/кейс\s+(?:по|на тему|:)\s*(.+?)(?:\s*$|\.|,)/)
  if (afterKейс && afterKейс[1]) return afterKейс[1].trim().replace(/\s+/g, ' ')
  const afterSkvoznoi = norm.match(/сквозн(?:ой|ой\s+бизнес(?:-|\s)сценарий|ой\s+бизнес(?:-|\s)процесс)\s+(?:по|на тему|:)\s*(.+?)(?:\s*$|\.|,)/)
  if (afterSkvoznoi && afterSkvoznoi[1]) return afterSkvoznoi[1].trim().replace(/\s+/g, ' ')
  return null
}

function detectCreatePlanningCase(text) {
  const norm = normalize(text)
  for (const trigger of CASE_TRIGGERS) {
    if (norm.includes(trigger)) return { confidence: 0.95, topic: extractTopic(text) || 'планирование' }
  }
  if (/\bкейс\b/.test(norm) && (/\bсоздай\b|\bсформируй\b|\bсделай\b|\bпострой\b/.test(norm))) {
    return { confidence: 0.95, topic: extractTopic(text) || 'планирование' }
  }
  return null
}

function detectFocusMetric(text) {
  const norm = normalize(text)
  for (const [metric, phrases] of Object.entries(METRIC_PHRASES)) {
    if (phrases.some((p) => norm.includes(p))) return { scenarioId: SCENARIO_IDS.focusMetric, confidence: 0.95, metric }
  }
  if (/\bупор\b|\bфокус\b|\bпокажи\b|\bдашборд\b/.test(norm)) return { scenarioId: SCENARIO_IDS.focusMetric, confidence: 0.85, metric: 'NPV' }
  return null
}

/**
 * Определить сценарий, уверенность и опционально topic/metric.
 * @param { string } text
 * @returns {{ scenarioId: string | null, confidence: number, topic?: string, metric?: string }}
 */
export function classifyIntent(text) {
  const norm = normalize(text)
  if (!norm) return { scenarioId: null, confidence: 0 }

  const caseResult = detectCreatePlanningCase(text)
  if (caseResult) return { scenarioId: SCENARIO_IDS.createPlanningCase, confidence: caseResult.confidence, topic: caseResult.topic }

  const focusResult = detectFocusMetric(text)
  if (focusResult) return focusResult

  const addBlockMatch = norm.match(/добавь\s+блок\s+(.+?)(?:\s*$|\.|,|пожалуйста)/i) || norm.match(/добавить\s+блок\s+(.+?)(?:\s*$|\.|,|пожалуйста)/i)
  if (addBlockMatch && addBlockMatch[1]) {
    return { scenarioId: SCENARIO_IDS.addConfiguratorNode, confidence: 0.95, topic: addBlockMatch[1].trim().replace(/\s+/g, ' ') }
  }
  if (/\bдобавь\s+стадию\b|\bдобавить\s+стадию\b|\bдобавь\s+этап\b|\bдобавить\s+этап\b/i.test(norm)) {
    const nameMatch = norm.match(/(?:стадию|этап)\s+(?:«)?([^»]+?)(?:»)?\s*[.!\s]*$/i) || norm.match(/(?:стадию|этап)\s+(\S+)/i)
    return { scenarioId: SCENARIO_IDS.addPlanningStage, confidence: 0.95, topic: nameMatch?.[1]?.trim() || 'Новая стадия' }
  }

  const phrasesByScenario = {
    [SCENARIO_IDS.buildFullProject]: ['полный проект', 'от идеи до расчёта', 'весь проект', 'полный цикл', 'полный кейс и результаты'],
    [SCENARIO_IDS.analyzeRisks]: ['проанализировать риски', 'риски', 'анализ рисков', 'матрица рисков', 'оценка рисков'],
    [SCENARIO_IDS.generateCashflow]: ['сгенерировать cashflow', 'графики cashflow', 'денежные потоки', 'кэшфло'],
  }
  let best = { scenarioId: null, confidence: 0 }
  for (const [scenarioId, phrases] of Object.entries(phrasesByScenario)) {
    const score = phrases.some((p) => norm.includes(p)) ? 0.9 : 0
    if (score > best.confidence) best = { scenarioId, confidence: score }
  }
  return best
}
