import React from 'react'
import { STRATEGY_DECISIONS } from '../data/strategyDecisions'

/**
 * @param {{ rootClass?: string, decisionClass?: string, compact?: boolean }} props
 */
export default function StrategyContextSection({ rootClass = '', decisionClass = 'right-panel-decision', compact = false }) {
  return (
    <section className={rootClass}>
      <h3 className="right-panel-heading">Контекст текущей стратегии</h3>
      <p className="right-panel-note">Текущая стратегия сформирована последовательностью управленческих решений</p>
      <h4 className="right-panel-subheading">Управленческие решения, определившие текущую стратегию</h4>
      <div className={`right-panel-decisions ${compact ? 'right-panel-decisions--compact' : ''}`}>
        {STRATEGY_DECISIONS.map((d, i) => (
          <div key={i} className={decisionClass}>
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
            {d.detail && !compact && <p className="right-panel-decision-detail">{d.detail}</p>}
            <div className="right-panel-decision-outcome">
              {d.outcomeIcon === 'check' && <span className="right-panel-outcome-ok">✓</span>}
              {d.outcomeIcon === 'partial' && <span className="right-panel-outcome-partial">◐</span>}
              <span>{d.outcome}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
