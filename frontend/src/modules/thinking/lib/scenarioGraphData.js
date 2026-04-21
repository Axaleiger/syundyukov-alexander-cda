import { applyWorkflowLayout } from './scenarioGraphLayout.js'
import { buildFormalizatorScenarioPools } from './formalizatorScenarioPools.js'
import hypothesisExactPhrase from '../data/prompt-pipeline/hypothesis_exact_phrase.json'

/** Число веток «Цель 1…N» в графе мышления; совпадает с текстом в ScenarioAnalysisDashboard */
export const SCENARIO_BRANCH_COUNT = 4

/** Номер оптимальной цели в тексте дашборда и подсветке корня графа (1…SCENARIO_BRANCH_COUNT) */
export const OPTIMAL_SCENARIO_VARIANT = 2

export const optimalScenarioRootId = `scenario-${OPTIMAL_SCENARIO_VARIANT}`

/** Стабильная «случайность» графа при перезагрузке (смените для другого рисунка) */
export const GRAPH_RANDOM_SEED = 0x4cda_7e11

const N = SCENARIO_BRANCH_COUNT
/** Общее число узлов-причин (по три на каждую цель), нумерация 1…M сверху вниз */
const GLOBAL_CAUSE_COUNT = N * 3
/** Глобальные гипотезы (по две на цель), столбик после причин */
const GLOBAL_HYP_COUNT = N * 2
/** Шары сценариев в зоне справа от гипотез, подписи «Сценарий 1…» по порядку id */
const GLOBAL_OUTCOME_BALL_COUNT = N * 4

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

/** Роли: контекст → аналитика → ветки → веха → сводка → итог (fallback, если formalizator-пулы пусты) */
const FALLBACK_POOL_CONTEXT = [
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

const FALLBACK_POOL_ANALYSIS_A = [
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

const FALLBACK_POOL_ANALYSIS_B = [
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

/** Пулы на каждый вызов buildScenarioGraphCore — JSON уже в бандле, без «застывших» ссылок при HMR. */
function resolveScenarioGraphPools() {
  const fp = buildFormalizatorScenarioPools()
  return {
    context: fp.context?.length ? fp.context : FALLBACK_POOL_CONTEXT,
    analysisA: fp.analysisA?.length ? fp.analysisA : FALLBACK_POOL_ANALYSIS_A,
    analysisB: fp.analysisB?.length ? fp.analysisB : FALLBACK_POOL_ANALYSIS_B,
  }
}

function pick(pool, k, salt) {
  const i = Math.imul(k, 131) ^ salt
  return pool[((i % pool.length) + pool.length) % pool.length]
}

function gatherGlobalCauseBodies(pools, count, seed) {
  const combined = []
  const seen = new Set()
  for (const arr of [pools.analysisA, pools.analysisB, pools.context]) {
    for (const raw of arr) {
      const t = String(raw || '').trim()
      if (!t || seen.has(t)) continue
      seen.add(t)
      combined.push(t)
    }
  }
  const out = []
  let rot = seed >>> 0
  if (combined.length === 0) {
    for (let j = 0; j < count; j++) {
      out.push(pick(FALLBACK_POOL_ANALYSIS_A, 1, rot + j * 7))
    }
    return out
  }
  for (let j = 0; j < count; j++) {
    out.push(combined[rot % combined.length])
    rot = (rot + 9973) >>> 0
  }
  return out
}

/** Три различных индекса 0…m-1 в случайном порядке (детерминированно от rng) */
function pickThreeRandomIndices(rng, m) {
  const out = []
  while (out.length < 3) {
    const x = Math.floor(rng() * m)
    if (!out.includes(x)) out.push(x)
  }
  return out
}

function pickTwoRandomIndices(rng, m) {
  const out = []
  while (out.length < 2) {
    const x = Math.floor(rng() * m)
    if (!out.includes(x)) out.push(x)
  }
  return out
}

function gatherGlobalHypothesisBodies(count, seed) {
  const vals = Object.values(hypothesisExactPhrase).filter((v) => typeof v === 'string' && v.trim())
  const out = []
  let rot = seed >>> 0
  if (vals.length === 0) {
    for (let j = 0; j < count; j++) {
      out.push(pick(FALLBACK_POOL_ANALYSIS_A, 1, rot + j * 11))
    }
    return out
  }
  for (let j = 0; j < count; j++) {
    out.push(vals[rot % vals.length].trim())
    rot = (rot + 7919) >>> 0
  }
  return out
}

/**
 * Рёбра цели k: три случайные причины → две случайные гипотезы. Узлы cause-* / hyp-* — глобальные.
 */
function buildGoalSubgraph(k, rng, pickedZeroBased) {
  const sid = `scenario-${k}`
  const edges = []

  const causeIds = pickedZeroBased.map((i) => `cause-${i + 1}`)
  const pickedHyps = pickTwoRandomIndices(rng, GLOBAL_HYP_COUNT)
  const hypIds = pickedHyps.map((i) => `hyp-${i + 1}`)

  for (const cid of causeIds) {
    edges.push({ from: sid, to: cid })
  }
  for (const cid of causeIds) {
    for (const hid of hypIds) {
      edges.push({ from: cid, to: hid })
    }
  }

  return { nodes: [], edges }
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

const ROOT_QUERY_LABEL = 'Обработка пользовательского запроса'

/**
 * @param {{ graphSalt?: number, optimalVariant: number }} opts
 */
function buildScenarioGraphCore(opts) {
	const { graphSalt = 0, optimalVariant } = opts
	const pools = resolveScenarioGraphPools()
	const nodes = []
	const edges = []

	nodes.push({
		id: "userQuery",
		label: ROOT_QUERY_LABEL,
		detailText: ROOT_QUERY_LABEL,
		type: "start",
		x: 0,
		y: 0,
	})

	const globalBodies = gatherGlobalCauseBodies(
		pools,
		GLOBAL_CAUSE_COUNT,
		(graphSalt ^ 0xa11c0ca) >>> 0,
	)
	for (let i = 0; i < GLOBAL_CAUSE_COUNT; i++) {
		const num = i + 1
		nodes.push({
			id: `cause-${num}`,
			label: `Причина ${num}`,
			detailText: globalBodies[i],
			type: "step",
			x: 0,
			y: 0,
			level: 0,
		})
	}

	const hypBodies = gatherGlobalHypothesisBodies(
		GLOBAL_HYP_COUNT,
		(graphSalt ^ 0x5b710ea) >>> 0,
	)
	for (let i = 0; i < GLOBAL_HYP_COUNT; i++) {
		const num = i + 1
		nodes.push({
			id: `hyp-${num}`,
			label: `Гипотеза ${num}`,
			detailText: hypBodies[i],
			type: "step",
			x: 0,
			y: 0,
			level: 0,
		})
	}

	for (let i = 1; i <= GLOBAL_OUTCOME_BALL_COUNT; i++) {
		const rngBall = createRngForGraph(200 + i, graphSalt)
		const hypPick = pickTwoRandomIndices(rngBall, GLOBAL_HYP_COUNT)
		nodes.push({
			id: `out-scenario-${i}`,
			label: `Сценарий ${i}`,
			detailText: `Сценарий ${i}`,
			type: "outcome",
			x: 0,
			y: 0,
		})
		for (const hi of hypPick) {
			edges.push({ from: `hyp-${hi + 1}`, to: `out-scenario-${i}` })
		}
	}

	for (let k = 1; k <= N; k++) {
		const rng = createRngForGraph(k, graphSalt)
		const sid = `scenario-${k}`
		nodes.push({
			id: sid,
			label: `Цель ${k}`,
			type: "scenario",
			x: 0,
			y: 0,
		})
		edges.push({ from: "userQuery", to: sid })

		const picked = pickThreeRandomIndices(rng, GLOBAL_CAUSE_COUNT)
		const branch = buildGoalSubgraph(k, rng, picked)
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

/** Пересчёт оптимальной ветки после правки рёбер (например семантический бандл). */
export function computeOptimalScenarioClosure(edges, rootId) {
  const m = /^scenario-(\d+)$/.exec(rootId)
  const optK = m ? m[1] : String(OPTIMAL_SCENARIO_VARIANT)
  const branchPrefix = `s${optK}-`
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
      if (nodeIds.has(v)) continue
      if (/^scenario-\d+$/.test(v) && v !== rootId) continue
      if (/^s\d+-/.test(v) && !v.startsWith(branchPrefix)) continue
      nodeIds.add(v)
      q.push(v)
    }
  }
  nodeIds.add("userQuery")
  const edgeKeys = new Set()
  for (const e of edges) {
    if (nodeIds.has(e.from) && nodeIds.has(e.to)) edgeKeys.add(`${e.from}|${e.to}`)
  }
  return { nodeIds, edgeKeys }
}

const built = buildScenarioGraphCore({
	graphSalt: 0,
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
		optimalVariant: 2,
		graphSalt: 0x5a11_0001,
		visualTone: "drilling",
	},
	fcf_no_drill: {
		optimalVariant: 3,
		graphSalt: 0x7c22_0002,
		visualTone: "fcf",
	},
	opex_reduction: {
		optimalVariant: 2,
		graphSalt: 0x3e55_0003,
		visualTone: "opex",
	},
}

/** Номер «оптимальной цели» на графе для пресета лица (подсветка пути). */
export function getOptimalVariantForAiPreset(preset) {
	const p = preset && AI_SCENARIO_GRAPH_PRESETS[preset]
	return p ? p.optimalVariant : OPTIMAL_SCENARIO_VARIANT
}

const presetGraphBundleCache = new Map()

if (import.meta.hot) {
	import.meta.hot.accept('./formalizatorScenarioPools.js', () => {
		presetGraphBundleCache.clear()
	})
}

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
