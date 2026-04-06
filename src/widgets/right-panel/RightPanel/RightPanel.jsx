import React from 'react'
import { useAssetScenarioComparison } from './model/useAssetScenarioComparison'
import { ScenarioMetricRow } from './ScenarioMetricRow'
import styles from './RightPanel.module.css'

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

function RightPanel({ assetId, scenarioComparisonRevision = 0, tone }) {
  const { metricDefs: SCENARIO_METRIC_DEFS, comparison } = useAssetScenarioComparison(assetId)
  const showAiDeltas = scenarioComparisonRevision > 0

  return (
    <aside
      className={styles['right-panel']}
      {...(tone === 'demo' ? { 'data-panel-tone': 'demo' } : {})}
    >
      <section className={styles['right-panel-section']}>
        <h3 className={styles['right-panel-heading']}>Сравнение сценариев развития актива</h3>
        <p className={styles['right-panel-note']}>Альтернативные управленческие логики при единых допущениях</p>
        <div className={styles['right-panel-scenarios']}>
          {comparison.scenarios.map((sc, si) => (
            <div
              key={sc.id}
              className={`${styles['right-panel-scenario']} ${styles[`right-panel-scenario--${sc.role}`]} ${sc.isBest ? styles['right-panel-scenario--best'] : ''}`}
            >
              {sc.isBest && <span className={styles['right-panel-scenario-badge']}>Рекомендуемый</span>}
              <h4 className={styles['right-panel-scenario-title']}>{sc.title}</h4>
              <div className={styles['right-panel-metrics']}>
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
        <p className={styles['right-panel-footer']}>
          Сценарии сопоставимы по единым допущениям и исходным ограничениям. Выбор сценария определяет дальнейшую логику управления активом.
        </p>
      </section>

      <section className={styles['right-panel-section']}>
        <h3 className={styles['right-panel-heading']}>Контекст текущей стратегии</h3>
        <p className={styles['right-panel-note']}>Текущая стратегия сформирована последовательностью управленческих решений</p>
        <h4 className={styles['right-panel-subheading']}>Управленческие решения, определившие текущую стратегию</h4>
        <div className={styles['right-panel-decisions']}>
          {DECISIONS.map((d, i) => (
            <div key={i} className={styles['right-panel-decision']}>
              <h5 className={styles['right-panel-decision-title']}>{d.title}</h5>
              <div className={styles['right-panel-decision-row']}>
                <span className={styles['right-panel-decision-label']}>Выбранный</span>
                <span>{d.chosen}</span>
              </div>
              {d.alternative && (
                <div className={`${styles['right-panel-decision-row']} ${styles['right-panel-decision-alternative']}`}>
                  <span className={styles['right-panel-decision-label']}>Альтернатива</span>
                  <span>{d.alternative}</span>
                </div>
              )}
              {d.detail && <p className={styles['right-panel-decision-detail']}>{d.detail}</p>}
              <div className={styles['right-panel-decision-outcome']}>
                {d.outcomeIcon === 'check' && <span className={styles['right-panel-outcome-ok']}>✓</span>}
                {d.outcomeIcon === 'partial' && <span className={styles['right-panel-outcome-partial']}>◐</span>}
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
