import React from 'react'
import './RightPanel.css'

const SCENARIOS = [
  {
    id: 'A',
    title: 'Поддержание добычи',
    color: 'green',
    effects: [
      { text: 'Добыча', arrow: 'up', color: 'green' },
      { text: 'Запасы / RF', arrow: 'up-right', color: 'green' },
      { text: 'CAPEX', arrow: 'neutral', color: 'green' },
    ],
    limits: 'Запасы',
    icon: null,
  },
  {
    id: 'B',
    title: 'Сценарий B',
    color: 'yellow',
    effects: [
      { text: 'Добыча', arrow: 'up', color: 'green' },
      { text: 'Запасы', arrow: 'neutral', color: 'yellow' },
      { text: 'CAPEX', arrow: 'neutral', color: 'yellow' },
    ],
    limits: 'Умеренные ограничения',
    icon: 'warning',
  },
  {
    id: 'C',
    title: 'CAPEX-оптимизация',
    color: 'orange',
    effects: [
      { text: 'Добыча', arrow: 'down', color: 'orange' },
      { text: 'Запасы', arrow: 'down', color: 'orange' },
      { text: 'CAPEX', arrow: 'down', color: 'orange' },
    ],
    limits: 'Фонд скважин',
    icon: 'warning',
  },
]

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

function RightPanel({ scenarioCardColors = [] }) {
  return (
    <aside className="right-panel">
      <section className="right-panel-section">
        <h3 className="right-panel-heading">Сравнение сценариев развития актива</h3>
        <p className="right-panel-note">Альтернативные управленческие логики при единых допущениях</p>
        <div className="right-panel-scenarios">
          {SCENARIOS.map((s, i) => (
            <div key={s.id} className={`right-panel-scenario right-panel-scenario-${scenarioCardColors[i] || s.color}`}>
              <h4 className="right-panel-scenario-title">Сценарий {s.id}: {s.title}</h4>
              <div className="right-panel-effects">
                <span className="right-panel-effects-label">Ключевые эффекты</span>
                <ul>
                  {s.effects.map((e, i) => (
                    <li key={i}>
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
