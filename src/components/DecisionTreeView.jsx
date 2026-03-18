import React, { useState, useMemo } from 'react'
import './DecisionTreeView.css'
import ScenarioSankeyNivo, { getVariantScores } from './ScenarioSankeyNivo'

function DecisionTreeView({ selectedPathId, onSelect, growthProgress = 1, stepsVisibleCount }) {
  const [hoverPathId, setHoverPathId] = useState(null)

  const variants = useMemo(() => {
    const scores = getVariantScores()
    return [
      { id: 'variant-1', label: 'Вариант 1', prob: Number(scores['variant-1']).toFixed(1) },
      { id: 'variant-2', label: 'Вариант 2', prob: Number(scores['variant-2']).toFixed(1) },
      { id: 'variant-3', label: 'Вариант 3', prob: Number(scores['variant-3']).toFixed(1) },
    ]
  }, [])

  const activeVariantId = hoverPathId || selectedPathId || null

  return (
    <div className="decision-tree-view">
      <h4 className="decision-tree-title">Дерево вычисления решений</h4>
      <div className="decision-tree-graph-wrap">
        <ScenarioSankeyNivo
          activePathId={activeVariantId}
          onVariantSelect={onSelect}
          onVariantHover={setHoverPathId}
          growthProgress={growthProgress}
          stepsVisibleCount={stepsVisibleCount}
        />
      </div>
      <div className="decision-tree-buttons">
        {variants.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`decision-tree-btn ${
              hoverPathId === v.id || selectedPathId === v.id ? 'decision-tree-btn-hover' : ''
            }`}
            onMouseEnter={() => setHoverPathId(v.id)}
            onMouseLeave={() => setHoverPathId(null)}
            onClick={() => {
              const next = selectedPathId === v.id ? null : v.id
              onSelect?.(next)
            }}
          >
            <span className="decision-tree-btn-label">{v.label}</span>
            <span className="decision-tree-btn-pct">{v.prob}%</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default DecisionTreeView
