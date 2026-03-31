/**
 * Исполнители сценариев ИИ-помощника.
 * Контекст: setActiveTab, setBpmCommand, setResultsDashboardFocus, addThinkingStep, isPaused.
 * Третий аргумент: topic (для createPlanningCase) или metric (для focusMetric).
 */

import { generateSmartStepsDetailed } from './llmStepGenerator.js'

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const STEP_DELAY = 650

const CASE_INTRO_DURATION_MS = 2500
const DEFAULT_STEPS = [
  'Оценка объёмов', 'Планирование сроков', 'Назначение исполнителей', 'Согласование',
  'Контроль выполнения', 'Отчётность', 'Корректировка плана', 'Итоговая приёмка',
]

const GRAPH_STAGES = ['Подготовка', 'Реализация', 'Контроль']
const GRAPH_SERVICES = [
  'СПЕКТР', 'Б6К', 'EXOIL', 'ЦД well', 'ГибрИМА', 'ЭРА ИСКРА', 'ЭраРемонты', 'ИПА',
  'ЦДРБ', 'Бурение', 'ЦД этапов', 'ЦД объектов', 'Интеграция', 'Аналитика', 'Отчётность',
  'Сервис согласования', 'Хранилище', 'API шлюз', 'Нотификации', 'Дашборд',
]

function getThinkingGraphNodes(topic) {
  const topicLabel = topic || 'планирование'
  return [
    ...GRAPH_STAGES,
    `Кейс: ${topicLabel}`,
    ...DEFAULT_STEPS,
    'Сбор данных', 'Утверждение плана', 'Идентификация рисков', 'Матрица рисков',
    ...GRAPH_SERVICES,
  ]
}

/**
 * Создание кейса планирования: сначала вкладка «Главная страница», гиперкуб раскрывает уровни и ярко подсвечивает древо этапов и точек; затем переход на Планирование и создание карточек.
 */
export async function createPlanningCase(ctx, topic) {
  const { setActiveTab, setShowBpm, setThinkingPhase, setThinkingGraphNodes, addThinkingStep, isPaused, waitForUserConfirm } = ctx
  const topicLabel = topic || 'планирование'

  if (isPaused?.()) return
  if (typeof setThinkingPhase === 'function') setThinkingPhase('brain')
  if (typeof setThinkingGraphNodes === 'function') {
    setThinkingGraphNodes(getThinkingGraphNodes(topicLabel).map((label, i) => ({ id: `g-${i}`, label })))
  }
  addThinkingStep?.('Начинаю с главной страницы…')
  if (typeof setShowBpm === 'function') setShowBpm(false)
  if (typeof setActiveTab === 'function') setActiveTab('face')
  await delay(700)
  if (isPaused?.()) return
  addThinkingStep?.('Формирую цепочку сценария…')
  await delay(900)
  if (isPaused?.()) return
  addThinkingStep?.('Анализ контекста и этапов…')
  await delay(850)
  if (isPaused?.()) return
  addThinkingStep?.('Связи между узлами цепочки…')
  await delay(850)
  if (isPaused?.()) return
  addThinkingStep?.('Валидация цепочки…')
  await delay(850)
  if (isPaused?.()) return
  addThinkingStep?.('Готово к согласованию цепочки.')
  await delay(500)
  if (isPaused?.()) return
  if (typeof waitForUserConfirm === 'function') {
    await waitForUserConfirm(
      'Проверьте цепочку размышлений и нажмите «Согласовать предлагаемый сценарий» — обновится панель «Сравнение сценариев развития актива» справа.',
      { phase: 'brain', refreshScenarioPanel: true }
    )
  } else {
    await delay(800)
  }
  if (isPaused?.()) return

  let steps = DEFAULT_STEPS
  try {
    const generated = await generateSmartStepsDetailed(topicLabel)
    if (Array.isArray(generated?.steps) && generated.steps.length > 0) steps = generated.steps
    if (generated?.source === 'fallback') {
      const reason = generated?.reason ? ` (${generated.reason})` : ''
      addThinkingStep?.(`ИИ-шаги недоступны${reason}. Использую статический список.`)
    }
  } catch (_) {
    steps = DEFAULT_STEPS
    addThinkingStep?.('ИИ-шаги недоступны (exception). Использую статический список.')
  }
  if (isPaused?.()) return
  addThinkingStep?.('Пересчитываю экономику сценариев для выбранного актива…')
  await delay(600)
  if (isPaused?.()) return
  for (let i = 0; i < Math.min(4, steps.length); i += 1) {
    addThinkingStep?.(`Учитываю: ${steps[i]}…`)
    await delay(420)
    if (isPaused?.()) return
  }
  addThinkingStep?.('Сценарии обновлены в панели сравнения справа.')
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
