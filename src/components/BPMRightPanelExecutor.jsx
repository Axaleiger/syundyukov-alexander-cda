import React, { useState } from 'react'
import { PERSONNEL } from '../data/bpmData'
import './BPMRightPanel.css'

const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') + '/'

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

function isSyundyukov(name) {
  return /сюндюков/i.test(name || '')
}

/** Загруженность 1–10: цвет зелёный 1–3, жёлтый 4–5, оранжевый 6–7, красный 8–9, чёрный 10 */
function getLoadColor(load) {
  if (load <= 3) return '#22c55e'
  if (load <= 5) return '#eab308'
  if (load <= 7) return '#f97316'
  if (load <= 9) return '#ef4444'
  return '#1f2937'
}

/** Рандом 1–10 по имени */
function getLoadByName(name) {
  let h = 0
  for (let i = 0; i < (name || '').length; i++) h = ((h << 5) - h) + (name || '').charCodeAt(i) | 0
  return (Math.abs(h) % 10) + 1
}

/** Email по фамилии (латиница); Сюндюков: Syundyukov@gpn.ru */
function getEmailByName(name) {
  if (isSyundyukov(name)) return 'Syundyukov@gpn.ru'
  const parts = String(name || '').trim().split(/\s+/)
  const fam = parts[0] || 'User'
  const translit = fam.replace(/[ёий]/gi, (c) => ({ ё: 'e', и: 'i', й: 'y' }[c.toLowerCase()] || c))
  const latin = translit.replace(/[а-яА-Я]/g, (c) => {
    const map = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' }
    return map[c.toLowerCase()] ? (c === c.toUpperCase() ? map[c.toLowerCase()].charAt(0).toUpperCase() + map[c.toLowerCase()].slice(1) : map[c.toLowerCase()]) : c
  })
  return (latin + '@gpn.ru').replace(/\s+/g, '')
}

/** Руководитель: Сюндюков — Слабецкий А.А., остальные — рандом из списка по имени */
function getManagerByName(name, personnel) {
  if (isSyundyukov(name)) return 'Слабецкий А.А.'
  const others = (personnel || []).filter((p) => p !== name && !isSyundyukov(p))
  if (others.length === 0) return '—'
  let h = 0
  for (let i = 0; i < (name || '').length; i++) h = ((h << 5) - h) + (name || '').charCodeAt(i) | 0
  return others[Math.abs(h) % others.length]
}

function BPMRightPanelExecutor({ onClose, onSelect, roleLabel, currentValue, aiMode }) {
  const [search, setSearch] = useState('')
  const [expandedUser, setExpandedUser] = useState(null)
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

  const handleSelectUser = (name) => {
    onSelect(name)
    onClose()
  }

  return (
    <div className="bpm-right-panel bpm-right-panel-executor-full">
      <div className="bpm-right-panel-head">
        <h3 className="bpm-right-panel-title">{title}</h3>
        <button type="button" className="bpm-right-panel-close" onClick={onClose} aria-label="Закрыть">×</button>
      </div>
      <div className="bpm-right-panel-body bpm-right-panel-body-full">
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
            placeholder="Выберите сотрудника"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="bpm-right-panel-list bpm-right-panel-users bpm-right-panel-users-full">
          {filtered.map((name) => {
            const isExpanded = expandedUser === name
            const load = getLoadByName(name)
            const loadColor = getLoadColor(load)
            const manager = getManagerByName(name, PERSONNEL)
            const email = getEmailByName(name)
            return (
              <div key={name} className="bpm-right-panel-user-block">
                <div
                  className={`bpm-right-panel-user-row-wrap ${currentValue === name ? 'active' : ''} ${isExpanded ? 'bpm-right-panel-user-row-expanded' : ''}`}
                >
                  <div className="bpm-right-panel-user-row-inner" onClick={() => setExpandedUser(isExpanded ? null : name)}>
                    {isSyundyukov(name) ? (
                      <img src={`${base}sanya-bodibilder.png`} alt="" className="bpm-right-panel-user-avatar bpm-right-panel-user-avatar-img" />
                    ) : (
                      <span className="bpm-right-panel-user-avatar" style={{ background: avatarColor(name) }}>{getInitials(name).slice(0, 1)}</span>
                    )}
                    <div className="bpm-right-panel-user-info">
                      <span className="bpm-right-panel-user-name">{name}</span>
                      <span className="bpm-right-panel-user-role-label">{isSyundyukov(name) ? 'Эксперт' : 'Должность'}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="bpm-right-panel-user-expand"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpandedUser(isExpanded ? null : name); }}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
                  >
                    <span className={`bpm-card-collapse-arrow ${isExpanded ? 'bpm-card-collapse-arrow-up' : ''}`} />
                  </button>
                </div>
                {isExpanded && (
                  <div className="bpm-right-panel-user-details">
                    <div className="bpm-right-panel-user-details-photo">
                      {isSyundyukov(name) ? (
                        <img src={`${base}sanya-bodibilder.png`} alt="" className="bpm-right-panel-user-photo-img" />
                      ) : (
                        <span className="bpm-right-panel-user-photo-avatar" style={{ background: avatarColor(name) }}>{getInitials(name)}</span>
                      )}
                    </div>
                    <div className="bpm-right-panel-switch-row" onClick={() => handleSelectUser(name)}>
                      <div className="bpm-right-panel-switch-wrap">
                        <span className="bpm-right-panel-switch on"><span className="bpm-right-panel-switch-thumb" /></span>
                      </div>
                      <span className="bpm-right-panel-switch-label">
                        {roleLabel === 'Согласующий' ? 'Выбрать согласующим' : 'Выбрать исполнителем'}
                      </span>
                    </div>
                    <div className="bpm-right-panel-info-row">
                      <span className="bpm-right-panel-info-label">Должность</span>
                      <span className="bpm-right-panel-info-value">{isSyundyukov(name) ? 'Эксперт' : 'Должность'}</span>
                    </div>
                    <div className="bpm-right-panel-info-row">
                      <span className="bpm-right-panel-info-label">Должностная инструкция</span>
                      <span className="bpm-right-panel-info-value">Модельер ГДМ</span>
                    </div>
                    <div className="bpm-right-panel-info-row">
                      <span className="bpm-right-panel-info-label">Текущая загруженность</span>
                      <span className="bpm-right-panel-info-value" style={{ color: loadColor }}>{load}</span>
                    </div>
                    <div className="bpm-right-panel-info-row">
                      <span className="bpm-right-panel-info-label">Руководитель</span>
                      <span className="bpm-right-panel-info-value">{manager}</span>
                    </div>
                    <div className="bpm-right-panel-info-row">
                      <span className="bpm-right-panel-info-label">Почта</span>
                      <span className="bpm-right-panel-info-value">{email}</span>
                    </div>
                    <div className="bpm-right-panel-info-row">
                      <span className="bpm-right-panel-info-label">Профильные компетенции</span>
                      <div className="bpm-right-panel-badges">
                        <span className="bpm-right-panel-badge">КОМПЕТЕНЦИЯ 1</span>
                        <span className="bpm-right-panel-badge">КОМПЕТЕНЦИЯ 2</span>
                        <span className="bpm-right-panel-badge">КОМПЕТЕНЦИЯ 3</span>
                      </div>
                    </div>
                    <div className="bpm-right-panel-textarea-wrap">
                      <span className="bpm-right-panel-textarea-label">Комментарий</span>
                      <textarea className="bpm-right-panel-textarea" placeholder="Введите текст" rows={2} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default BPMRightPanelExecutor
