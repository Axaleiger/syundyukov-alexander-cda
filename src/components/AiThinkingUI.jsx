import React, { useMemo } from 'react'
import './AiThinkingUI.css'

function uniqueStepsByLabel(steps) {
  const seen = new Set()
  return steps.filter((s) => {
    const l = String(s?.label ?? '').trim()
    if (!l || seen.has(l)) return false
    seen.add(l)
    return true
  })
}

/**
 * Режим мышления: чеклист шагов, текущее сообщение. Стоп/Продолжить скрыты по завершении.
 */
function AiThinkingUI({
  steps = [],
  currentMessage = '',
  isPaused = false,
  isFinished = false,
  onStop,
  onResume,
  awaitingConfirm = false,
  onConfirm,
}) {
  const stepsUnique = useMemo(() => uniqueStepsByLabel(steps), [steps])
  return (
    <div className="ai-thinking-ui">
      {stepsUnique.length > 0 && (
        <ul className="ai-thinking-ui-checklist" aria-label="Шаги выполнения">
          {stepsUnique.map((item) => (
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
      {(!isFinished || awaitingConfirm) && (
        <div className="ai-thinking-ui-actions">
          {awaitingConfirm && onConfirm ? (
            <button
              type="button"
              className="ai-thinking-ui-btn ai-thinking-ui-btn--confirm"
              onClick={onConfirm}
            >
              Согласовать
            </button>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default AiThinkingUI
