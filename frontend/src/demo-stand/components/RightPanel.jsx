import React, { useMemo } from 'react'
import { getAssetScenarioComparisonDemo, SCENARIO_METRIC_DEFS } from '../data/assetScenarioComparison.demo'
import { ScenarioMetricRow } from './ScenarioMetricRow'
import StrategyContextSection from './StrategyContextSection'
import './RightPanel.css'

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

      <StrategyContextSection rootClass="right-panel-section" />
    </aside>
  )
}

export default RightPanel
