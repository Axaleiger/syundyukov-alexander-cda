import React, { useMemo } from 'react'
import { getAssetScenarioComparisonDemo, SCENARIO_METRIC_DEFS } from '../../shared/data/assetScenarioComparison.demo'
import { ScenarioMetricRow } from './ScenarioMetricRow'
import './RightPanel.css'

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

function RightPanel({ assetId, scenarioComparisonRevision = 0 }) {
  const comparison = useMemo(() => getAssetScenarioComparisonDemo(assetId), [assetId])
  const showAiDeltas = scenarioComparisonRevision > 0

  return (
    <aside className="right-panel">
      <section className="right-panel-section">
        <h3 className="right-panel-heading">Сравнение сценариев развития актива</h3>
        <p className="right-panel-note">Альтернативные управленческие логики при единых допущениях</p>
        <div className="right-panel-scenarios">
          {comparison.scenarios.map((sc, si) => (
            <div
              key={sc.id}
              className={`right-panel-scenario right-panel-scenario--${sc.role} ${sc.isBest ? 'right-panel-scenario--best' : ''}`}
            >
              {sc.isBest && <span className="right-panel-scenario-badge">Рекомендуемый</span>}
              <h4 className="right-panel-scenario-title">{sc.title}</h4>
              <div className="right-panel-metrics">
                {SCENARIO_METRIC_DEFS.map((def, ri) => (
                  <ScenarioMetricRow
                    key={def.key}
                    metricDef={def}
                    base={sc.metrics[def.key]}
                    delta={sc.deltas[def.key]}
                    showAiDeltas={showAiDeltas}
                    rowIndex={ri}
                    scenarioStaggerMs={si * 115}
                    revision={scenarioComparisonRevision}
                  />
                ))}
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
