/**
 * Данные для списка сценариев и фильтров по этапам.
 */

import { PRODUCTION_STAGES } from './rosesData'

export const SCENARIO_STAGE_FILTERS = PRODUCTION_STAGES.map((s) => s.name)

const SCENARIO_NAMES = [
  'Выявление и оценка нового запаса',
  'Сквозное управление производительностью актива',
  'Оптимизация добычи и планирование ГТМ',
  'Сквозной цикл строительства скважины',
  'Запуск месторождения в разработку',
  'Название сценария 1',
  'Название сценария 2',
  'Название сценария 3',
  'Название сценария 4',
  'Название сценария 5',
]

const STATUSES = ['выполнен', 'в работе', 'на паузе']
const DO_NAMES = ['Газпромнефть-Хантос', 'Газпромнефть-ННГ', 'Газпромнефть-Мегион']
const FIELDS = ['Зимнее', 'Новогоднее', 'Аганское']
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
  return SCENARIO_NAMES.map((name, i) => {
    const stagesCount = seededInt(5, 10)
    const stageFilter = seededChoice(SCENARIO_STAGE_FILTERS)
    return {
      id: `SC-${17000 + i * 111 + seededInt(0, 99)}`,
      name,
      stages: stagesCount,
      do: seededChoice(DO_NAMES),
      field: seededChoice(FIELDS),
      status: seededChoice(STATUSES),
      approved: seededRandom() > 0.4,
      dateCreated: randomDate2026(),
      timeCalc: randomTime(),
      dateUpdated: randomDate2026(),
      author: seededChoice(AUTHORS),
      stageType: stageFilter,
    }
  })
}

export const PERIOD_OPTIONS = [
  { value: '1m', label: '1 месяц' },
  { value: '3m', label: '3 месяца' },
  { value: '6m', label: '6 месяцев' },
  { value: '1y', label: 'Год' },
  { value: 'custom', label: 'Свой период' },
]
