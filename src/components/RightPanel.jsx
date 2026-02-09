import React, { useMemo } from 'react'
import './RightPanel.css'

const TITLE_OPTIONS = ['Поддержание добычи', 'Рост добычи', 'Сценарий развития', 'CAPEX-оптимизация', 'Баланс рисков', 'Консервативный сценарий']
const LIMITS_OPTIONS = ['Запасы', 'Умеренные ограничения', 'Фонд скважин', 'Инфраструктура', 'Бюджет']
const ARROWS = ['up', 'down', 'up-right', 'neutral']
const ICONS = [null, 'warning', 'check']

function seedFromId(id) {
  let h = 0
  for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h
}

function seededChoice(seed, arr) {
  return arr[(seed >>> 0) % arr.length]
}

function getScenariosForAsset(assetId) {
  const s = seedFromId(assetId)
  return [
    {
      id: 'A',
      title: seededChoice(s + 1, TITLE_OPTIONS),
      effects: [
        { text: 'Добыча', arrow: seededChoice(s + 2, ARROWS), color: seededChoice(s + 3, ['green', 'yellow']) },
        { text: 'Запасы / RF', arrow: seededChoice(s + 4, ARROWS), color: seededChoice(s + 5, ['green', 'yellow']) },
        { text: 'CAPEX', arrow: seededChoice(s + 6, ARROWS), color: seededChoice(s + 7, ['green', 'yellow']) },
      ],
      limits: seededChoice(s + 8, LIMITS_OPTIONS),
      icon: seededChoice(s + 9, ICONS),
    },
    {
      id: 'B',
      title: seededChoice(s + 10, TITLE_OPTIONS),
      effects: [
        { text: 'Добыча', arrow: seededChoice(s + 11, ARROWS), color: seededChoice(s + 12, ['green', 'yellow', 'orange']) },
        { text: 'Запасы', arrow: seededChoice(s + 13, ARROWS), color: seededChoice(s + 14, ['green', 'yellow', 'orange']) },
        { text: 'CAPEX', arrow: seededChoice(s + 15, ARROWS), color: seededChoice(s + 16, ['green', 'yellow', 'orange']) },
      ],
      limits: seededChoice(s + 17, LIMITS_OPTIONS),
      icon: seededChoice(s + 18, ICONS),
    },
    {
      id: 'C',
      title: seededChoice(s + 19, TITLE_OPTIONS),
      effects: [
        { text: 'Добыча', arrow: seededChoice(s + 20, ARROWS), color: seededChoice(s + 21, ['orange', 'yellow']) },
        { text: 'Запасы', arrow: seededChoice(s + 22, ARROWS), color: seededChoice(s + 23, ['orange', 'yellow']) },
        { text: 'CAPEX', arrow: seededChoice(s + 24, ARROWS), color: seededChoice(s + 25, ['orange', 'yellow']) },
      ],
      limits: seededChoice(s + 26, LIMITS_OPTIONS),
      icon: seededChoice(s + 27, ICONS),
    },
  ]
}

const DECISIONS = [
  {
    title: 'Принято решение: бурение в точке D',
    chosen: 'Точка D +120 т',
    detail: '+65 т добычи. Коррекция модели зоны D по результатам бурения.',
    outcome: 'Подтвердилось',
    outcomeIcon: 'check',
  },
  {
    title: 'Расширить добычу за счёт сектора Z',
    chosen: 'Сектор Z — +130 т > 2 года',
    alternative: 'Сектор Y +90 т, низкий риск',
    detail: 'Старт добычи в секторе Z. Обнаружен осложняющий фактор в секторах Y и Z.',
    outcome: 'Подтвердилось',
    outcomeIcon: 'check',
  },
  {
    title: 'Принято решение: отказ от проекта X',
    chosen: 'Отказ — согласие на снижение рисков',
    alternative: 'Проект Х — быстрый риск',
    detail: 'Оценочный риск +50 т из запасов южного блока.',
    outcome: 'Частично подтвердилось',
    outcomeIcon: 'partial',
  },
]

function ArrowIcon({ type }) {
  if (type === 'up') return <span className="right-panel-arrow right-panel-arrow-up">↑</span>
  if (type === 'up-right') return <span className="right-panel-arrow right-panel-arrow-up">↗</span>
  if (type === 'down') return <span className="right-panel-arrow right-panel-arrow-down">↓</span>
  return <span className="right-panel-arrow">—</span>
}

function RightPanel({ scenarioCardColors = [], assetId }) {
  const scenarios = useMemo(() => getScenariosForAsset(assetId), [assetId])
  const colorList = scenarioCardColors.length ? scenarioCardColors : ['green', 'yellow', 'orange']
  return (
    <aside className="right-panel">
      <section className="right-panel-section">
        <h3 className="right-panel-heading">Сравнение сценариев развития актива</h3>
        <p className="right-panel-note">Альтернативные управленческие логики при единых допущениях</p>
        <div className="right-panel-scenarios">
          {scenarios.map((s, i) => (
            <div key={s.id} className={`right-panel-scenario right-panel-scenario-${colorList[i] || 'green'}`}>
              <h4 className="right-panel-scenario-title">Сценарий {s.id}: {s.title}</h4>
              <div className="right-panel-effects">
                <span className="right-panel-effects-label">Ключевые эффекты</span>
                <ul>
                  {s.effects.map((e, j) => (
                    <li key={j}>
                      <ArrowIcon type={e.arrow} />
                      <span className={`right-panel-effect-${e.color}`}>{e.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="right-panel-limits">
                <span className="right-panel-limits-label">Основные ограничения</span>
                <span>{s.limits}</span>
                {s.icon === 'warning' && (
                  <span className="right-panel-icon right-panel-icon-warning" title="Ограничение">⚠</span>
                )}
                {s.icon === 'check' && (
                  <span className="right-panel-icon right-panel-icon-ok" title="Норма">✓</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="right-panel-footer">
          Сценарии сопоставимы по единым допущениям и исходным ограничениям. Выбор сценария определяет дальнейшую логику управления активом.
        </p>
      </section>

      <section className="right-panel-section">
        <h3 className="right-panel-heading">Контекст текущей стратегии</h3>
        <p className="right-panel-note">Текущая стратегия сформирована последовательностью управленческих решений</p>
        <h4 className="right-panel-subheading">Управленческие решения, определившие текущую стратегию</h4>
        <div className="right-panel-decisions">
          {DECISIONS.map((d, i) => (
            <div key={i} className="right-panel-decision">
              <h5 className="right-panel-decision-title">{d.title}</h5>
              <div className="right-panel-decision-row">
                <span className="right-panel-decision-label">Выбранный</span>
                <span>{d.chosen}</span>
              </div>
              {d.alternative && (
                <div className="right-panel-decision-row right-panel-decision-alternative">
                  <span className="right-panel-decision-label">Альтернатива</span>
                  <span>{d.alternative}</span>
                </div>
              )}
              {d.detail && <p className="right-panel-decision-detail">{d.detail}</p>}
              <div className="right-panel-decision-outcome">
                {d.outcomeIcon === 'check' && <span className="right-panel-outcome-ok">✓</span>}
                {d.outcomeIcon === 'partial' && <span className="right-panel-outcome-partial">◐</span>}
                <span>{d.outcome}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  )
}

export default RightPanel
