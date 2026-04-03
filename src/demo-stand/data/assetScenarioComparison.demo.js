/**
 * Демонстрационные данные для панели «Сравнение сценариев развития актива».
 * Не подставлять как боевые цифры — заменить загрузкой из API при появлении backend.
 */

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

/** Случайное смещение в диапазоне, детерминированно от seed */
function jitter(seed, k, min, max) {
  const rng = mulberry32((seed + k * 0x9e3779b1) >>> 0)
  return min + rng() * (max - min)
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

  const productionMt = 2.35 + jitter(s, 1, 0, 1.85)
  const capexB = 9.2 + jitter(s, 2, 0, 6.5)
  const opexB = 3.4 + jitter(s, 3, 0, 2.8)
  const npvB = 18 + jitter(s, 4, 0, 22)
  const irrPct = 14 + jitter(s, 5, 0, 9)

  const off = (k, m, mx) => jitter(s, 10 + k, m, mx)

  return {
    source: ASSET_SCENARIO_COMPARISON_SOURCE,
    scenarios: [
      {
        id: 'aggressive',
        role: 'aggressive',
        title: 'Агрессивный сценарий',
        isBest: false,
        metrics: {
          productionMt: productionMt + off(1, 0.35, 0.85),
          capexB: capexB + off(2, 1.2, 3.8),
          opexB: opexB + off(3, 0.15, 0.55),
          npvB: npvB + off(4, 2, 9),
          irrPct: irrPct + off(5, 0.8, 3.2),
        },
        deltas: {
          productionMt: { amount: off(11, 0.04, 0.18), favorable: true },
          capexB: { amount: off(12, 0.35, 1.6), favorable: false },
          opexB: { amount: off(13, -0.12, -0.02), favorable: true },
          npvB: { amount: off(14, 0.4, 2.8), favorable: true },
          irrPct: { amount: off(15, -1.1, -0.15), favorable: false },
        },
      },
      {
        id: 'risky',
        role: 'risky',
        title: 'Рискованный сценарий',
        isBest: false,
        metrics: {
          productionMt: productionMt + off(6, 0.05, 0.42),
          capexB: capexB + off(7, 0.2, 1.4),
          opexB: opexB + off(8, 0.05, 0.35),
          npvB: npvB + off(9, -2, 4),
          irrPct: irrPct + off(10, -0.5, 1.8),
        },
        deltas: {
          productionMt: { amount: off(21, -0.06, 0.1), favorable: true },
          capexB: { amount: off(22, -0.2, 0.45), favorable: true },
          opexB: { amount: off(23, 0.08, 0.28), favorable: false },
          npvB: { amount: off(24, -1.8, 0.9), favorable: false },
          irrPct: { amount: off(25, -0.9, 0.4), favorable: false },
        },
      },
      {
        id: 'consensus',
        role: 'consensus',
        title: 'Консенсусный сценарий',
        isBest: true,
        metrics: {
          productionMt,
          capexB,
          opexB,
          npvB,
          irrPct,
        },
        deltas: {
          productionMt: { amount: off(31, 0.06, 0.14), favorable: true },
          capexB: { amount: off(32, -0.55, -0.08), favorable: true },
          opexB: { amount: off(33, -0.22, -0.04), favorable: true },
          npvB: { amount: off(34, 1.0, 3.2), favorable: true },
          irrPct: { amount: off(35, 0.2, 1.1), favorable: true },
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
