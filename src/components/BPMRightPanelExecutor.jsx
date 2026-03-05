import React, { useState } from 'react'
import { PERSONNEL } from '../data/bpmData'
import './BPMRightPanel.css'

function avatarColor(name) {
  if (!name || !String(name).trim()) return '#94a3b8'
  let h = 0
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h) + name.charCodeAt(i) | 0
  return `hsl(${Math.abs(h % 360)}, 55%, 45%)`
}

function getInitials(name) {
  if (!name || !String(name).trim()) return '?'
  const parts = String(name).trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2)
  return String(name).slice(0, 2).toUpperCase()
}

function BPMRightPanelExecutor({ onClose, onSelect, roleLabel, currentValue, aiMode }) {
  const [search, setSearch] = useState('')
  const [expandedUser, setExpandedUser] = useState(null)
  const [switchOn, setSwitchOn] = useState(false)
  const title = roleLabel === 'Согласующий' ? 'Выбор согласующего' : 'Выбор исполнителя'

  const filtered = (search || '').trim()
    ? PERSONNEL.filter((p) => p.toLowerCase().includes((search || '').trim().toLowerCase()))
    : PERSONNEL

  const handleAiAutoselect = () => {
    const first = filtered[0]
    if (first) {
      onSelect(first)
      onClose()
    }
  }

  return (
    <div className="bpm-right-panel">
      <div className="bpm-right-panel-head">
        <h3 className="bpm-right-panel-title">{title}</h3>
        <button type="button" className="bpm-right-panel-close" onClick={onClose} aria-label="Закрыть">×</button>
      </div>
      <div className="bpm-right-panel-body">
        {aiMode && (
          <button type="button" className="bpm-btn bpm-btn-primary bpm-ai-autoselect-btn" onClick={handleAiAutoselect}>
            ИИ-автовыбор {roleLabel === 'Согласующий' ? 'согласующего' : 'исполнителя'}
          </button>
        )}
        <div className="bpm-right-panel-search-wrap">
          <span className="bpm-right-panel-search-icon" aria-hidden />
          <input
            type="text"
            className="bpm-right-panel-search"
            placeholder="Поиск по имени..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="bpm-right-panel-list bpm-right-panel-users bpm-right-panel-users-choosing">
          {filtered.map((name) => (
            <div key={name} className="bpm-right-panel-user-block">
              <div
                className={`bpm-right-panel-user-row ${currentValue === name ? 'active' : ''}`}
                onClick={() => { onSelect(name); onClose(); }}
              >
                <span className="bpm-right-panel-user-avatar bpm-right-panel-user-avatar-lg" style={{ background: avatarColor(name) }}>{getInitials(name).slice(0, 1)}</span>
                <span className="bpm-right-panel-user-name">{name}</span>
                <button
                  type="button"
                  className="bpm-right-panel-user-expand"
                  onClick={(e) => { e.stopPropagation(); setExpandedUser(expandedUser === name ? null : name); }}
                  aria-label={expandedUser === name ? 'Свернуть' : 'Развернуть'}
                >
                  <span className={`bpm-card-collapse-arrow ${expandedUser === name ? 'bpm-card-collapse-arrow-up' : 'bpm-card-collapse-arrow-down'}`} />
                </button>
              </div>
              {expandedUser === name && (
                <div className="bpm-right-panel-user-details">
                  <label className="bpm-right-panel-switch-row">
                    <span className="bpm-right-panel-switch-wrap">
                      <button type="button" className={`bpm-right-panel-switch ${switchOn ? 'on' : ''}`} onClick={() => setSwitchOn(!switchOn)} role="switch" aria-checked={switchOn}>
                        <span className="bpm-right-panel-switch-thumb" />
                      </button>
                    </span>
                    <span className="bpm-right-panel-switch-label">Подробная информация</span>
                  </label>
                  <div className="bpm-right-panel-info-row">
                    <span className="bpm-right-panel-info-label">Должность</span>
                    <span className="bpm-right-panel-info-value">Специалист</span>
                  </div>
                  <div className="bpm-right-panel-info-row">
                    <span className="bpm-right-panel-info-label">Подразделение</span>
                    <span className="bpm-right-panel-info-value">Отдел разработки</span>
                  </div>
                  <div className="bpm-right-panel-info-row">
                    <span className="bpm-right-panel-info-label">Статус</span>
                    <span className="bpm-right-panel-info-value bpm-right-panel-info-value-alert">Загружен</span>
                  </div>
                  <div className="bpm-right-panel-badges">
                    <span className="bpm-right-panel-badge bpm-right-panel-badge-system">Назначен</span>
                    <span className="bpm-right-panel-badge bpm-right-panel-badge-system">В работе</span>
                  </div>
                  <div className="bpm-right-panel-textarea-wrap">
                    <label className="bpm-right-panel-textarea-label">Комментарий</label>
                    <textarea className="bpm-right-panel-textarea" placeholder="Введите комментарий..." rows={3} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default BPMRightPanelExecutor
