/**
 * Данные для списка сценариев и фильтров по этапам.
 */

import { PRODUCTION_STAGES } from './rosesData'

export const SCENARIO_STAGE_FILTERS = PRODUCTION_STAGES.map((s) => s.name)

const SCENARIO_NAMES_WITH_STAGE = [
  { name: 'Управление добычей с учетом ближайшего бурения (раздел "Добыча")', stageType: 'Добыча' },
  { name: 'Динамическое управление МТО (раздел "Планирование и обустройство")', stageType: 'Планирование и обустройство' },
  { name: 'Проактивное управление ремонтами и приоритетами (раздел "Бурение и ВСР")', stageType: 'Бурение и ВСР' },
  { name: 'Актуализация и оптимизация ресурсной базы (раздел "Геологоразведка и работа с ресурсной базой")', stageType: 'Геологоразведка и работа с ресурсной базой' },
  { name: 'Управление подрядными работами и сервисами (раздел "Планирование и обустройство")', stageType: 'Планирование и обустройство' },
]
const SCENARIO_NAMES_GENERIC = ['Название сценария 1', 'Название сценария 2', 'Название сценария 3', 'Название сценария 4', 'Название сценария 5']

const STATUSES = ['выполнен', 'в работе', 'на паузе']
const FIELDS = ['Зимнее', 'Новогоднее', 'Аганское']
const FIELD_TO_DO = { 'Зимнее': 'Газпромнефть-Хантос', 'Новогоднее': 'Газпромнефть-ННГ', 'Аганское': 'Газпромнефть-Мегион' }
const AUTHORS = ['Сюндюков А.В.']

let seed = 42
function seededRandom() {
  seed = (seed * 9301 + 49297) % 233280
  return seed / 233280
}
function seededInt(min, max) {
  return Math.floor(seededRandom() * (max - min + 1)) + min
}
function seededChoice(arr) {
  return arr[seededInt(0, arr.length - 1)]
}
function randomDate2026() {
  const month = seededInt(1, 12)
  const day = seededInt(1, 28)
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.2026`
}
function randomTime() {
  const h = seededInt(1, 3)
  const m = seededInt(0, 59)
  return `${h} ч ${m} мин`
}

export function generateScenarios() {
  const withStage = SCENARIO_NAMES_WITH_STAGE.map((item, i) => {
    const field = seededChoice(FIELDS)
    return {
    id: `SC-${17000 + i * 111 + seededInt(0, 99)}`,
    name: item.name,
    stages: seededInt(5, 10),
    do: FIELD_TO_DO[field],
    field,
    status: seededChoice(STATUSES),
    approved: seededRandom() > 0.4,
    dateCreated: randomDate2026(),
    timeCalc: randomTime(),
    dateUpdated: randomDate2026(),
    author: seededChoice(AUTHORS),
    stageType: item.stageType,
  }
  })
  const generic = SCENARIO_NAMES_GENERIC.map((name, i) => {
    const stageFilter = seededChoice(SCENARIO_STAGE_FILTERS)
    const field = seededChoice(FIELDS)
    return {
      id: `SC-${17100 + i * 111 + seededInt(0, 99)}`,
      name,
      stages: seededInt(5, 10),
      do: FIELD_TO_DO[field],
      field,
      status: seededChoice(STATUSES),
      approved: seededRandom() > 0.4,
      dateCreated: randomDate2026(),
      timeCalc: randomTime(),
      dateUpdated: randomDate2026(),
      author: seededChoice(AUTHORS),
      stageType: stageFilter,
    }
  })
  return [...withStage, ...generic]
}

export const PERIOD_OPTIONS = [
  { value: '1m', label: '1 месяц' },
  { value: '3m', label: '3 месяца' },
  { value: '6m', label: '6 месяцев' },
  { value: '1y', label: 'Год' },
  { value: 'custom', label: 'Свой период' },
]
