/**
 * Сущности по слоям воронки сквозных сценариев.
 * Программы: 5, Объекты: как в «2. Цифровые двойники объектов» (new-demo), Сервисы: 30; микросервисы и функции — длины из microservicesFunnel / functionsFunnel (6 функций на микросервис).
 * Данные можно заменить экспортом из Excel (hantos.xlsx, nng.xlsx, DATA.xlsx).
 */

import { NEW_DEMO_CD_OBJECT_TWIN_NAMES } from './newDemoCdObjectTwins.js'
import { MICROSERVICES } from './microservicesFunnel.js'
import { FUNCTIONS } from './functionsFunnel.js'

export const PROGRAMS = ['ЦД РБ', 'ЦД ПР', 'ЦД АВНМ', 'ЦД П', 'ЦД РиД']

/** Полные названия для подписей уровня «ЦД программ» (панель процентов, легенда). */
export const CD_PROGRAM_DISPLAY_NAMES = {
  'ЦД П': 'Цифровой двойник промысла',
  'ЦД АВНМ': 'Цифровой двойник новых мощностей',
  'ЦД ПР': 'Цифровой двойник проектных решений',
  'ЦД РБ': 'Цифровой двойник ресурсной базы',
  'ЦД РиД': 'Цифровой двойник разведки и добычи',
}

export function getCdProgramDisplayName(shortLabel) {
  if (!shortLabel) return ''
  return CD_PROGRAM_DISPLAY_NAMES[shortLabel] ?? shortLabel
}

/** Уровень «ЦД объекта» гиперкуба = список из раздела зрелости «2. Цифровые двойники объектов». */
export const OBJECTS = [...NEW_DEMO_CD_OBJECT_TWIN_NAMES]

/**
 * Уровень «Сервисы» гиперкуба (30 позиций).
 * Без дублей с уровнем «ЦД программ» (ЦДРБ/ЦДП/…); без «Сервис ГТМ» (пересечение со СпекТР).
 * Середина списка — имена из корпоративного перечня (DUO Tech, ПЛУТОН, …).
 */
export const SERVICES = [
  'Пласт-ПРО (Б6К)',
  'ГибРИМА',
  'СпекТР',
  'ЦД-Well',
  'ЭРА: ИСКРА',
  'КФА',
  'ЕАРМ',
  'eXoil',
  'ТЕРРА',
  'ЭРА: ПИК',
  'ГРАД ВЕБ',
  'СМБ 2.0',
  'ЭРА: Ремонты',
  'ИПА',
  'DUO Tech',
  'ПЛУТОН',
  'ГРАД: Core',
  'ЦРМС',
  'ГеоБД 2.0',
  'ЭРА: Добыча',
  'NGT Smart',
  'СППР',
  'OIS Prod',
  'NumEx',
  'GeoMate',
  'САРЕКС',
  'Мета-актив',
  'ШТР',
  'ПАОТ',
  'ВЕГА',
]

export { MICROSERVICES }
export { FUNCTIONS }

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
