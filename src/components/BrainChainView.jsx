import React, { useState, useEffect, useRef, useMemo } from 'react'
import DecisionTreeView from './DecisionTreeView'
import './BrainChainView.css'
import './AiThinkingUI.css'

const BASE_URL = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') + '/'

const BRAIN_MID_DURATION_MS = 2200
/** Задержка появления слоя дерева после галочки (создание сверху вниз вместе с «Действия») */
const TREE_LAYER_DELAY_MS = 180

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
  graphNodes = [],
  chainAlreadyRevealed = false,
  selectedDecisionPathId,
  appliedDecisionPathId,
  onSelectDecisionPath,
  onRecalculate,
  awaitingConfirm,
  onConfirm,
}) {
  const stepsUnique = useMemo(() => uniqueStepsByLabel(steps), [steps])
  const fullCount = stepsUnique.length
  const [visibleCount, setVisibleCount] = useState(() => (chainAlreadyRevealed ? fullCount : 0))
  const [treeRevealCount, setTreeRevealCount] = useState(() => (chainAlreadyRevealed ? fullCount : 0))
  const chainComplete = stepsUnique.some((s) => s?.label && String(s.label).includes('Готово к планированию'))
  const [brainPhase, setBrainPhase] = useState(chainAlreadyRevealed ? 'after' : 'before')
  const mudShownRef = useRef(false)
  const progress = fullCount ? Math.min(1, visibleCount / fullCount) : 0

  useEffect(() => {
    if (chainAlreadyRevealed) {
      setVisibleCount(fullCount)
      setTreeRevealCount(fullCount)
      return
    }
    if (stepsUnique.length <= visibleCount) return
    const t = setTimeout(() => setVisibleCount((c) => Math.min(c + 1, stepsUnique.length)), 620)
    return () => clearTimeout(t)
  }, [chainAlreadyRevealed, stepsUnique.length, visibleCount, fullCount])

  useEffect(() => {
    if (chainAlreadyRevealed || treeRevealCount >= visibleCount) return
    const t = setTimeout(() => setTreeRevealCount(visibleCount), TREE_LAYER_DELAY_MS)
    return () => clearTimeout(t)
  }, [chainAlreadyRevealed, visibleCount, treeRevealCount])

  useEffect(() => {
    if (!chainComplete) return
    if (!mudShownRef.current) {
      mudShownRef.current = true
      setBrainPhase('mid')
      const t = setTimeout(() => setBrainPhase('after'), BRAIN_MID_DURATION_MS)
      return () => clearTimeout(t)
    }
  }, [chainComplete])

  const brainSrc = `${BASE_URL}brain_${brainPhase}.gif`

  return (
    <div className="brain-chain-view">
      <div className="brain-chain-top">
        <div className="brain-chain-brain-wrap">
          <img src={brainSrc} alt="" className="brain-chain-brain-gif" />
        </div>
      </div>
      <div className="brain-chain-graph-wrap">
        <DecisionTreeView
          selectedPathId={selectedDecisionPathId}
          onSelect={onSelectDecisionPath}
          growthProgress={progress}
          stepsVisibleCount={treeRevealCount}
        />
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
                className={`ai-thinking-ui-step ai-thinking-ui-step--done brain-chain-step-item ${i < visibleCount ? 'brain-chain-step-visible' : ''}`}
                style={{ opacity: 1, visibility: 'visible', ...(i < visibleCount ? { animationDelay: `${i * 0.08}s` } : {}) }}
              >
                <span className="ai-thinking-ui-step-icon">✓</span>
                <span className="ai-thinking-ui-step-label">{item?.label ?? ''}</span>
              </li>
            ))
          )}
        </ul>
        {stepsUnique.length > 0 && (
          <div className="brain-chain-actions">
            {awaitingConfirm && onConfirm && (
              <button
                type="button"
                className="ai-thinking-ui-btn ai-thinking-ui-btn--confirm"
                onClick={onConfirm}
                disabled={!selectedDecisionPathId}
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
