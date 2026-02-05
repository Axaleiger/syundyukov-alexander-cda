/**
 * Сущности по слоям воронки сквозных сценариев.
 * Программы: 4, Объекты: 10, Сервисы: 30, Микросервисы: 200, Функции: 1200.
 * Данные можно заменить экспортом из Excel (hantos.xlsx, nng.xlsx, DATA.xlsx).
 */

export const PROGRAMS = ['ЦД РБ', 'ЦД ПР', 'ЦД АВНМ', 'ЦД П']

export const OBJECTS = [
  'Пласт',
  'Скважина',
  'Промысел',
  'Инфраструктура',
  'Куст',
  'ДНС',
  'КНС',
  'Трубопровод',
  'Лицензионный участок',
  'Объект',
]

const SERVICES_BASE = ['Б6К', 'СпекТР', 'КФА', 'eXoil', 'ГибРИМА', 'ЦДРБ', 'АВНМ', 'ЦДП', 'ЦДПр', 'Сервис ГТМ']
export const SERVICES = [
  ...SERVICES_BASE,
  ...Array.from({ length: 30 - SERVICES_BASE.length }, (_, i) => `Сервис ${i + 1}`),
].slice(0, 30)

export const MICROSERVICES = Array.from({ length: 200 }, (_, i) => `Микросервис ${i + 1}`)

const FUNCTION_TEMPLATES = [
  'Расчёт пластовых давлений',
  'Моделирование фильтрации',
  'Оптимизация режима работы',
  'Прогноз добычи',
  'Анализ ГД модели',
  'Управление режимом',
]
export const FUNCTIONS = Array.from(
  { length: 1200 },
  (_, i) => `${FUNCTION_TEMPLATES[i % 6]} (${Math.floor(i / 6) + 1})`
)

export const FUNNEL_ENTITY_LABELS = {
  programs: PROGRAMS,
  objects: OBJECTS,
  services: SERVICES,
  microservices: MICROSERVICES,
  functions: FUNCTIONS,
}

export const POINTS_PER_LEVEL = [
  PROGRAMS.length,
  OBJECTS.length,
  SERVICES.length,
  MICROSERVICES.length,
  FUNCTIONS.length,
]

export function getEntityLabel(levelIndex, pointIndex) {
  const lists = [PROGRAMS, OBJECTS, SERVICES, MICROSERVICES, FUNCTIONS]
  const list = lists[levelIndex]
  return list ? list[pointIndex] : ''
}
