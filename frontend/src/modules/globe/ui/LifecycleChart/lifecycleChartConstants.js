export const CURRENT_YEAR = 2026
export const LIFECYCLE_HISTORY_COLOR = '#3b82f6'
export const LIFECYCLE_FORECAST_COLOR = '#22c55e'
export const VIEW_MODES = [
  { id: 'sum', label: 'По умолчанию' },
  { id: 'cumulative', label: 'Накопление' },
  { id: 'default', label: 'Детализированно' },
]

export const stages = [
  { key: 'geologorazvedka', name: 'Геологоразведка и работа с ресурсной базой', color: '#5b8dc9' },
  { key: 'razrabotka', name: 'Разработка', color: '#6b7fd7' },
  { key: 'planirovanie', name: 'Планирование и обустройство', color: '#8b7fd4' },
  { key: 'burenie', name: 'Бурение и ВСР', color: '#7eb8e8' },
  { key: 'dobycha', name: 'Добыча', color: '#6bc4a0' },
]

/** Цветные линии между точками на оси X (цвет = цвет конечной точки). */
export const LIFECYCLE_YEAR_TICKS = ['1965', '1975', '1985', '1995', '2005', '2015', '2020', '2026', '2030', '2040', '2050', '2065']
