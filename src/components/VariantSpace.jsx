import React from 'react'
import './VariantSpace.css'

const LEVELS_CONFIG = [
  { key: 'cda', title: 'ЦД актива', items: ['ЦДА', 'ЦД двойник актива'] },
  { key: 'program', title: 'ЦД программы', items: ['ЦДРБ', 'АВНМ', 'ЦДП', 'ЦДПр', 'ЦД Разведки и добычи', 'ЦД ресурсной базы', 'ЦД проектных решений', 'ЦД новых мощностей'] },
  { key: 'object', title: 'ЦД объекта', items: ['ЦД промысла', 'ЦД Экосистемы БРД', 'ЦД пласта', 'ЦД скважины', 'ЦД инфраструктуры', 'Многовариантная ГГМ', 'ЦД трубопроводной системы', 'ЦД системы подготовки', 'ЦД газового оборудования', 'ЦД энергетики'] },
  { key: 'services', title: 'Сервисы', items: ['Б6К', 'СПекТР', 'КФА', 'eXoil', 'ГибРИМА', 'КФА-2', 'Цифра', 'Геонавигация', 'Мониторинг', 'Аналитика'] },
  { key: 'micro', title: 'Микросервисы', items: Array.from({ length: 10 }, (_, i) => `Микросервис ${i + 1}`) },
  { key: 'functions', title: 'Функции', items: Array.from({ length: 10 }, (_, i) => `Функция ${i + 1}`) },
]

function getPathForVariant(variantId) {
  const path = []
  let idx = variantId
  for (const level of LEVELS_CONFIG) {
    const n = level.items.length
    path.push(level.items[idx % n])
    idx = Math.floor(idx / n)
  }
  return path
}

function VariantSpace({ variantId, onClose, inline }) {
  if (variantId == null) return null
  const path = getPathForVariant(variantId)

  const content = (
    <div className="variant-space-wormhole-planes">
      <div className="variant-space-wormhole-header">
        <span className="variant-space-wormhole-title">Пространство вариантов (вариант #{variantId + 1})</span>
        <button type="button" className="variant-space-close-inline" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </div>
      <div className="variant-space-planes-stack">
        <div className="variant-space-plane-line" aria-hidden="true" />
        {LEVELS_CONFIG.map((level, index) => (
          <div
            key={level.key}
            className="variant-space-plane"
            style={{ '--level': index + 1 }}
          >
            <div className="variant-space-plane-label">{level.title}</div>
            <div className="variant-space-plane-item variant-space-plane-item-selected">
              {path[index]}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  if (inline) {
    return <div className="variant-space-inline">{content}</div>
  }

  return (
    <div className="variant-space-overlay" onClick={onClose}>
      <div className="variant-space-modal" onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </div>
  )
}

export default VariantSpace
