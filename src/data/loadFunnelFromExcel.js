/**
 * Загрузка сущностей воронки из Excel (файлы в public/).
 * Ожидаемые файлы: hantos.xlsx, nng.xlsx, DATA.xlsx
 * В каждом листе берётся первый столбец с текстом (названия сущностей).
 * Требуемые длины: программы 4, объекты 10, сервисы 30, микросервисы 200, функции 1200.
 */

import * as XLSX from 'xlsx'
import {
  PROGRAMS as defaultPrograms,
  OBJECTS as defaultObjects,
  SERVICES as defaultServices,
  MICROSERVICES as defaultMicroservices,
  FUNCTIONS as defaultFunctions,
} from './funnelEntities'

const REQUIRED_LENGTHS = [4, 10, 30, 200, 1200]
const DEFAULTS = [
  defaultPrograms,
  defaultObjects,
  defaultServices,
  defaultMicroservices,
  defaultFunctions,
]

function readFirstColumnText(sheet) {
  const out = []
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
  for (let R = range.s.r; R <= range.e.r; ++R) {
    const cell = sheet[XLSX.utils.encode_cell({ r: R, c: 0 })]
    if (!cell) continue
    const v = cell.v
    if (v != null && String(v).trim() !== '') {
      out.push(String(v).trim())
    }
  }
  return out
}

function padTo(arr, length, fallbackLabels) {
  if (arr.length >= length) return arr.slice(0, length)
  const result = [...arr]
  for (let i = arr.length; i < length; i++) {
    result.push(fallbackLabels[i] ?? `Сущность ${i + 1}`)
  }
  return result
}

/**
 * Пытается загрузить сущности из Excel.
 * @returns {Promise<{ PROGRAMS, OBJECTS, SERVICES, MICROSERVICES, FUNCTIONS } | null>}
 */
export async function loadFunnelFromExcel() {
  try {
    const files = [
      { url: '/DATA.xlsx', keys: ['programs', 'objects'] },
      { url: '/hantos.xlsx', keys: ['services', 'microservices'] },
      { url: '/nng.xlsx', keys: ['functions'] },
    ]
    const collected = {
      programs: [],
      objects: [],
      services: [],
      microservices: [],
      functions: [],
    }

    for (const { url, keys } of files) {
      const res = await fetch(url)
      if (!res.ok) continue
      const ab = await res.arrayBuffer()
      const wb = XLSX.read(ab, { type: 'array' })
      const sheetNames = wb.SheetNames
      for (let s = 0; s < sheetNames.length && s < keys.length; s++) {
        const sheet = wb.Sheets[sheetNames[s]]
        const texts = readFirstColumnText(sheet)
        const key = keys[s]
        if (key && Array.isArray(collected[key])) collected[key] = texts
      }
    }

    const PROGRAMS = padTo(collected.programs, REQUIRED_LENGTHS[0], defaultPrograms)
    const OBJECTS = padTo(collected.objects, REQUIRED_LENGTHS[1], defaultObjects)
    const SERVICES = padTo(collected.services, REQUIRED_LENGTHS[2], defaultServices)
    const MICROSERVICES = padTo(collected.microservices, REQUIRED_LENGTHS[3], defaultMicroservices)
    const FUNCTIONS = padTo(collected.functions, REQUIRED_LENGTHS[4], defaultFunctions)

    return {
      PROGRAMS,
      OBJECTS,
      SERVICES,
      MICROSERVICES,
      FUNCTIONS,
    }
  } catch (_) {
    return null
  }
}

/**
 * Строит getEntityLabel и POINTS_PER_LEVEL из загруженных массивов.
 */
export function buildFunnelFromEntities(entities) {
  if (!entities) return null
  const lists = [
    entities.PROGRAMS,
    entities.OBJECTS,
    entities.SERVICES,
    entities.MICROSERVICES,
    entities.FUNCTIONS,
  ]
  const POINTS_PER_LEVEL = lists.map((arr) => arr.length)
  const getEntityLabel = (levelIndex, pointIndex) => {
    const list = lists[levelIndex]
    return list ? list[pointIndex] ?? '' : ''
  }
  return { POINTS_PER_LEVEL, getEntityLabel, entities }
}
