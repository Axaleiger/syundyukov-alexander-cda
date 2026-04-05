/** Перенесено из main-stand; не подключено к роутам — архивная копия. */
import React from 'react'

import { VARIANT_IDS } from './DecisionTree'

export function confidenceToColor(confidence) {
  if (confidence == null) return 'bg-slate-500'
  const p = confidence * 100
  if (p >= 90) return 'bg-green-600'
  if (p >= 70) return 'bg-yellow-500'
  return 'bg-red-600'
}

function buildQuestionText(node) {
  if (node.question) return node.question
  if (node.feature && node.operator && node.threshold != null) {
    const map = {
      audience_growth_rate: 'Скорость роста аудитории',
      arpu: 'ARPU',
      retention_90: 'Retention 90 дней',
      churn_rate: 'Churn rate',
      cac_ltv_ratio: 'CAC / LTV',
      organic_share: 'Доля органики',
    }
    const human = map[node.feature] || node.feature
    const opText = node.operator === '>' ? '>' : '≤'
    return `${human} ${opText} ${node.threshold}`
  }
  return 'Условие'
}

const baseCardClasses = 'dtree-node-card'

export function DecisionNode({ node, depth, activeVariant, onHover }) {
  const isLeaf = Boolean(node.scenario)
  const confidence = node.confidence ?? null

  const inActivePath =
    activeVariant != null &&
    node.variant != null &&
    node.variant === activeVariant

  const isDimmed = activeVariant != null && !inActivePath
  const ringClasses = inActivePath ? 'scale-105 ring-2 ring-blue-400 z-20' : ''
  const opacityClasses = isDimmed ? 'opacity-40 blur-[2px]' : 'opacity-100'
  const enterAnim = 'transition-all duration-200 ease-out'

  if (isLeaf) {
    const pct = confidence != null ? (confidence * 100).toFixed(1) : '--'
    const colorClass = confidenceToColor(confidence)
    const isTopGreen = confidence != null && confidence * 100 >= 90

    return (
      <div
        className={[
          baseCardClasses,
          'dtree-node-leaf',
          ringClasses,
          opacityClasses,
          enterAnim,
        ].join(' ')}
        onMouseEnter={() => onHover(confidence)}
        onMouseLeave={() => onHover(null)}
      >
        {isTopGreen && (
          <div className="dtree-leaf-dots">
            <span className="dtree-leaf-dot dtree-leaf-dot-green" />
            <span className="dtree-leaf-dot dtree-leaf-dot-green" />
            <span className="dtree-leaf-dot dtree-leaf-dot-green" />
          </div>
        )}
        <div className="dtree-leaf-caption">
          Итоговый сценарий
        </div>
        <div className="dtree-leaf-title">
          {node.scenario}
        </div>
        <div className="dtree-leaf-meta">
          <span>Уверенность</span>
          <span className="dtree-leaf-meta-value">{pct}%</span>
        </div>
        <div className="dtree-leaf-bar">
          <div
            className={`dtree-leaf-bar-fill ${colorClass}`}
            style={{ width: `${Math.min(100, (confidence ?? 0) * 100)}%` }}
          />
        </div>
      </div>
    )
  }

  const questionText = buildQuestionText(node)

  return (
    <div className="dtree-node-wrapper">
      <div
        className={[
          baseCardClasses,
          'dtree-node-internal',
          ringClasses,
          opacityClasses,
          enterAnim,
        ].join(' ')}
        onMouseEnter={() => onHover(confidence)}
        onMouseLeave={() => onHover(null)}
      >
        <div className="dtree-node-question">
          {questionText}
        </div>
        {confidence != null && (
          <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
            <span>Уверенность узла</span>
            <span className="font-semibold">{(confidence * 100).toFixed(1)}%</span>
          </div>
        )}
      </div>

      {(node.yes || node.no) && (
        <div className="dtree-children">
          {node.yes && (
            <div className="dtree-child-column">
              <div className="dtree-child-label dtree-child-label-yes">
                Да / true
              </div>
              <div className="dtree-connector-vert" />
              <DecisionNode
                node={node.yes}
                depth={depth + 1}
                activeVariant={activeVariant}
                onHover={onHover}
              />
            </div>
          )}
          {node.no && (
            <div className="dtree-child-column">
              <div className="dtree-child-label dtree-child-label-no">
                Нет / false
              </div>
              <div className="dtree-connector-vert" />
              <DecisionNode
                node={node.no}
                depth={depth + 1}
                activeVariant={activeVariant}
                onHover={onHover}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DecisionNode

