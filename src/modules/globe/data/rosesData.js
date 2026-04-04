/**
 * Данные для роз: производственные этапы и объекты ЦД по этапам.
 */

export const PRODUCTION_STAGES = [
  { name: 'Геологоразведка и работа с ресурсной базой', value: 78, coverage: 78 },
  { name: 'Разработка', value: 82, coverage: 82 },
  { name: 'Планирование и обустройство', value: 80, coverage: 80 },
  { name: 'Бурение и ВСР', value: 88, coverage: 88 },
  { name: 'Добыча', value: 91, coverage: 91 },
]

/** Объекты ЦД по каждому производственному этапу (для правой розы при выборе этапа) */
export const OBJECTS_BY_STAGE = {
  'Геологоразведка и работа с ресурсной базой': [
    { name: 'Сейсмика', value: 85, coverage: 85 },
    { name: 'Скважина разведочная', value: 78, coverage: 78 },
    { name: 'Пласт (оценка)', value: 72, coverage: 72 },
    { name: 'Ловушка', value: 80, coverage: 80 },
    { name: 'Запасы', value: 88, coverage: 88 },
    { name: 'Лицензионный участок', value: 90, coverage: 90 },
  ],
  'Разработка': [
    { name: 'Пласт', value: 86, coverage: 86 },
    { name: 'Скважина', value: 82, coverage: 82 },
    { name: 'Куст', value: 79, coverage: 79 },
    { name: 'Инфраструктура', value: 75, coverage: 75 },
    { name: 'Промысел', value: 84, coverage: 84 },
    { name: 'Объект', value: 81, coverage: 81 },
  ],
  'Планирование и обустройство': [
    { name: 'Куст', value: 79, coverage: 79 },
    { name: 'Инфраструктура', value: 75, coverage: 75 },
    { name: 'Скважина', value: 82, coverage: 82 },
    { name: 'Пласт', value: 86, coverage: 86 },
    { name: 'Промысел', value: 84, coverage: 84 },
    { name: 'Объект', value: 81, coverage: 81 },
  ],
  'Бурение и ВСР': [
    { name: 'Долото', value: 92, coverage: 92 },
    { name: 'Буровая колонна', value: 88, coverage: 88 },
    { name: 'Скважина', value: 90, coverage: 90 },
    { name: 'Куст', value: 85, coverage: 85 },
    { name: 'Забой', value: 87, coverage: 87 },
    { name: 'Обсадная колонна', value: 83, coverage: 83 },
  ],
  'Добыча': [
    { name: 'Пласт', value: 94, coverage: 94 },
    { name: 'Скважина', value: 89, coverage: 89 },
    { name: 'ДНС', value: 80, coverage: 80 },
    { name: 'КНС', value: 76, coverage: 76 },
    { name: 'Трубопровод', value: 83, coverage: 83 },
    { name: 'Куст', value: 87, coverage: 87 },
  ],
}

/** Правая роза по умолчанию (без выбора этапа) — общие ЦД объектов */
export const DEFAULT_OBJECTS = [
  { name: 'Пласт', value: 94, coverage: 94 },
  { name: 'Скважина', value: 89, coverage: 89 },
  { name: 'Инфраструктура', value: 65, coverage: 65 },
  { name: 'Объект', value: 85, coverage: 85 },
  { name: 'Лицензионный участок', value: 90, coverage: 90 },
  { name: 'Куст', value: 87, coverage: 87 },
  { name: 'ДНС', value: 80, coverage: 80 },
  { name: 'КНС', value: 76, coverage: 76 },
  { name: 'Трубопровод', value: 83, coverage: 83 },
]

export function petalColorFromCoverage(coverage) {
  const t = coverage / 100
  if (t >= 0.8) return '#2e9d7a'
  if (t >= 0.5) return '#b8a24a'
  return '#c76b5a'
}
