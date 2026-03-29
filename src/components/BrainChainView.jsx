import React, { useState, useEffect, useMemo } from 'react'
import ScenarioGraph from './ScenarioGraph'
import DigitalBrain from './DigitalBrain'
import ScenarioAnalysisDashboard from './ScenarioAnalysisDashboard'
import './BrainChainView.css'
import './AiThinkingUI.css'
import { scenarioMaxRevealWave } from '../lib/scenarioGraphData'

/** Убираем дубликаты по label (оставляем первое вхождение) */
function uniqueStepsByLabel(steps) {
  const seen = new Set()
  return steps.filter((s) => {
    const l = String(s?.label ?? '').trim()
    if (!l || seen.has(l)) return false
    seen.add(l)
    return true
  })
}

/**
 * Режим «мозг + цепочка»: мозг сверху, граф мыслей (Obsidian-style), список действий.
 * chainAlreadyRevealed: при повторном открытии панели цепочка показывается сразу, без повторной анимации.
 */
function BrainChainView({
  steps = [],
  chainAlreadyRevealed = false,
  selectedDecisionPathId,
  appliedDecisionPathId,
  onRecalculate,
  awaitingConfirm,
  onConfirm,
}) {
  const stepsUnique = useMemo(() => uniqueStepsByLabel(steps), [steps])
  const chainComplete = stepsUnique.some((s) => s?.label && String(s.label).includes('Готово к планированию'))
  const fullCount = stepsUnique.length
  const [visibleCount, setVisibleCount] = useState(() => (chainAlreadyRevealed ? fullCount : 0))
  const [graphWave, setGraphWave] = useState(() => (chainAlreadyRevealed ? scenarioMaxRevealWave : 0))
  const graphBuildComplete = graphWave >= scenarioMaxRevealWave
  const activeActionStep = Math.max(0, visibleCount - 1)

  useEffect(() => {
    if (chainAlreadyRevealed) {
      setVisibleCount(fullCount)
      return
    }
    if (stepsUnique.length <= visibleCount) return
    const t = setTimeout(() => setVisibleCount((c) => Math.min(c + 1, stepsUnique.length)), 620)
    return () => clearTimeout(t)
  }, [chainAlreadyRevealed, stepsUnique.length, visibleCount, fullCount])

  useEffect(() => {
    if (chainAlreadyRevealed) {
      setGraphWave(scenarioMaxRevealWave)
    }
  }, [chainAlreadyRevealed])

  useEffect(() => {
    if (chainAlreadyRevealed) return
    if (graphWave >= scenarioMaxRevealWave) return
    const t = setTimeout(() => {
      setGraphWave((w) => Math.min(w + 1, scenarioMaxRevealWave))
    }, 500)
    return () => clearTimeout(t)
  }, [chainAlreadyRevealed, graphWave])

  return (
    <div className="brain-chain-view">
      <div className="brain-chain-top">
        <div className="brain-chain-brain-wrap">
          <DigitalBrain isThinking={!graphBuildComplete} />
        </div>
      </div>
      <div className="brain-chain-graph-wrap">
        {/* Старый блок оставлен на будущее: <DecisionTreeView ... /> */}
        <ScenarioGraph revealWave={graphWave} graphComplete={graphBuildComplete} />
      </div>
      <div className="brain-chain-under" aria-label="Список действий">
        <p className="brain-chain-caption">Действия</p>
        <ul className="ai-thinking-ui-checklist brain-chain-checklist" role="list" style={{ visibility: 'visible', opacity: 1 }}>
          {stepsUnique.length === 0 ? (
            <li className="brain-chain-placeholder">Формирую цепочку…</li>
          ) : (
            stepsUnique.map((item, i) => (
              <li
                key={item?.id ?? i}
                className={`ai-thinking-ui-step ai-thinking-ui-step--done brain-chain-step-item ${i < visibleCount ? 'brain-chain-step-visible' : ''} ${i === activeActionStep && !graphBuildComplete ? 'brain-chain-step-active' : ''}`}
                style={{ opacity: 1, visibility: 'visible', ...(i < visibleCount ? { animationDelay: `${i * 0.08}s` } : {}) }}
              >
                <span className="ai-thinking-ui-step-icon">✓</span>
                <span className="ai-thinking-ui-step-label">{item?.label ?? ''}</span>
              </li>
            ))
          )}
        </ul>
        <ScenarioAnalysisDashboard visible={graphBuildComplete} />
        {stepsUnique.length > 0 && (
          <div className="brain-chain-actions">
            {awaitingConfirm && onConfirm && (
              <button
                type="button"
                className="ai-thinking-ui-btn ai-thinking-ui-btn--confirm"
                onClick={onConfirm}
                  disabled={!graphBuildComplete}
              >
                Согласовать
              </button>
            )}
            {selectedDecisionPathId && appliedDecisionPathId && selectedDecisionPathId !== appliedDecisionPathId && onRecalculate && (
              <button
                type="button"
                className="ai-thinking-ui-btn ai-thinking-ui-btn--resume"
                onClick={onRecalculate}
              >
                Пересчитать
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default BrainChainView
