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
export const SCENARIO_DIRECTIONS = [
  'Стратегическое управление и развитие бизнеса', 'Лицензирование и приобретение прав', 'Проектирование разработки месторождений',
  'Проектирование объектов поверхностного обустройства', 'Эксплуатация объектов нефтегазового промысла', 'Инновации и исследования',
  'Геолого-геофизическое изучение недр', 'Геодезия и маркшейдерия', 'Капитальное строительство', 'Энергообеспечение объектов нефтегазового промысла',
  'Газовый бизнес', 'Геоинформационный анализ и картирование', 'Эксплуатационное бурение', 'Внутрискважинные работы, текущий и капитальный ремонт скважин',
  'Логистика и снабжение', 'Управление программами, портфелями и проектами', 'Внешнее взаимодействие и экосистема', 'Управление договорами и организацией закупочных процедур',
  'Интегрированные процессы', 'Промышленная автоматизация и метрология', 'Управление операционной эффективностью', 'Роботизация и автономные технологии',
  'Надежность, технологическое обслуживание и ремонты (ТОиР)', 'Гидрометеорология', 'Промышленная безопасность, охрана здоровья и окружающей среды',
]

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
const DATE_RANGE_START = new Date(2025, 10, 1)
const DATE_RANGE_END = new Date(2026, 2, 1)

function randomDateInRange() {
  const start = DATE_RANGE_START.getTime()
  const end = DATE_RANGE_END.getTime()
  const t = start + seededRandom() * (end - start)
  const d = new Date(t)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
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
      dateCreated: randomDateInRange(),
      timeCalc: randomTime(),
      dateUpdated: randomDateInRange(),
      author: seededChoice(AUTHORS),
      stageType: item.stageType,
      direction: seededChoice(SCENARIO_DIRECTIONS),
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
      dateCreated: randomDateInRange(),
      timeCalc: randomTime(),
      dateUpdated: randomDateInRange(),
      author: seededChoice(AUTHORS),
      stageType: stageFilter,
      direction: seededChoice(SCENARIO_DIRECTIONS),
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

const PERIOD_END = new Date(2026, 2, 1)

function parseScenarioDate(ddMmYyyy) {
  const parts = String(ddMmYyyy).split('.')
  if (parts.length !== 3) return null
  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const year = parseInt(parts[2], 10)
  if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) return null
  return new Date(year, month, day)
}

export function filterScenariosByPeriod(scenarios, periodValue) {
  if (periodValue === 'custom' || !periodValue) return scenarios
  const end = new Date(PERIOD_END)
  let start = new Date(PERIOD_END)
  if (periodValue === '1m') start.setMonth(start.getMonth() - 1)
  else if (periodValue === '3m') start.setMonth(start.getMonth() - 3)
  else if (periodValue === '6m') start.setMonth(start.getMonth() - 6)
  else if (periodValue === '1y') start.setFullYear(start.getFullYear() - 1)
  else return scenarios
  return scenarios.filter((s) => {
    const d = parseScenarioDate(s.dateCreated)
    if (!d) return true
    return d >= start && d <= end
  })
}
