import React, { useState, useEffect, useMemo, useRef } from 'react'
import ScenarioGraph from './ScenarioGraph'
import DigitalBrain from './DigitalBrain'
import ScenarioAnalysisDashboard from './ScenarioAnalysisDashboard'
import './BrainChainView.css'
import './AiThinkingUI.css'
import { scenarioGraphEdges, scenarioGraphNodes } from '../lib/scenarioGraphData'
import { buildPredsOuts, revealDelayMs } from '../lib/graphRevealSchedule'

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
  const fullCount = stepsUnique.length
  const [visibleCount, setVisibleCount] = useState(() => (chainAlreadyRevealed ? fullCount : 0))
  const graphSessionSeedRef = useRef((Math.random() * 0x7fffffff) | 0)
  const [visibleNodeIds, setVisibleNodeIds] = useState(() =>
    chainAlreadyRevealed ? new Set(scenarioGraphNodes.map((n) => n.id)) : new Set()
  )
  const graphBuildComplete = useMemo(() => {
    if (chainAlreadyRevealed) return true
    const n = scenarioGraphNodes.length
    return n > 0 && visibleNodeIds.size >= n
  }, [chainAlreadyRevealed, visibleNodeIds])
  const graphTargetPercent = useMemo(() => {
    if (chainAlreadyRevealed) return 100
    const n = scenarioGraphNodes.length
    if (n === 0) return 0
    return (visibleNodeIds.size / n) * 100
  }, [chainAlreadyRevealed, visibleNodeIds])
  const visibleSteps = useMemo(
    () => stepsUnique.slice(0, visibleCount),
    [stepsUnique, visibleCount]
  )

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
    if (!chainAlreadyRevealed) return
    setVisibleNodeIds(new Set(scenarioGraphNodes.map((n) => n.id)))
  }, [chainAlreadyRevealed])

  useEffect(() => {
    if (chainAlreadyRevealed) return undefined

    const sessionSeed = graphSessionSeedRef.current
    const nodeIds = scenarioGraphNodes.map((n) => n.id)
    const { preds, outs } = buildPredsOuts(nodeIds, scenarioGraphEdges)
    const visible = new Set()
    const queued = new Set()
    const timeouts = []

    const revealNow = (id) => {
      if (visible.has(id)) return
      visible.add(id)
      setVisibleNodeIds(new Set(visible))
      for (const to of outs.get(id) || []) {
        const ps = preds.get(to) || []
        if (!ps.every((p) => visible.has(p))) continue
        if (visible.has(to)) continue
        scheduleNode(to)
      }
    }

    function scheduleNode(nodeId) {
      if (queued.has(nodeId) || visible.has(nodeId)) return
      queued.add(nodeId)
      const delay = revealDelayMs(sessionSeed, nodeId)
      const t = setTimeout(() => {
        queued.delete(nodeId)
        revealNow(nodeId)
      }, delay)
      timeouts.push(t)
    }

    revealNow('userQuery')

    return () => {
      timeouts.forEach(clearTimeout)
    }
  }, [chainAlreadyRevealed])

  return (
    <div className="brain-chain-view">
      <div className="brain-chain-top">
        <div className="brain-chain-brain-wrap">
          <DigitalBrain isThinking={!graphBuildComplete} graphProgressPercent={graphTargetPercent} />
        </div>
      </div>
      <div className="brain-chain-graph-wrap">
        {/* Старый блок оставлен на будущее: <DecisionTreeView ... /> */}
        <ScenarioGraph visibleNodeIds={visibleNodeIds} graphComplete={graphBuildComplete} />
      </div>
      <div className="brain-chain-under" aria-label="Список действий">
        <h3 className="app-thinking-drawer-title mb-4">Цепочка размышлений</h3>
        <ul className="ai-thinking-ui-checklist brain-chain-checklist" role="list">
          {stepsUnique.length === 0 ? (
            <li className="brain-chain-placeholder">Формирую цепочку…</li>
          ) : (
            visibleSteps.map((item, i) => {
              const isActive = i === visibleCount - 1 && !graphBuildComplete
              return (
                <li
                  key={item?.id ?? i}
                  className={`ai-thinking-ui-step ai-thinking-ui-step--done brain-chain-step-item ${isActive ? 'brain-chain-step-active' : ''}`}
                >
                  <span className="ai-thinking-ui-step-icon">✓</span>
                  <span className="ai-thinking-ui-step-label">{item?.label ?? ''}</span>
                </li>
              )
            })
          )}
        </ul>
        <ScenarioAnalysisDashboard visible={graphBuildComplete} />
        {stepsUnique.length > 0 && (
          <div className="brain-chain-actions">
            {awaitingConfirm && onConfirm && (
              <button
                type="button"
                className="app-thinking-drawer-exit app-thinking-drawer-exit--success"
                onClick={onConfirm}
                  disabled={!graphBuildComplete}
              >
                Согласовать предлагаемый сценарий
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
