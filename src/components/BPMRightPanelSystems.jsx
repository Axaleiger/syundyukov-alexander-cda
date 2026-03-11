import React, { useState, useMemo } from 'react'
import { SYSTEMS_LIST } from '../data/bpmData'
import './BPMRightPanel.css'

function BPMRightPanelSystems({ onClose, onSelectSystem, onSelectSystems, onDeselectSystem, existingSystems, taskName, taskId, aiMode, hasUsedAiAutoselect = false, onUsedAiAutoselect, priorityIndices = [] }) {
  const [search, setSearch] = useState('')
  const [customName, setCustomName] = useState('')

  const existingSet = useMemo(() => new Set(existingSystems || []), [existingSystems])

  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase()
    const fromList = q ? SYSTEMS_LIST.filter((s) => s.toLowerCase().includes(q)) : SYSTEMS_LIST
    const fromExisting = (existingSystems || []).filter((s) => !SYSTEMS_LIST.includes(s))
    const existingFiltered = q ? fromExisting.filter((s) => s.toLowerCase().includes(q)) : fromExisting
    const combined = []
    const seen = new Set()
    ;[...fromList, ...existingFiltered].forEach((s) => {
      if (!seen.has(s)) { seen.add(s); combined.push(s) }
    })
    return combined
  }, [search, existingSystems])

  const handleToggle = (systemName, checked) => {
    if (checked && !existingSet.has(systemName)) {
      onSelectSystem(systemName)
    } else if (!checked && existingSet.has(systemName) && typeof onDeselectSystem === 'function') {
      onDeselectSystem(systemName)
    }
  }

  const handleAutoselect = () => {
    if (hasUsedAiAutoselect && priorityIndices.length > 0) return
    const indices = SYSTEMS_LIST.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, 3)
    onUsedAiAutoselect?.(indices)
    const toAdd = indices.map((i) => SYSTEMS_LIST[i]).filter(Boolean)
    const newOnes = toAdd.filter((n) => !existingSet.has(n))
    if (newOnes.length) onSelectSystems(newOnes)
  }

  const handleAddCustom = () => {
    const name = customName.trim()
    if (!name) return
    if (!existingSet.has(name)) onSelectSystem(name)
    setCustomName('')
  }

  return (
    <div className="bpm-right-panel">
      <div className="bpm-right-panel-head">
        <h3 className="bpm-right-panel-title">Добавление системы</h3>
        <button type="button" className="bpm-right-panel-close" onClick={onClose} aria-label="Закрыть">×</button>
      </div>
      <div className="bpm-right-panel-body bpm-right-panel-body-systems">
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
        <div className="bpm-right-panel-systems-list bpm-right-panel-systems-list-full">
          {filtered.map((name, idx) => {
            const checked = existingSet.has(name)
            const listIndex = SYSTEMS_LIST.indexOf(name)
            const priorityNum = hasUsedAiAutoselect && listIndex >= 0 && priorityIndices.includes(listIndex)
              ? priorityIndices.indexOf(listIndex) + 1
              : null
            return (
              <div key={`${name}-${idx}`} className="bpm-right-panel-system-item-wrap">
                <div className="bpm-right-panel-system-badges-row">
                  <div className="bpm-right-panel-system-badges">
                    <span className="bpm-right-panel-system-badge bpm-right-panel-system-badge-data">ДАННЫЕ</span>
                    <span className="bpm-right-panel-system-badge bpm-right-panel-system-badge-calc">РАСЧЁТ</span>
                    <span className="bpm-right-panel-system-badge bpm-right-panel-system-badge-result">РЕЗУЛЬТАТ</span>
                    <span className="bpm-right-panel-system-badge-info-circle" title="Информация" aria-label="Информация" />
                  </div>
                  {priorityNum != null && (
                    <span className={`bpm-right-panel-system-priority-dot bpm-right-panel-system-priority-${priorityNum}`} title="ИИ-приоритет">{priorityNum}</span>
                  )}
                </div>
                <label className="bpm-right-panel-system-row">
                  <input
                    type="checkbox"
                    className="bpm-right-panel-system-cb"
                    checked={checked}
                    onChange={(e) => handleToggle(name, e.target.checked)}
                  />
                  <span className="bpm-right-panel-system-name" title={name}>{name}</span>
                </label>
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
            onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
          />
          <button type="button" className="bpm-btn-sm" onClick={handleAddCustom}>Добавить</button>
        </div>
      </div>
    </div>
  )
}

export default BPMRightPanelSystems
