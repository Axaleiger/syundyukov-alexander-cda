import { stages } from './lifecycleChartConstants'

export function buildCumulative(data) {
  const keys = stages.map((s) => s.key)
  return data.map((row, i) => {
    const out = { year: row.year }
    keys.forEach((key) => {
      let sum = 0
      for (let j = 0; j <= i; j++) sum += data[j][key] ?? 0
      out[key] = sum
    })
    return out
  })
}

/** Лёгкое сглаживание кривой (3 точки) — более реалистичная форма без смены порядка величин. */
export function smoothSeries(arr, key, n = 2) {
  const out = [...arr]
  for (let i = n; i < out.length - n; i++) {
    let sum = 0
    for (let j = -n; j <= n; j++) sum += out[i + j][key] ?? 0
    out[i] = { ...out[i], [key]: Math.round((sum / (2 * n + 1)) * 1000) / 1000 }
  }
  return out
}
