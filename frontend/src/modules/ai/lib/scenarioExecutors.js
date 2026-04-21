/**
 * Исполнители сценариев ИИ-помощника.
 * Контекст: setActiveTab, setBpmCommand, setResultsDashboardFocus, addThinkingStep, isPaused, navigateToPlanningAfterAi ({ preset, skipNavigation }).
 * Третий аргумент: topic (строка) или { preset, topic } для aiFaceToPlanning.
 */

import { runAiFacePlanningFlow } from './aiFacePlanningFlow.js'

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const STEP_DELAY = 650

/**
 * Создание кейса планирования: главная → мышление → согласование → планирование с доской «бурение/добыча».
 */
export async function createPlanningCase(ctx, topic) {
  await runAiFacePlanningFlow(ctx, 'base_drilling', topic)
}

/** Три готовые кнопки демо: пресет fcf_no_drill | opex_reduction | (createPlanningCase → base_drilling). */
export async function aiFaceToPlanning(ctx, payload) {
  const preset = payload?.preset ?? 'fcf_no_drill'
  const topic = payload?.topic
  const semanticGraphBundle = payload?.semanticGraphBundle
  await runAiFacePlanningFlow({ ...ctx, semanticGraphBundle }, preset, topic)
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
  aiFaceToPlanning,
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
 * @param { string | { preset?: string, topic?: string } } [topicOrMetric] — тема, метрика или payload для aiFaceToPlanning
 */
export async function runScenario(scenarioId, context, topicOrMetric) {
  if (scenarioId === 'aiFaceToPlanning') {
    await aiFaceToPlanning(context, topicOrMetric)
    return
  }
  const fn = EXECUTORS[scenarioId]
  if (!fn) return
  await fn(context, topicOrMetric)
}
