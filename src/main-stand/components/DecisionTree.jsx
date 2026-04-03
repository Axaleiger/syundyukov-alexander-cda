import React, { useMemo, useState } from 'react'
import DecisionNode from './DecisionNode'

export const VARIANT_IDS = [1, 2, 3]

export const decisionTreeRoot = {
  question: 'Скорость роста аудитории > 25% в год?',
  feature: 'audience_growth_rate',
  operator: '>',
  threshold: 25,
  variant: 1,
  yes: {
    question: 'ARPU > 1500 ₽?',
    feature: 'arpu',
    operator: '>',
    threshold: 1500,
    variant: 1,
    yes: {
      question: 'Retention 90-дн > 45%?',
      feature: 'retention_90',
      operator: '>',
      threshold: 45,
      variant: 1,
      yes: {
        scenario: 'Сценарий A — быстрая монетизация',
        confidence: 0.94,
        variant: 1,
      },
      no: {
        scenario: 'Сценарий A1 — рост с докруткой монетизации',
        confidence: 0.88,
        variant: 1,
      },
    },
    no: {
      question: 'LTV > 4500 ₽?',
      feature: 'ltv',
      operator: '>',
      threshold: 4500,
      variant: 2,
      yes: {
        scenario: 'Сценарий B — премиум-модель с оттоком',
        confidence: 0.83,
        variant: 2,
      },
      no: {
        scenario: 'Сценарий B1 — мягкая монетизация без риска',
        confidence: 0.77,
        variant: 2,
      },
    },
  },
  no: {
    question: 'Churn rate > 18%?',
    feature: 'churn_rate',
    operator: '>',
    threshold: 18,
    variant: 3,
    yes: {
      question: 'CAC / LTV > 0.35?',
      feature: 'cac_ltv_ratio',
      operator: '>',
      threshold: 0.35,
      variant: 3,
      yes: {
        scenario: 'Сценарий C — рискованная экспансия',
        confidence: 0.58,
        variant: 3,
      },
      no: {
        scenario: 'Сценарий C1 — оптимизация маркетинга и удержания',
        confidence: 0.71,
        variant: 2,
      },
    },
    no: {
      question: 'Доля органики > 55%?',
      feature: 'organic_share',
      operator: '>',
      threshold: 55,
      variant: 1,
      yes: {
        scenario: 'Кейс D — органический рост без бюджета',
        confidence: 0.91,
        variant: 1,
      },
      no: {
        scenario: 'Кейс D1 — гибридный рост с осторожной экспансией',
        confidence: 0.82,
        variant: 2,
      },
    },
  },
}

function collectLeaves(node, acc = []) {
  if (!node) return acc
  if (node.scenario) {
    acc.push(node)
  } else {
    collectLeaves(node.yes, acc)
    collectLeaves(node.no, acc)
  }
  return acc
}

function DecisionTree({ onVariantChange, selectedPathId }) {
  const initialVariant =
    selectedPathId === 'variant-1'
      ? 1
      : selectedPathId === 'variant-2'
        ? 2
        : selectedPathId === 'variant-3'
          ? 3
          : null
  const [activeVariant, setActiveVariant] = useState(initialVariant)
  const [hoveredConfidence, setHoveredConfidence] = useState(null)

  const leaves = useMemo(() => collectLeaves(decisionTreeRoot), [])

  const topVariants = useMemo(() => {
    const grouped = {}
    leaves.forEach((leaf) => {
      if (!leaf.variant) return
      const key = String(leaf.variant)
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(leaf)
    })
    const result = { 1: null, 2: null, 3: null }
    VARIANT_IDS.forEach((v) => {
      const list = grouped[String(v)] || []
      const best = list.slice().sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0] || null
      result[v] = best
    })
    return result
  }, [leaves])

  const confidenceText =
    hoveredConfidence != null
      ? `Уверенность / вероятность успеха: ${(hoveredConfidence * 100).toFixed(1)}%`
      : 'Наведите на узел, чтобы увидеть уверенность.'

  const handleVariantToggle = (variant) => {
    setActiveVariant((prev) => {
      const next = prev === variant ? null : variant
      if (onVariantChange) onVariantChange(next)
      return next
    })
  }

  return (
    <div className="dtree-root">
      <div className="dtree-scroll">
        <div className="dtree-tree">
          <DecisionNode
            node={decisionTreeRoot}
            depth={0}
            activeVariant={activeVariant}
            onHover={setHoveredConfidence}
          />
        </div>
      </div>

      <div className="dtree-confidence">
        {confidenceText}
      </div>

      <div className="dtree-variants">
        {VARIANT_IDS.map((v, index) => {
          const bestLeaf = topVariants[v]
          const pct = bestLeaf?.confidence != null ? (bestLeaf.confidence * 100).toFixed(1) : '--'
          const isActive = activeVariant === v
          return (
            <button
              key={v}
              type="button"
              className={`dtree-variant-btn ${isActive ? 'dtree-variant-btn-active' : ''}`}
              onClick={() => handleVariantToggle(v)}
              onMouseEnter={() => {
                if (bestLeaf?.confidence != null) setHoveredConfidence(bestLeaf.confidence)
              }}
              onMouseLeave={() => setHoveredConfidence(null)}
            >
              <span className="dtree-variant-label">Вариант {index + 1}</span>
              <span className="dtree-variant-confidence">Уверенность: {pct}%</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default DecisionTree

