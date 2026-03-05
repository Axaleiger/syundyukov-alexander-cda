import React, { useState } from 'react'
import './AIAssistantWidget.css'

/**
 * ИИ-помощник: показывается на всех страницах при включённом режиме ИИ.
 * Кнопка с гифкой робота, зелёная точка «онлайн», при раскрытии — окно с приветствием и полем вопроса.
 */
function AIAssistantWidget({ visible, onClose }) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') + '/'

  if (!visible) return null

  return (
    <div className={`ai-assistant-widget ${open ? 'ai-assistant-widget-open' : ''}`}>
      <div className="ai-assistant-panel">
        <div className="ai-assistant-panel-header">
          <span className="ai-assistant-panel-title">ИИ-помощник</span>
          <span className="ai-assistant-online">
            <span className="ai-assistant-dot" /> online
          </span>
          <button type="button" className="ai-assistant-panel-close" onClick={() => setOpen(false)} aria-label="Свернуть">×</button>
        </div>
        <p className="ai-assistant-greeting">Здравствуйте, задайте свой вопрос.</p>
        <textarea
          className="ai-assistant-input"
          placeholder="Введите вопрос..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
        />
        <button type="button" className="ai-assistant-send">Отправить</button>
      </div>
      <button
        type="button"
        className="ai-assistant-toggle"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Свернуть ИИ-помощник' : 'Открыть ИИ-помощник'}
        title="ИИ-помощник"
      >
        <span className="ai-assistant-avatar-wrap">
          <img src={`${base}ai-assistent.gif`} alt="" className="ai-assistant-avatar" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling?.classList.add('ai-assistant-avatar-fallback-visible'); }} />
          <span className="ai-assistant-avatar-fallback">🤖</span>
          <span className="ai-assistant-dot ai-assistant-dot-btn" title="Онлайн" />
        </span>
        <span className="ai-assistant-toggle-label">ИИ-помощник</span>
      </button>
    </div>
  )
}

export default AIAssistantWidget
