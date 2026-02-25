/**
 * Загрузка данных графика жизненного цикла из Excel.
 * Масштабы относительно бурения: бурение 1, обустройство 0.9, геологоразведка 0.25, добыча 0.4, разработка 0.1.
 */
const COST_SCALE_FACTOR = 2.5
const STAGE_MULTIPLIERS = {
  geologorazvedka: 0.25,
  razrabotka: 0.1,
  planirovanie: 0.9,
  burenie: 1,
  dobycha: 0.4,
}
import * as XLSX from 'xlsx'

function excelSerialToYear(serial) {
  const utc = (serial - 25569) * 86400 * 1000
  return new Date(utc).getUTCFullYear()
}

function toYear(val) {
  if (val == null) return ''
  if (val instanceof Date) return String(val.getFullYear())
  if (typeof val === 'number') {
    if (val > 10000) return String(excelSerialToYear(val))
    return String(Math.round(val))
  }
  const s = String(val).trim().replace(',', '.')
  const n = Number(s)
  if (!Number.isNaN(n)) {
    if (n > 10000) return String(excelSerialToYear(n))
    return String(Math.round(n))
  }
  return String(val)
}

function toNum(val) {
  if (val == null || val === '') return 0
  const s = String(val).trim().replace(',', '.')
  const n = Number(s)
  return Number.isNaN(n) ? 0 : n
}

export function parseLifecycleExcel(arrayBuffer) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', range: 'A2:F102' })
  const out = []
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || []
    const year = toYear(row[0])
    const raw = {
      geologorazvedka: toNum(row[1]) * COST_SCALE_FACTOR * STAGE_MULTIPLIERS.geologorazvedka,
      razrabotka: toNum(row[2]) * COST_SCALE_FACTOR * STAGE_MULTIPLIERS.razrabotka,
      planirovanie: toNum(row[3]) * COST_SCALE_FACTOR * STAGE_MULTIPLIERS.planirovanie,
      burenie: toNum(row[4]) * COST_SCALE_FACTOR * STAGE_MULTIPLIERS.burenie,
      dobycha: toNum(row[5]) * COST_SCALE_FACTOR * STAGE_MULTIPLIERS.dobycha,
    }
    out.push({
      year: year || String(1965 + r),
      ...raw,
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
