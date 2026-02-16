/**
 * Загрузка данных графика жизненного цикла из Excel.
 * Файл: Графики разработки.xlsx — A2:A102 даты, B1:F1 подписи, B2:F102 данные.
 */
import * as XLSX from 'xlsx'

const STAGE_KEYS = ['geologorazvedka', 'razrabotka', 'planirovanie', 'burenie', 'dobycha']

function toYear(val) {
  if (val == null) return ''
  if (typeof val === 'number') return String(Math.round(val))
  if (val instanceof Date) return String(val.getFullYear())
  const n = Number(val)
  if (!Number.isNaN(n)) return String(Math.round(n))
  return String(val)
}

function toNum(val) {
  if (val == null || val === '') return 0
  const n = Number(val)
  return Number.isNaN(n) ? 0 : n
}

export function parseLifecycleExcel(arrayBuffer) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const out = []
  for (let r = 1; r <= 101 && r < rows.length; r++) {
    const row = rows[r] || []
    const year = toYear(row[0])
    out.push({
      year: year || String(1964 + r),
      geologorazvedka: toNum(row[1]),
      razrabotka: toNum(row[2]),
      planirovanie: toNum(row[3]),
      burenie: toNum(row[4]),
      dobycha: toNum(row[5]),
    })
  }
  return out
}

export function loadLifecycleFromExcel(baseUrl) {
  const url = `${baseUrl.replace(/\/$/, '')}/Графики разработки.xlsx`
  return fetch(url)
    .then((r) => r.ok ? r.arrayBuffer() : Promise.reject(new Error('Файл не найден')))
    .then(parseLifecycleExcel)
}
