import React, { useMemo } from 'react'
import { getAssetScenarioComparisonDemo, SCENARIO_METRIC_DEFS } from '../data/assetScenarioComparison.demo'
import { ScenarioMetricRow } from './ScenarioMetricRow'
import StrategyContextSection from './StrategyContextSection'
import './FaceScenarioOverlay.css'

const PREVIEW_METRIC_KEYS = ['productionMt', 'npvB', 'irrPct']

/**
 * Оверлей на зоне глобуса: три сценария + контекст стратегии (glass).
 */
export default function FaceScenarioOverlay({
  assetId,
  scenarioComparisonRevision = 0,
  selectedScenarioTitle,
  onSelectScenario,
}) {
  const comparison = useMemo(() => getAssetScenarioComparisonDemo(assetId), [assetId])
  const showAiDeltas = scenarioComparisonRevision > 0
  const previewDefs = useMemo(
    () => SCENARIO_METRIC_DEFS.filter((d) => PREVIEW_METRIC_KEYS.includes(d.key)),
    []
  )

  return (
    <div className="face-scenario-overlay" role="region" aria-label="Сценарии и стратегия">
      <div className="face-scenario-overlay-inner">
        <div className="face-scenario-cards">
          {comparison.scenarios.map((sc, si) => {
            const selected = selectedScenarioTitle === sc.title
            return (
              <button
                key={sc.id}
                type="button"
                className={`face-scenario-card face-scenario-card--${sc.role} ${sc.isBest ? 'face-scenario-card--best' : ''} ${selected ? 'face-scenario-card--selected' : ''}`}
                onClick={() => onSelectScenario?.(sc.title)}
              >
                {sc.isBest && <span className="face-scenario-card-badge">Рекомендуемый</span>}
                <h4 className="face-scenario-card-title">{sc.title}</h4>
                <div className="face-scenario-card-metrics">
                  {previewDefs.map((def, ri) => (
                    <ScenarioMetricRow
                      key={def.key}
                      metricDef={def}
                      base={sc.metrics[def.key]}
                      delta={sc.deltas[def.key]}
                      showAiDeltas={showAiDeltas}
                      rowIndex={ri}
                      scenarioStaggerMs={si * 80}
                      revision={scenarioComparisonRevision}
                    />
                  ))}
                </div>
              </button>
            )
          })}
        </div>
        <div className="face-strategy-glass glass-panel">
          <StrategyContextSection
            rootClass="face-strategy-context"
            decisionClass="face-strategy-decision glass-panel glass-panel--nested"
            compact
          />
        </div>
      </div>
    </div>
  )
}
