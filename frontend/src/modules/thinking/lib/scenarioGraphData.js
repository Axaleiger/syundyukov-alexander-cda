import { applyWorkflowLayout } from './scenarioGraphLayout.js'

/** Число сценариев-веток; совпадает с текстом в ScenarioAnalysisDashboard */
export const SCENARIO_BRANCH_COUNT = 18

/** Номер оптимального варианта в тексте дашборда и подсветке корня графа */
export const OPTIMAL_SCENARIO_VARIANT = 7

export const optimalScenarioRootId = `scenario-${OPTIMAL_SCENARIO_VARIANT}`

/** Стабильная «случайность» графа при перезагрузке (смените для другого рисунка) */
export const GRAPH_RANDOM_SEED = 0x4cda_7e11

const N = SCENARIO_BRANCH_COUNT

function mulberry32(seed) {
  return function next() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function createRngForGraph(k, graphSalt = 0) {
	const salt = graphSalt >>> 0
	const seed = (GRAPH_RANDOM_SEED ^ salt ^ (Math.imul(k, 0x9e3779b1) >>> 0)) >>> 0
	return mulberry32(seed)
}

/** Роли: контекст → аналитика → ветки → веха → сводка → итог */
const POOL_CONTEXT = [
  'Геооснова: пласт, проницаемость, насыщенность',
  'Перепад давления и гидравлика скважины',
  'CAPEX на заканчивание и конструкция',
  'Программа ГТМ и кандидаты под мероприятия',
  'Прогноз добычи и профиль по скважине',
  'OPEX, электроэнергия и мощность УПСВ',
  'Температура и вязкость в пластовых условиях',
  'Поиск точек под бурение и 3D модель',
  'Оценка рисков по фонду и ПНД',
  'Транспорт, хранение и логистика нефти',
  'Налоги, цена нефти и маржа на баррель',
  'Проектирование ВНС и обустройства',
  'Расчёт экономики блока и IRR',
  'Инфраструктура и ограничения по мощности',
  'Безопасность и контур давления',
  'Данные, моделирование и калибровка',
  'Оптимизация производственной программы',
  'Планирование ремонтов и очередь КРС',
]

const POOL_ANALYSIS_A = [
  'Входные данные: глубина и давление в пласте',
  'Лимит CAPEX по кусту',
  'Тип коллектора и пористость',
  'Кандидаты ГТМ по дебиту',
  'Сценарий заканчивания',
  'Баланс мощности насосного парка',
  'Контур вязкости и температуры',
  'Корреляция сейсмики и скважин',
  'Матрица рисков и допущения',
  'График отгрузки и хранение',
  'Чувствительность к цене нефти',
  'Узлы ВНС и перепады',
  'Денежные потоки по годам',
  'Резерв по инфраструктуре',
  'Паспорт безопасности работ',
  'Качество данных и пробелы',
  'Сдвиги сроков в программе',
  'Приоритет скважин под КРС',
]

const POOL_ANALYSIS_B = [
  'Расчёт профиля добычи (база / пик)',
  'Прогноз OPEX при росте добычи',
  'Проницаемость и фильтрационные потери',
  'NPV пакета ГТМ',
  'Гидравлический расчёт устье-забой',
  'Потери КПД и энергобаланс',
  'Корреляция PVT и дебита',
  'Отбор кандидатов под бурение',
  'Стресс-тест по CAPEX',
  'Стоимость логистики на тонну',
  'Сценарии налоговой нагрузки',
  'Гидраты и температурные режимы',
  'Точка безубыточности и DPP',
  'Узкие места транспорта',
  'Пороги давления для ТРС',
  'Валидация модели на истории',
  'Целевой добытой объём',
  'Срок окупаемости ремонта',
]

const POOL_MILESTONE = [
  'Анализ результата этапа',
  'Оценка рисков и допущений',
  'Сводка экономики (NPV, IRR)',
  'Проверка согласованности данных',
  'Контрольная точка CAPEX/OPEX',
  'Согласование с геомоделью',
]

const POOL_SYNTH = [
  'Сводка ветки: контур OPEX',
  'Сводка ветки: баланс добычи и мощности',
  'Сводка ветки: риски и кандидаты ГТМ',
  'Сводка ветки: CAPEX и заканчивание',
  'Сводка ветки: логистика и маржа',
  'Сводка ветки: ВНС и гидравлика',
  'Сводка ветки: прогноз и цена нефти',
  'Сводка ветки: ремонты и простои',
  'Сводка ветки: согласование блоков модели',
]

const POOL_FINAL = [
  'Итог сценария: NPV и окупаемость',
  'Итог сценария: прирост добычи',
  'Итог сценария: портфель ГТМ',
  'Итог сценария: лимиты и узкие места',
  'Итог сценария: риск-скоринг',
  'Итог сценария: согласованный CAPEX',
  'Итог сценария: операционная программа',
  'Итог сценария: целевые KPI',
  'Итог сценария: решение по ветке',
]

function pick(pool, k, salt) {
  const i = Math.imul(k, 131) ^ salt
  return pool[((i % pool.length) + pool.length) % pool.length]
}

/**
 * Собирает узлы и рёбра колонки k (id вида scenario-k, s{k}-*).
 * Координаты x,y заполняет applyWorkflowLayout.
 */
function buildBranch(k, rng) {
  const sid = `scenario-${k}`
  const themeSalt = (Math.floor(rng() * 4096) ^ (k << 5)) >>> 0

  const nodes = []
  const edges = []
  let maxLevel = 0

  const pc = (slot) => pick(POOL_CONTEXT, k, themeSalt + slot * 3)
  const pa = (slot) => pick(POOL_ANALYSIS_A, k, themeSalt + 17 + slot * 5)
  const pb = (slot) => pick(POOL_ANALYSIS_B, k, themeSalt + 29 + slot * 7)
  const pm = () => pick(POOL_MILESTONE, k, themeSalt + 101)
  const ps = () => pick(POOL_SYNTH, k, themeSalt + 203)
  const pf = () => pick(POOL_FINAL, k, themeSalt + 307)

  const addStep = (id, level, label) => {
    maxLevel = Math.max(maxLevel, level)
    nodes.push({ id, label, type: 'step', x: 0, y: 0, level })
  }
  const addMs = (id, level, label) => {
    maxLevel = Math.max(maxLevel, level)
    nodes.push({ id, label, type: 'milestone', x: 0, y: 0, level })
  }

  const r = rng()
  let template
  if (r < 0.18) template = 'short'
  else if (r < 0.4) template = 'medium'
  else if (r < 0.58) template = 'long'
  else if (r < 0.78) template = 'diamond_early'
  else template = 'diamond_late'

  const wantSynth = rng() > 0.42
  const swapFork = rng() >= 0.5
  const labelLeft = () => (swapFork ? pb(1) : pa(1))
  const labelRight = () => (swapFork ? pa(2) : pb(2))

  if (template === 'short') {
    const u0 = `s${k}-u0`
    const ms = `s${k}-ms`
    const fn = `s${k}-fn`
    addStep(u0, 1, pc(0))
    addMs(ms, 2, pm())
    addMs(fn, 3, pf())
    edges.push({ from: sid, to: u0 }, { from: u0, to: ms }, { from: ms, to: fn })
  } else if (template === 'medium') {
    const u0 = `s${k}-u0`
    const u1 = `s${k}-u1`
    const ms = `s${k}-ms`
    const fn = `s${k}-fn`
    addStep(u0, 1, pc(0))
    addStep(u1, 2, pa(0))
    addMs(ms, 3, pm())
    if (wantSynth) {
      const sy = `s${k}-sy`
      addStep(sy, 4, ps())
      addMs(fn, 5, pf())
      edges.push(
        { from: sid, to: u0 },
        { from: u0, to: u1 },
        { from: u1, to: ms },
        { from: ms, to: sy },
        { from: sy, to: fn }
      )
    } else {
      addMs(fn, 4, pf())
      edges.push({ from: sid, to: u0 }, { from: u0, to: u1 }, { from: u1, to: ms }, { from: ms, to: fn })
    }
  } else if (template === 'long') {
    const u0 = `s${k}-u0`
    const u1 = `s${k}-u1`
    const u2 = `s${k}-u2`
    const ms = `s${k}-ms`
    const sy = `s${k}-sy`
    const fn = `s${k}-fn`
    addStep(u0, 1, pc(0))
    addStep(u1, 2, pa(0))
    addStep(u2, 3, pb(0))
    addMs(ms, 4, pm())
    if (wantSynth) {
      addStep(sy, 5, ps())
      addMs(fn, 6, pf())
      edges.push(
        { from: sid, to: u0 },
        { from: u0, to: u1 },
        { from: u1, to: u2 },
        { from: u2, to: ms },
        { from: ms, to: sy },
        { from: sy, to: fn }
      )
    } else {
      addMs(fn, 5, pf())
      edges.push(
        { from: sid, to: u0 },
        { from: u0, to: u1 },
        { from: u1, to: u2 },
        { from: u2, to: ms },
        { from: ms, to: fn }
      )
    }
  } else if (template === 'diamond_early') {
    const u0 = `s${k}-u0`
    const fa = `s${k}-fa`
    const fb = `s${k}-fb`
    const ms = `s${k}-ms`
    addStep(u0, 1, pc(0))
    addStep(fa, 2, labelLeft())
    addStep(fb, 2, labelRight())
    addMs(ms, 3, pm())
    edges.push(
      { from: sid, to: u0 },
      { from: u0, to: fa },
      { from: u0, to: fb },
      { from: fa, to: ms },
      { from: fb, to: ms }
    )
    if (wantSynth) {
      const sy = `s${k}-sy`
      const fn = `s${k}-fn`
      addStep(sy, 4, ps())
      addMs(fn, 5, pf())
      edges.push({ from: ms, to: sy }, { from: sy, to: fn })
    } else {
      const fn = `s${k}-fn`
      addMs(fn, 4, pf())
      edges.push({ from: ms, to: fn })
    }
  } else {
    /* diamond_late */
    const u0 = `s${k}-u0`
    const u1 = `s${k}-u1`
    const fa = `s${k}-fa`
    const fb = `s${k}-fb`
    const ms = `s${k}-ms`
    addStep(u0, 1, pc(0))
    addStep(u1, 2, pa(0))
    addStep(fa, 3, labelLeft())
    addStep(fb, 3, labelRight())
    addMs(ms, 4, pm())
    edges.push(
      { from: sid, to: u0 },
      { from: u0, to: u1 },
      { from: u1, to: fa },
      { from: u1, to: fb },
      { from: fa, to: ms },
      { from: fb, to: ms }
    )
    if (wantSynth) {
      const sy = `s${k}-sy`
      const fn = `s${k}-fn`
      addStep(sy, 5, ps())
      addMs(fn, 6, pf())
      edges.push({ from: ms, to: sy }, { from: sy, to: fn })
    } else {
      const fn = `s${k}-fn`
      addMs(fn, 5, pf())
      edges.push({ from: ms, to: fn })
    }
  }

  return { nodes, edges, maxLevel }
}

function computeRevealWaves(allNodes, allEdges) {
  const predMap = new Map()
  for (const n of allNodes) predMap.set(n.id, [])
  for (const e of allEdges) {
    if (!predMap.has(e.to)) predMap.set(e.to, [])
    predMap.get(e.to).push(e.from)
  }
  const wave = new Map([['userQuery', 0]])
  let changed = true
  let guard = 0
  while (changed && guard < allNodes.length + 5) {
    guard += 1
    changed = false
    for (const n of allNodes) {
      const preds = predMap.get(n.id) || []
      if (preds.length === 0) continue
      const w = Math.max(...preds.map((p) => wave.get(p) ?? -1)) + 1
      const cur = wave.get(n.id) ?? -1
      if (w > cur) {
        wave.set(n.id, w)
        changed = true
      }
    }
  }
  return wave
}

/**
 * @param {{ graphSalt?: number, queryLabel: string, genLabel: string, optimalVariant: number }} opts
 */
function buildScenarioGraphCore(opts) {
	const { graphSalt = 0, queryLabel, genLabel, optimalVariant } = opts
	const nodes = []
	const edges = []

	nodes.push({
		id: "userQuery",
		label: queryLabel,
		type: "start",
		x: 0,
		y: 0,
	})

	nodes.push({
		id: "generation",
		label: genLabel,
		type: "start",
		x: 0,
		y: 0,
	})
	edges.push({ from: "userQuery", to: "generation" })

	for (let k = 1; k <= N; k++) {
		const rng = createRngForGraph(k, graphSalt)
		const sid = `scenario-${k}`
		nodes.push({
			id: sid,
			label: `Сценарий ${k}`,
			type: "scenario",
			x: 0,
			y: 0,
		})
		edges.push({ from: "generation", to: sid })

		const branch = buildBranch(k, rng)
		for (const n of branch.nodes) {
			const { level: _lv, ...rest } = n
			nodes.push(rest)
		}
		for (const e of branch.edges) edges.push(e)
	}

	const { width: graphWidth, height: graphHeight } = applyWorkflowLayout(nodes, edges)

	const waveMap = computeRevealWaves(nodes, edges)
	for (const n of nodes) {
		n.revealWave = waveMap.get(n.id) ?? 0
	}

	const maxRevealWave = Math.max(...nodes.map((n) => n.revealWave), 0)

	const optimalRootId = `scenario-${optimalVariant}`
	const optimal = computeOptimalScenarioClosure(edges, optimalRootId)

	return { nodes, edges, graphWidth, graphHeight, maxRevealWave, optimal }
}

function computeOptimalScenarioClosure(edges, rootId) {
  const m = /^scenario-(\d+)$/.exec(rootId)
  const k = m ? m[1] : "7"
  const prefix = `s${k}-`
  const inBranch = (id) => id === rootId || id.startsWith(prefix)
  const outs = new Map()
  for (const e of edges) {
    if (!outs.has(e.from)) outs.set(e.from, [])
    outs.get(e.from).push(e.to)
  }
  const nodeIds = new Set([rootId])
  const q = [rootId]
  while (q.length) {
    const u = q.shift()
    for (const v of outs.get(u) || []) {
      if (inBranch(v) && !nodeIds.has(v)) {
        nodeIds.add(v)
        q.push(v)
      }
    }
  }
  nodeIds.add("userQuery")
  nodeIds.add("generation")
  const edgeKeys = new Set()
  for (const e of edges) {
    if (nodeIds.has(e.from) && nodeIds.has(e.to)) edgeKeys.add(`${e.from}|${e.to}`)
  }
  return { nodeIds, edgeKeys }
}

const built = buildScenarioGraphCore({
	graphSalt: 0,
	queryLabel: "Анализ пользовательского запроса",
	genLabel: "Генерация и ранжирование сценариев",
	optimalVariant: OPTIMAL_SCENARIO_VARIANT,
})

/** @param {typeof built} raw @param {string} [visualTone] */
function toScenarioGraphBundle(raw, visualTone = "default") {
	return {
		nodes: raw.nodes,
		edges: raw.edges,
		dimensions: { width: raw.graphWidth, height: raw.graphHeight },
		maxRevealWave: raw.maxRevealWave,
		optimalNodeIds: raw.optimal.nodeIds,
		optimalEdgeKeys: raw.optimal.edgeKeys,
		visualTone,
	}
}

export const defaultScenarioGraphBundle = toScenarioGraphBundle(built, "default")

/** Пресеты ИИ (лицо → планирование): отдельная топология/подписи/акцентная ветка. */
const AI_SCENARIO_GRAPH_PRESETS = {
	base_drilling: {
		queryLabel: "Запрос: добыча и программа бурения",
		genLabel: "Генерация и ранжирование 18 сценариев",
		optimalVariant: 7,
		graphSalt: 0x5a11_0001,
		visualTone: "drilling",
	},
	fcf_no_drill: {
		queryLabel: "Запрос: FCF без новых скважин",
		genLabel: "Ранжирование сценариев CAPEX / FCF",
		optimalVariant: 3,
		graphSalt: 0x7c22_0002,
		visualTone: "fcf",
	},
	opex_reduction: {
		queryLabel: "Запрос: удельный OPEX и энергия",
		genLabel: "Сценарии сжатия OPEX при добыче",
		optimalVariant: 5,
		graphSalt: 0x3e55_0003,
		visualTone: "opex",
	},
}

const presetGraphBundleCache = new Map()

/**
 * Граф для панели «Мышление» new-demo по пресету доски ИИ.
 * @param {string | null | undefined} preset
 */
export function getScenarioGraphBundleForAiPreset(preset) {
	if (!preset || !AI_SCENARIO_GRAPH_PRESETS[preset]) return defaultScenarioGraphBundle
	if (!presetGraphBundleCache.has(preset)) {
		const p = AI_SCENARIO_GRAPH_PRESETS[preset]
		const raw = buildScenarioGraphCore({
			graphSalt: p.graphSalt,
			queryLabel: p.queryLabel,
			genLabel: p.genLabel,
			optimalVariant: p.optimalVariant,
		})
		presetGraphBundleCache.set(preset, toScenarioGraphBundle(raw, p.visualTone))
	}
	return presetGraphBundleCache.get(preset)
}

export const scenarioGraphNodes = built.nodes
export const scenarioGraphEdges = built.edges
export const scenarioGraphDimensions = { width: built.graphWidth, height: built.graphHeight }
export const scenarioMaxRevealWave = built.maxRevealWave
export const optimalScenarioNodeIds = built.optimal.nodeIds
export const optimalScenarioEdgeKeys = built.optimal.edgeKeys

export const recommendations = {
  vnsZbs: [
    'Приоритизировать работы в скважинах с наибольшей вероятностью стабильного прироста.',
    'Запускать мероприятия пакетами, чтобы сократить простой между операциями.',
    'Контролировать стоимость операции на тонну добавленной добычи каждую неделю.',
  ],
  gtm: [
    'Сначала внедрять ГТМ с коротким циклом возврата инвестиций.',
    'Для каждого мероприятия фиксировать целевой прирост и допустимый бюджет.',
    'Корректировать программу ежемесячно по фактическому эффекту и цене нефти.',
  ],
}

export const kpiRows = [
  { metric: 'NPV', value: '13.4 млрд ₽', delta: '+9.8%' },
  { metric: 'IRR', value: '27.1%', delta: '+3.1%' },
  { metric: 'PI', value: '1.42', delta: '+0.08' },
  { metric: 'DPP', value: '2.9 года', delta: '-0.4 года' },
  { metric: 'CAPEX', value: '6.8 млрд ₽', delta: '-3.6%' },
  { metric: 'OPEX', value: '2.1 млрд ₽/год', delta: '+1.2%' },
]
