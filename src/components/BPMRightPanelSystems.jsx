import React, { useState, useMemo } from 'react'
import { SYSTEMS_LIST } from '../data/bpmData'
import './BPMRightPanel.css'

/** Рекомендованные по "светофору" — первые 5 систем как пример */
const RECOMMENDED_INDICES = [0, 3, 8, 12, 18]

function BPMRightPanelSystems({ onClose, onSelectSystem, onSelectSystems, onDeselectSystem, existingSystems, taskName, taskId, aiMode }) {
  const [search, setSearch] = useState('')
  const [customName, setCustomName] = useState('')
  const [aiPriorities, setAiPriorities] = useState(null) // after autoselect: Map or array of { name, priority 1|2|3 }

  const existingSet = useMemo(() => new Set(existingSystems || []), [existingSystems])

  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase()
    if (!q) return SYSTEMS_LIST
    return SYSTEMS_LIST.filter((s) => s.toLowerCase().includes(q))
  }, [search])

  const handleToggle = (systemName, checked) => {
    if (checked && !existingSet.has(systemName)) {
      onSelectSystem(systemName)
    } else if (!checked && existingSet.has(systemName) && typeof onDeselectSystem === 'function') {
      onDeselectSystem(systemName)
    }
  }

  const handleAutoselect = () => {
    const toAdd = RECOMMENDED_INDICES.slice(0, 3).map((i) => SYSTEMS_LIST[i]).filter(Boolean)
    const withPriority = toAdd.map((name, i) => ({ name, priority: i + 1 })) // 1, 2, 3
    setAiPriorities(withPriority)
    if (toAdd.length) {
      const newOnes = toAdd.filter((n) => !existingSet.has(n))
      if (newOnes.length) onSelectSystems(newOnes)
    }
  }

  const getPriorityFor = (name) => {
    if (!aiPriorities) return null
    const p = aiPriorities.find((x) => x.name === name)
    return p ? p.priority : null
  }

  return (
    <div className="bpm-right-panel">
      <div className="bpm-right-panel-head">
        <h3 className="bpm-right-panel-title">Добавление системы</h3>
        <button type="button" className="bpm-right-panel-close" onClick={onClose} aria-label="Закрыть">×</button>
      </div>
      <div className="bpm-right-panel-body">
        {(taskId || taskName) && (
          <div className="bpm-right-panel-task-info">
            {taskId && <span className="bpm-right-panel-task-id">Задача {taskId}</span>}
            {taskName && <strong className="bpm-right-panel-task-name">{taskName}</strong>}
          </div>
        )}
        {aiMode && (
          <button type="button" className="bpm-btn bpm-btn-primary bpm-ai-autoselect-btn" onClick={handleAutoselect}>
            ИИ-автовыбор систем
          </button>
        )}
        <div className="bpm-right-panel-search-wrap">
          <span className="bpm-right-panel-search-icon" aria-hidden />
          <input
            type="text"
            className="bpm-right-panel-search"
            placeholder="Поиск системы..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="bpm-right-panel-systems-list">
          {filtered.map((name) => {
            const checked = existingSet.has(name)
            const priority = getPriorityFor(name)
            return (
              <div key={name} className="bpm-right-panel-system-panel">
                <label className="bpm-right-panel-system-row">
                  <input
                    type="checkbox"
                    className="bpm-right-panel-system-cb"
                    checked={checked}
                    onChange={(e) => handleToggle(name, e.target.checked)}
                  />
                  <span className="bpm-right-panel-system-name">{name}</span>
                </label>
                {aiMode && priority != null && (
                  <span className={`bpm-right-panel-priority bpm-right-panel-priority-${priority}`} title={`Приоритет ${priority}`}>
                    {priority}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        <div className="bpm-right-panel-custom">
          <input
            type="text"
            className="bpm-input"
            placeholder="Ввести название вручную"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
          />
          <button type="button" className="bpm-btn-sm" onClick={() => { if (customName.trim()) { onSelectSystem(customName.trim()); onClose(); } setCustomName(''); }}>Добавить</button>
        </div>
      </div>
    </div>
  )
}

export default BPMRightPanelSystems
