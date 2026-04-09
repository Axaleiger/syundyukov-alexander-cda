import React, { useMemo } from 'react'
import styles from './AiThinkingUI.module.css'
import chrome from './thinkingDrawerChrome.module.css'

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
  isNewDemo = false,
}) {
  const stepsUnique = useMemo(() => uniqueStepsByLabel(steps), [steps])
  return (
    <div className={`${styles.root} ${isNewDemo ? styles.rootNewDemo : ''}`}>
      {stepsUnique.length > 0 && (
        <ul className={styles.checklist} aria-label="Шаги выполнения">
          {stepsUnique.map((item) => (
            <li
              key={item.id}
              className={`${styles.step} ${(item.status || 'pending') === 'done' ? styles.stepDone : ''}`}
            >
              <span className={styles.stepIcon}>
                {item.status === 'done' ? '✓' : '○'}
              </span>
              <span className={styles.stepLabel}>{item.label}</span>
            </li>
          ))}
        </ul>
      )}
      {currentMessage && (
        <p className={styles.message}>{currentMessage}</p>
      )}
      {(!isFinished || awaitingConfirm) && (
        <div className={styles.actions}>
          {awaitingConfirm && onConfirm ? (
            <button
              type="button"
              className={`${chrome.drawerExit} ${chrome.drawerExitSuccess}`}
              onClick={onConfirm}
            >
              Согласовать предлагаемый сценарий
            </button>
          ) : (
            <>
              {isPaused ? (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnResume}`}
                  onClick={onResume}
                >
                  Продолжить
                </button>
              ) : (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnStop}`}
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
