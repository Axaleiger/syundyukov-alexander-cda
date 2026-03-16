import React, { useState } from 'react'
import './DecisionTreeView.css'
import ScenarioSankeyNivo from './ScenarioSankeyNivo'

function DecisionTreeView({ selectedPathId, onSelect }) {
  const [hoverPathId, setHoverPathId] = useState(null)

  const variants = [
    { id: 'variant-1', label: 'Вариант 1', prob: '94.2' },
    { id: 'variant-2', label: 'Вариант 2', prob: '92.5' },
    { id: 'variant-3', label: 'Вариант 3', prob: '90.3' },
  ]

  const activeVariantId = hoverPathId || selectedPathId || null

  return (
    <div className="decision-tree-view">
      <h4 className="decision-tree-title">Дерево вычисления решений</h4>
      <div className="decision-tree-graph-wrap">
        <ScenarioSankeyNivo
          activePathId={activeVariantId}
          onVariantSelect={onSelect}
          onVariantHover={setHoverPathId}
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
            onClick={() => onSelect?.(v.id)}
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
