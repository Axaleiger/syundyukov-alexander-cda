/**
 * Исполнители сценариев ИИ-помощника.
 * Контекст: setActiveTab, setBpmCommand, setResultsDashboardFocus, addThinkingStep, isPaused.
 * Третий аргумент: topic (для createPlanningCase) или metric (для focusMetric).
 */

import { generateSmartSteps } from './llmStepGenerator.js'

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const STEP_DELAY = 650

const CASE_INTRO_DURATION_MS = 2800

/**
 * Создание кейса планирования: сначала вкладка «Главная страница», гиперкуб раскрывает уровни и ярко подсвечивает древо этапов и точек; затем переход на Планирование и создание карточек.
 */
export async function createPlanningCase(ctx, topic) {
  const { setActiveTab, setBpmCommand, setHypercubeCaseIntro, setShowBpm, addThinkingStep, isPaused } = ctx
  const topicLabel = topic || 'планирование'

  if (isPaused?.()) return
  addThinkingStep?.('Начинаю с главной страницы…')
  setShowBpm?.(false)
  setActiveTab?.('face')
  await delay(300)
  if (isPaused?.()) return
  addThinkingStep?.('Раскрываю дерево этапов и связей в гиперкубе…')
  setHypercubeCaseIntro?.(true)
  await delay(CASE_INTRO_DURATION_MS)
  if (isPaused?.()) return
  setHypercubeCaseIntro?.(false)
  addThinkingStep?.('Переход к планированию…')
  setActiveTab?.('planning')
  await delay(400)
  if (isPaused?.()) return
  addThinkingStep?.('Анализирую запрос: «' + topicLabel + '»…')

  const steps = await generateSmartSteps(topicLabel)
  if (isPaused?.()) return
  addThinkingStep?.('Создаю карточки по теме «' + topicLabel + '»…')

  setBpmCommand?.({ scenarioId: 'createPlanningCase', params: { topic: topicLabel, steps } })

  for (let i = 0; i < (steps?.length ?? 0); i++) {
    if (isPaused?.()) return
    addThinkingStep?.('Добавляю: ' + (steps[i] ?? ''))
    await delay(STEP_DELAY)
  }
}

/**
 * Фокус на метрику: вкладка «Результаты» + setResultsDashboardFocus(metric, explanation).
 */
export async function focusMetric(ctx, metric) {
  const { setActiveTab, setResultsDashboardFocus, addThinkingStep, isPaused } = ctx
  const m = (metric || 'NPV').toLowerCase()
  const labels = {
    npv: 'NPV',
    запасы: 'запасы',
    добыча: 'добыча',
    irr: 'IRR',
    payback: 'срок окупаемости',
    cashflow: 'cashflow',
  }
  const metricLabel = labels[m] || metric || 'NPV'
  addThinkingStep?.('Переключаю на вкладку «Результаты»…')
  setActiveTab?.('results')
  await delay(STEP_DELAY)
  if (isPaused?.()) return
  addThinkingStep?.('Применяю фокус на «' + metricLabel + '»…')
  setResultsDashboardFocus?.({ metric: metricLabel, explanation: 'Дашборд по метрике «' + metricLabel + '» по вашему запросу' })
  await delay(400)
  if (isPaused?.()) return
  addThinkingStep?.('Готово ✓')
}

/** Упор на NPV — делегируем focusMetric. */
export async function focusNPV(ctx, metric) {
  return focusMetric(ctx, metric || 'NPV')
}

export async function buildFullProject(ctx, topicOrMetric) {
  const { setActiveTab, setBpmCommand, setResultsDashboardFocus, addThinkingStep, isPaused } = ctx
  addThinkingStep?.('Формирую полный проект от идеи до расчёта…')
  setActiveTab?.('planning')
  setBpmCommand?.({ scenarioId: 'createPlanningCase', params: { topic: topicOrMetric || 'полный проект' } })
  await delay(STEP_DELAY)
  if (isPaused?.()) return
  addThinkingStep?.('Открываю результаты и настраиваю дашборд…')
  setActiveTab?.('results')
  setResultsDashboardFocus?.({ metric: 'NPV', explanation: 'Полный проект: фокус на ключевых метриках' })
  await delay(STEP_DELAY)
  if (isPaused?.()) return
  addThinkingStep?.('Готово ✓')
}

export async function analyzeRisks(ctx) {
  const { setActiveTab, setBpmCommand, addThinkingStep, isPaused } = ctx
  addThinkingStep?.('Открываю планирование…')
  setActiveTab?.('planning')
  await delay(STEP_DELAY)
  if (isPaused?.()) return
  addThinkingStep?.('Добавляю карточки по рискам и матрицу рисков…')
  setBpmCommand?.({ scenarioId: 'analyzeRisks', params: {} })
  await delay(STEP_DELAY)
  if (isPaused?.()) return
  addThinkingStep?.('Готово ✓')
}

export async function generateCashflow(ctx) {
  const { setActiveTab, setBpmCommand, setResultsDashboardFocus, addThinkingStep, isPaused } = ctx
  addThinkingStep?.('Готовлю финансовые карточки на доске…')
  setActiveTab?.('planning')
  setBpmCommand?.({ scenarioId: 'generateCashflow', params: {} })
  await delay(STEP_DELAY)
  if (isPaused?.()) return
  addThinkingStep?.('Открываю графики денежных потоков…')
  setActiveTab?.('results')
  setResultsDashboardFocus?.({ metric: 'cashflow', explanation: 'Фокус на cashflow и графиках по вашему запросу' })
  await delay(STEP_DELAY)
  if (isPaused?.()) return
  addThinkingStep?.('Готово ✓')
}

export async function addConfiguratorNode(ctx, label) {
  const { setActiveTab, setConfiguratorNodeCommand, addThinkingStep, isPaused } = ctx
  const name = label || 'Новый блок'
  addThinkingStep?.('Добавляю блок «' + name + '» на схему…')
  setActiveTab?.('ontology')
  setConfiguratorNodeCommand?.({ label: name })
  await delay(STEP_DELAY)
  if (isPaused?.()) return
  addThinkingStep?.('Готово ✓')
}

export async function appendPlanningCard(ctx, topic) {
  const { setActiveTab, setBpmCommand, addThinkingStep, isPaused } = ctx
  addThinkingStep?.('Добавляю карточку в кейс…')
  setActiveTab?.('planning')
  setBpmCommand?.({ scenarioId: 'appendPlanningCard', params: { topic: topic || 'планирование' } })
  await delay(STEP_DELAY)
  if (isPaused?.()) return
  addThinkingStep?.('Готово ✓')
}

export async function addPlanningStage(ctx, stageName) {
  const { setActiveTab, setBpmCommand, addThinkingStep, isPaused } = ctx
  const name = stageName || 'Новая стадия'
  addThinkingStep?.('Добавляю стадию «' + name + '» на доску…')
  setActiveTab?.('planning')
  setBpmCommand?.({ scenarioId: 'addPlanningStage', params: { name } })
  await delay(STEP_DELAY)
  if (isPaused?.()) return
  addThinkingStep?.('Готово ✓')
}

const EXECUTORS = {
  createPlanningCase,
  focusMetric,
  focusNPV,
  buildFullProject,
  analyzeRisks,
  generateCashflow,
  addConfiguratorNode,
  appendPlanningCard,
  addPlanningStage,
}

/**
 * Запустить исполнитель по ID сценария.
 * @param { string } scenarioId
 * @param { object } context
 * @param { string } [topicOrMetric] — тема для кейса или метрика для focusMetric
 */
export async function runScenario(scenarioId, context, topicOrMetric) {
  const fn = EXECUTORS[scenarioId]
  if (!fn) return
  await fn(context, topicOrMetric)
}
