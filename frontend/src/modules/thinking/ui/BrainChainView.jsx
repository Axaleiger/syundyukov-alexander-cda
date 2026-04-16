import React, { useState, useEffect, useMemo, useRef } from 'react'
import ScenarioGraph from './ScenarioGraph'
import NewDemoDigitalBrain from './NewDemoDigitalBrain'
import ScenarioAnalysisDashboard from './ScenarioAnalysisDashboard'
import styles from './BrainChainView.module.css'
import chrome from './thinkingDrawerChrome.module.css'
import {
  defaultScenarioGraphBundle,
  getScenarioGraphBundleForAiPreset,
  kpiRows,
  recommendations,
  SCENARIO_BRANCH_COUNT,
  OPTIMAL_SCENARIO_VARIANT,
} from '../lib/scenarioGraphData'
import {
  mergeKpiDeltasFromTableLines,
  getBrainOptimalVariantForPreset,
  getBrainScenarioBranchCount,
} from '../lib/brainPanelKpi.js'
import { buildPredsOuts, revealDelayMs } from '../lib/graphRevealSchedule'
import { useAppStore } from '../../../core/store/appStore.js'
import { PANELS_SCENARIO_CONTENT } from '../../ai/lib/panelsScenarioContent.js'
import { AI_PLANNING_BOARD_PRESETS } from '../../planning/data/aiPlanningBoardPresets.js'

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
  onGraphBuildCompleteChange,
  isNewDemo = false,
  graphNodes: _graphNodesFromLayout = [],
}) {
  const aiFaceBrainPreset = useAppStore((s) => s.aiFaceBrainPreset)
  const panelsBlock =
    aiFaceBrainPreset && PANELS_SCENARIO_CONTENT[aiFaceBrainPreset]
      ? PANELS_SCENARIO_CONTENT[aiFaceBrainPreset]
      : null
  const boardTitle =
    aiFaceBrainPreset && AI_PLANNING_BOARD_PRESETS[aiFaceBrainPreset]?.scenarioName
      ? AI_PLANNING_BOARD_PRESETS[aiFaceBrainPreset].scenarioName
      : null
  const kpiRowsForBrain = useMemo(() => {
    if (!panelsBlock?.tableLines) return kpiRows
    const merged = mergeKpiDeltasFromTableLines(panelsBlock.tableLines)
    return merged || kpiRows
  }, [panelsBlock])
  const scenarioBranchCount = panelsBlock ? getBrainScenarioBranchCount() : SCENARIO_BRANCH_COUNT
  const optimalVariant = panelsBlock
    ? getBrainOptimalVariantForPreset(aiFaceBrainPreset)
    : OPTIMAL_SCENARIO_VARIANT
  const recCardPrimary = panelsBlock?.cards?.[0]
  const recCardSecondary = panelsBlock?.cards?.[1]

  const activeGraphBundle = useMemo(() => {
    if (aiFaceBrainPreset) return getScenarioGraphBundleForAiPreset(aiFaceBrainPreset)
    return defaultScenarioGraphBundle
  }, [aiFaceBrainPreset])

  const graphNodesForReveal = useMemo(
    () => activeGraphBundle.nodes,
    [activeGraphBundle],
  )
  const graphEdgesForReveal = useMemo(
    () => activeGraphBundle.edges,
    [activeGraphBundle],
  )

  const stepsUnique = useMemo(() => uniqueStepsByLabel(steps), [steps])
  const fullCount = stepsUnique.length
  const [visibleCount, setVisibleCount] = useState(() => (chainAlreadyRevealed ? fullCount : 0))
  const graphSessionSeedRef = useRef(0x5f3759df)
  const [visibleNodeIds, setVisibleNodeIds] = useState(() =>
    chainAlreadyRevealed ? new Set(graphNodesForReveal.map((n) => n.id)) : new Set(),
  )
  const graphBuildComplete = useMemo(() => {
    if (chainAlreadyRevealed) return true
    const n = graphNodesForReveal.length
    return n > 0 && visibleNodeIds.size >= n
  }, [chainAlreadyRevealed, visibleNodeIds, graphNodesForReveal])
  const graphTargetPercent = useMemo(() => {
    if (chainAlreadyRevealed) return 100
    const n = graphNodesForReveal.length
    if (n === 0) return 0
    return (visibleNodeIds.size / n) * 100
  }, [chainAlreadyRevealed, visibleNodeIds, graphNodesForReveal])
  const visibleSteps = useMemo(
    () => stepsUnique.slice(0, visibleCount),
    [stepsUnique, visibleCount]
  )
  const showRecalculate =
    selectedDecisionPathId &&
    appliedDecisionPathId &&
    selectedDecisionPathId !== appliedDecisionPathId &&
    onRecalculate
  const metricMeta = {
    NPV: { label: 'Чистая приведённая стоимость портфеля (NPV)', higherIsGood: true },
    IRR: { label: 'Внутренняя норма доходности проекта (IRR)', higherIsGood: true },
    PI: { label: 'Индекс прибыльности (PI)', higherIsGood: true },
    DPP: { label: 'Дисконтированный срок окупаемости (DPP)', higherIsGood: false },
    CAPEX: { label: 'Капитальные затраты (CAPEX)', higherIsGood: false },
    OPEX: { label: 'Операционные затраты (OPEX)', higherIsGood: false },
  }

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
    setVisibleNodeIds(new Set(graphNodesForReveal.map((n) => n.id)))
  }, [chainAlreadyRevealed, graphNodesForReveal])

  useEffect(() => {
    if (chainAlreadyRevealed) return undefined

    const sessionSeed = graphSessionSeedRef.current
    const nodeIds = graphNodesForReveal.map((n) => n.id)
    const { preds, outs } = buildPredsOuts(nodeIds, graphEdgesForReveal)
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
  }, [chainAlreadyRevealed, graphNodesForReveal, graphEdgesForReveal])

  useEffect(() => {
    if (!onGraphBuildCompleteChange) return
    onGraphBuildCompleteChange(graphBuildComplete)
  }, [graphBuildComplete, onGraphBuildCompleteChange])

  if (isNewDemo) {
    return (
      <div className={`${styles.root} ${styles.rootNewDemoBoard}`}>
        <div className={styles.boardTopRow}>
          <section className={styles.boardCard}>
            <div className={styles.boardChainWrap}>
              <div className={styles.boardChainTitleRow}>
                <span className={styles.boardChainAccentDot} aria-hidden />
                <h4 className={styles.boardChainTitle}>Цепочка размышлений</h4>
              </div>
              <ul className={styles.boardThinkingList} role="list">
                {stepsUnique.length === 0 ? (
                  <li className={styles.boardThinkingItem}>
                    <span className={styles.boardThinkingBullet}>•</span>
                    <span className={styles.boardThinkingText}>Формирую цепочку…</span>
                    <span className={styles.boardThinkingLine} aria-hidden />
                  </li>
                ) : (
                  visibleSteps.map((item, i) => {
                    const isActive = i === visibleCount - 1 && !graphBuildComplete
                    return (
                      <li
                        key={item?.id ?? i}
                        className={`${styles.boardThinkingItem} ${isActive ? styles.boardThinkingItemActive : ''}`}
                      >
                        <span className={styles.boardThinkingBullet}>•</span>
                        <span className={styles.boardThinkingText}>{item?.label ?? ''}</span>
                        <span className={styles.boardThinkingLine} aria-hidden />
                      </li>
                    )
                  })
                )}
              </ul>
            </div>
          </section>

          <section className={`${styles.boardCard} ${styles.boardBrainCard}`}>
            <div className={styles.boardBrainWrap}>
              <NewDemoDigitalBrain graphProgressPercent={graphTargetPercent} />
            </div>
          </section>
        </div>

        <section className={styles.boardGraphSection}>
          {boardTitle ? (
            <p className={styles.boardScenarioCaption} title={boardTitle}>
              Сценарий: {boardTitle}
            </p>
          ) : null}
          <div className={styles.boardGraphWrap}>
            <ScenarioGraph
              visibleNodeIds={visibleNodeIds}
              graphComplete={graphBuildComplete}
              isNewDemo
              isBoardLayout
              graphBundle={activeGraphBundle}
            />
          </div>
        </section>

        <section
          className={`${styles.boardCard} ${styles.boardProgressStrip} ${styles.boardRevealSection} ${graphBuildComplete ? styles.boardRevealVisible : ''}`}
          aria-hidden={!graphBuildComplete}
        >
          <div className={styles.boardProgressInner}>
            <p className={styles.boardProgressText}>
              Проанализировано {scenarioBranchCount} сценариев. Оптимальный — Вариант {optimalVariant}
            </p>
          </div>
        </section>

        <section
          className={`${styles.boardRecommendationsRow} ${styles.boardRevealSection} ${graphBuildComplete ? styles.boardRevealVisible : ''}`}
          aria-hidden={!graphBuildComplete}
        >
          <article className={`${styles.boardCard} ${styles.boardRecommendationCard} ${styles.boardRecommendationCardPrimary}`}>
            <h4 className={styles.boardRecommendationTitle}>
              {recCardPrimary?.title ?? 'Ввод новых скважин/Зарезка боковых стволов скважин'}
            </h4>
            <ol className={styles.boardRecommendationList}>
              {(recCardPrimary?.bullets ?? recommendations.vnsZbs).slice(0, 3).map((item, idx) => (
                <li key={item} className={styles.boardRecommendationItem}>
                  <span className={styles.boardRecommendationIndex}>{idx + 1}</span>
                  <span className={styles.boardRecommendationText}>{item}</span>
                </li>
              ))}
            </ol>
          </article>

          <article className={`${styles.boardCard} ${styles.boardRecommendationCard} ${styles.boardRecommendationCardSecondary}`}>
            <h4 className={styles.boardRecommendationTitle}>
              {recCardSecondary?.title ?? 'Геолого-технические мероприятия'}
            </h4>
            <ol className={styles.boardRecommendationList}>
              {(recCardSecondary?.bullets ?? recommendations.gtm).slice(0, 3).map((item, idx) => (
                <li key={item} className={styles.boardRecommendationItem}>
                  <span className={styles.boardRecommendationIndex}>{idx + 1}</span>
                  <span className={styles.boardRecommendationText}>{item}</span>
                </li>
              ))}
            </ol>
          </article>
        </section>

        <section
          className={`${styles.boardBottomRow} ${styles.boardRevealSection} ${graphBuildComplete ? styles.boardRevealVisible : ''}`}
          aria-hidden={!graphBuildComplete}
        >
          <article className={`${styles.boardCard} ${styles.boardKpiCard}`}>
            <h4 className={styles.boardSectionTitle}>Ключевые показатели эффективности</h4>
            <div className={styles.boardKpiTable}>
              {kpiRowsForBrain.map((row) => {
                const meta = metricMeta[row.metric] || { label: row.metric, higherIsGood: true }
                const d = String(row.delta || '').trim()
                const isPositiveDelta = d.startsWith('+')
                const isGood = isPositiveDelta ? meta.higherIsGood : !meta.higherIsGood
                return (
                  <div key={row.metric} className={styles.boardKpiRow}>
                    <span className={styles.boardKpiMetric}>{meta.label}</span>
                    <span className={styles.boardKpiValue}>{row.value}</span>
                    <span className={`${styles.boardKpiDelta} ${isGood ? styles.boardKpiDeltaGood : styles.boardKpiDeltaBad}`}>
                      {row.delta}
                    </span>
                  </div>
                )
              })}
            </div>
          </article>
        </section>
      </div>
    )
  }

  return (
    <div className={`${styles.root} ${isNewDemo ? styles.rootNewDemo : ''}`}>
      <div className={styles.top}>
        <div className={styles.brainWrap}>
          <NewDemoDigitalBrain graphProgressPercent={graphTargetPercent} />
        </div>
      </div>
      <div className={styles.graphWrap}>
        {boardTitle ? (
          <p className={`${styles.caption} ${styles.graphCaptionAbove}`} title={boardTitle}>
            Сценарий: {boardTitle}
          </p>
        ) : null}
        <ScenarioGraph
          visibleNodeIds={visibleNodeIds}
          graphComplete={graphBuildComplete}
          isNewDemo
          graphBundle={activeGraphBundle}
        />
      </div>
      <div className={styles.under} aria-label="Список действий">
        <h3 className={`${chrome.drawerTitle} ${chrome.drawerTitleSpaced}`}>Цепочка размышлений</h3>
        <ul className={styles.chainChecklist} role="list">
          {stepsUnique.length === 0 ? (
            <li className={styles.placeholder}>Формирую цепочку…</li>
          ) : (
            visibleSteps.map((item, i) => {
              const isActive = i === visibleCount - 1 && !graphBuildComplete
              return (
                <li
                  key={item?.id ?? i}
                  className={`${styles.chainStep} ${isActive ? styles.chainStepActive : ''}`}
                >
                  <span className={styles.chainStepIcon}>✓</span>
                  <span className={styles.chainStepLabel}>{item?.label ?? ''}</span>
                </li>
              )
            })
          )}
        </ul>
        <ScenarioAnalysisDashboard
          visible={graphBuildComplete}
          isNewDemo={false}
          scenarioBranchCount={scenarioBranchCount}
          optimalVariant={optimalVariant}
          primaryCard={
            recCardPrimary
              ? { title: recCardPrimary.title, bullets: recCardPrimary.bullets }
              : null
          }
          secondaryCard={
            recCardSecondary
              ? { title: recCardSecondary.title, bullets: recCardSecondary.bullets }
              : null
          }
          kpiRowsData={kpiRowsForBrain}
        />
        {stepsUnique.length > 0 && (
          <div className={styles.actions}>
            {awaitingConfirm && onConfirm && (
              <button
                type="button"
                className={`${chrome.drawerExit} ${chrome.drawerExitSuccess}`}
                onClick={onConfirm}
                disabled={!graphBuildComplete}
              >
                Согласовать предлагаемый сценарий
              </button>
            )}
            {showRecalculate && (
              <button
                type="button"
                className={`${styles.btnResumeFromAi}`}
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
