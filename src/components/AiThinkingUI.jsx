import React from 'react'
import './AiThinkingUI.css'

/**
 * Режим мышления: чеклист шагов, текущее сообщение. Стоп/Продолжить скрыты по завершении.
 * Заголовок «Режим мышления» только в панели drawer, здесь не дублируем.
 */
function AiThinkingUI({
  steps = [],
  currentMessage = '',
  isPaused = false,
  isFinished = false,
  onStop,
  onResume,
}) {
  return (
    <div className="ai-thinking-ui">
      {steps.length > 0 && (
        <ul className="ai-thinking-ui-checklist" aria-label="Шаги выполнения">
          {steps.map((item) => (
            <li
              key={item.id}
              className={`ai-thinking-ui-step ai-thinking-ui-step--${item.status || 'pending'}`}
            >
              <span className="ai-thinking-ui-step-icon">
                {item.status === 'done' ? '✓' : '○'}
              </span>
              <span className="ai-thinking-ui-step-label">{item.label}</span>
            </li>
          ))}
        </ul>
      )}
      {currentMessage && (
        <p className="ai-thinking-ui-message">{currentMessage}</p>
      )}
      {!isFinished && (
        <div className="ai-thinking-ui-actions">
          {isPaused ? (
            <button
              type="button"
              className="ai-thinking-ui-btn ai-thinking-ui-btn--resume"
              onClick={onResume}
            >
              Продолжить
            </button>
          ) : (
            <button
              type="button"
              className="ai-thinking-ui-btn ai-thinking-ui-btn--stop"
              onClick={onStop}
            >
              Стоп
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default AiThinkingUI
