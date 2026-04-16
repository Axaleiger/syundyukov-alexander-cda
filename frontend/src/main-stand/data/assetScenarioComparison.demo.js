/**
 * Демонстрационные данные для панели «Сравнение сценариев развития актива».
 * Добыча и NPV привязаны к базам гиперкуба (HYPERCUBE_ASSET_BASES).
 * Дельты после ИИ: цвет по ключу метрики (ScenarioMetricRow.deltaIsGoodForMetric).
 *
 * Агрессивный: добыча/NPV/IRR выше остальных сценариев; дельты — рост затрат (2 красных).
 * Рискованный: одна красная дельта (NPV), остальные зелёные.
 * Консенсус: все дельты зелёные, небольшие («потихоньку»); карточка isBest.
 */

import { getHypercubeBaseForAsset } from '../../modules/globe/model/hypercubeAssetBases.js'

export const ASSET_SCENARIO_COMPARISON_SOURCE = 'demo'

function seedFromId(id) {
  let h = 0
  const s = String(id ?? 'default')
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0
  }
  return h
}

function mulberry32(seed) {
  return function next() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function jitter(seed, k, min, max) {
  const rng = mulberry32((seed + k * 0x9e3779b1) >>> 0)
  return min + rng() * (max - min)
}

function round1(x) {
  return Math.round(x * 10) / 10
}

function round2(x) {
  return Math.round(x * 100) / 100
}

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x))
}

function deltaEntry(metricKey, amount) {
  const a = metricKey === 'productionMt' ? round2(amount) : round1(amount)
  let favorable = true
  if (Number.isFinite(a) && a !== 0) {
    if (metricKey === 'capexB' || metricKey === 'opexB') favorable = a < 0
    else favorable = a > 0
  }
  return { amount: a, favorable }
}

/**
 * @returns {{
 *   source: string,
 *   scenarios: Array<{
 *     id: string,
 *     role: 'aggressive'|'risky'|'consensus',
 *     title: string,
 *     isBest: boolean,
 *     metrics: { productionMt: number, capexB: number, opexB: number, npvB: number, irrPct: number },
 *     deltas: Record<string, { amount: number, favorable: boolean }>
 *   }>
 * }}
 */
export function getAssetScenarioComparisonDemo(assetId) {
  const s = seedFromId(assetId)
  const base = getHypercubeBaseForAsset(assetId)
  const P = base.extraction
  const N = base.npv / 1000
  const R = base.reserves

  const Ccap = round1(6 + R * 0.014)
  const Cox = round1(2.8 + R * 0.005)
  const irrBase = round1(
    clamp(10.5 + Math.sqrt(Math.max(0, N)) * 0.48 + jitter(s, 50, -0.35, 0.35), 9, 26),
  )

  const j = (k, lo, hi) => jitter(s, k, lo, hi)

  /** Агрессивный: максимум добычи и NPV, выше затраты */
  const aggressiveMetrics = {
    productionMt: round2(P * (1.08 + j(6, 0, 0.04))),
    npvB: round1(N * (1.06 + j(7, 0, 0.04))),
    capexB: round1(Ccap * (1.1 + j(8, 0, 0.05))),
    opexB: round1(Cox * (1.07 + j(9, 0, 0.04))),
    irrPct: round1(irrBase + j(10, 0.35, 0.75)),
  }

  /** Консенсус: сбалансированно, лучшие затраты; добыча/NPV ниже агрессивного */
  const consensusMetrics = {
    productionMt: round2(P * (1.03 + j(1, 0, 0.025))),
    npvB: round1(N * (1.01 + j(2, 0, 0.035))),
    capexB: round1(Ccap * (0.88 + j(3, 0, 0.035))),
    opexB: round1(Cox * (0.87 + j(4, 0, 0.035))),
    irrPct: round1(irrBase + j(5, 0.18, 0.38)),
  }

  /** Рискованный: слабее по основным показателям */
  const riskyMetrics = {
    productionMt: round2(P * (0.9 + j(11, 0, 0.04))),
    npvB: round1(N * (0.85 + j(12, 0, 0.035))),
    capexB: round1(Ccap * (1.03 + j(13, 0, 0.035))),
    opexB: round1(Cox * (1.04 + j(14, 0, 0.03))),
    irrPct: round1(irrBase + j(15, -0.9, -0.25)),
  }

  return {
    source: ASSET_SCENARIO_COMPARISON_SOURCE,
    scenarios: [
      {
        id: 'aggressive',
        role: 'aggressive',
        title: 'Агрессивный сценарий',
        isBest: false,
        metrics: aggressiveMetrics,
        deltas: {
          productionMt: deltaEntry('productionMt', j(111, 0.07, 0.16)),
          npvB: deltaEntry('npvB', j(114, 0.18, 0.38)),
          irrPct: deltaEntry('irrPct', j(115, 0.22, 0.48)),
          capexB: deltaEntry('capexB', j(112, 0.14, 0.32)),
          opexB: deltaEntry('opexB', j(113, 0.07, 0.15)),
        },
      },
      {
        id: 'risky',
        role: 'risky',
        title: 'Рискованный сценарий',
        isBest: false,
        metrics: riskyMetrics,
        deltas: {
          npvB: deltaEntry('npvB', j(124, -0.22, -0.08)),
          productionMt: deltaEntry('productionMt', j(121, 0.04, 0.1)),
          capexB: deltaEntry('capexB', j(122, -0.2, -0.08)),
          opexB: deltaEntry('opexB', j(123, -0.14, -0.05)),
          irrPct: deltaEntry('irrPct', j(125, 0.12, 0.28)),
        },
      },
      {
        id: 'consensus',
        role: 'consensus',
        title: 'Консенсусный сценарий',
        isBest: true,
        metrics: consensusMetrics,
        deltas: {
          productionMt: deltaEntry('productionMt', j(101, 0.02, 0.05)),
          capexB: deltaEntry('capexB', j(102, -0.11, -0.05)),
          opexB: deltaEntry('opexB', j(103, -0.08, -0.04)),
          npvB: deltaEntry('npvB', j(104, 0.06, 0.14)),
          irrPct: deltaEntry('irrPct', j(105, 0.08, 0.16)),
        },
      },
    ],
  }
}

export const SCENARIO_METRIC_DEFS = [
  { key: 'productionMt', label: 'Добыча', unit: 'млн т', decimals: 2 },
  { key: 'capexB', label: 'CAPEX', unit: 'млрд ₽', decimals: 1 },
  { key: 'opexB', label: 'OPEX', unit: 'млрд ₽', decimals: 1 },
  { key: 'npvB', label: 'NPV', unit: 'млрд ₽', decimals: 1 },
  { key: 'irrPct', label: 'IRR', unit: '%', decimals: 1 },
]
