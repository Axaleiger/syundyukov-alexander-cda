export const CURRENT_YEAR = 2026
export const LIFECYCLE_HISTORY_COLOR = '#3b82f6'
export const LIFECYCLE_FORECAST_COLOR = '#22c55e'
export const VIEW_MODES = [
  { id: 'sum', label: 'По умолчанию' },
  { id: 'cumulative', label: 'Накопление' },
  { id: 'default', label: 'Детализированно' },
]

export const stages = [
  { key: 'geologorazvedka', name: 'Геологоразведка и работа с ресурсной базой', color: '#2778A9' },
  { key: 'razrabotka', name: 'Разработка', color: '#7086FD' },
  { key: 'planirovanie', name: 'Планирование и обустройство', color: '#C4E7FF' },
  { key: 'burenie', name: 'Бурение и ВСР', color: '#2FB4E9' },
  { key: 'dobycha', name: 'Добыча', color: '#0F98AC' },
]

/** Цветные линии между точками на оси X (цвет = цвет конечной точки). */
export const LIFECYCLE_YEAR_TICKS = ['1965', '1975', '1985', '1995', '2005', '2015', '2020', '2026', '2030', '2040', '2050', '2065']
