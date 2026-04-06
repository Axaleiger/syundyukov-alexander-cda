/** Общие данные легенды для UI-панели и классификации точек в сцене */
export const VARIANT_COLORS = {
  inapplicable: '#1e4976',
  applicable: '#38bdf8',
  legitimate: '#0d9488',
}

export const INDICATOR_BASKETS = {
  'Проблемы в данных': [
    { key: 'no_data', label: 'Нет данных', color: '#374151' },
    { key: 'fluctuation', label: 'Флуктуации данных', color: '#6b7280' },
    { key: 'asymmetry', label: 'Асимметрия распределения', color: '#78350f' },
    { key: 'non_normal', label: 'Распределение ненормальное', color: '#57534e' },
  ],
  'Проблемы с расчётом и риски': [
    { key: 'bad_calc', label: 'Невалидный расчёт', color: '#ea580c' },
    { key: 'bad_excess', label: 'Невалидный коэффициент эксцесса', color: '#c2410c' },
    { key: 'no_executor', label: 'Не назначен исполнитель', color: '#dc2626' },
    { key: 'no_approver', label: 'Нет согласующего', color: '#ca8a04' },
    { key: 'no_deadline', label: 'Нет срока', color: '#b45309' },
    { key: 'critical', label: 'Критично', color: '#be185d' },
  ],
  'Норма': [
    { key: 'ok', label: 'Норма', color: '#2563eb' },
  ],
}
