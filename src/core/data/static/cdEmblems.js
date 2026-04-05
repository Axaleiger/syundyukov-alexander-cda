/**
 * Соответствие названий ЦД из цепочек на карте эмблемам и подписям.
 * Файлы эмблем лежат в public/.
 */

const BASE = import.meta.env.BASE_URL || '/'

export const CD_EMBLEM_MAP = {
  'ЦД новых мощностей': {
    emblem: 'ЦД АВНМ (Цифровой двойник новых мощностей).png',
    title: 'ЦД АВНМ',
    subtitle: 'Цифровой двойник новых мощностей',
  },
  'ЦД Разведки и добычи': {
    emblem: 'ЦД РИД (Цифровой двойник разведки и добычи).png',
    title: 'ЦД РИД',
    subtitle: 'Цифровой двойник разведки и добычи',
  },
  'ЦД скважины': {
    emblem: 'ЦД С (Цифровой двойник скважины).png',
    title: 'ЦД С',
    subtitle: 'Цифровой двойник скважины',
  },
  'ЦД Экосистемы БРД': {
    emblem: 'ЦД ЭБРД (Цифровой двойник экосистемы блока разведки и добычи).png',
    title: 'ЦД ЭБРД',
    subtitle: 'Цифровой двойник экосистемы блока разведки и добычи',
  },
  'ЦД промысла': {
    emblem: 'ЦДП (Цифровой двойник промысла).png',
    title: 'ЦДП',
    subtitle: 'Цифровой двойник промысла',
  },
  'ЦД проектных решений': {
    emblem: 'ЦДПР (Цифровой двойник проектных решений).png',
    title: 'ЦДПР',
    subtitle: 'Цифровой двойник проектных решений',
  },
  'ЦД ресурсной базы': {
    emblem: 'ЦДРБ (Цифровой двойник ресурсной базы).png',
    title: 'ЦДРБ',
    subtitle: 'Цифровой двойник ресурсной базы',
  },
}

export function getCdPageInfo(nodeName) {
  const info = CD_EMBLEM_MAP[nodeName]
  if (info) {
    const emblemUrl = BASE + info.emblem
    return { ...info, emblemUrl }
  }
  return {
    emblemUrl: BASE + 'emblem.png',
    title: nodeName,
    subtitle: nodeName,
  }
}
