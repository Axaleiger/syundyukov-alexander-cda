import React, { useState, useRef, useCallback, useEffect } from 'react'
import './AIAssistantWidget.css'
import { isSupported, startListening, stopListening, getTranscript } from '../lib/voiceHandler'
import { classifyIntent } from '../lib/intentClassifier'
import { runScenario } from '../lib/scenarioExecutors'
import AiThinkingUI from './AiThinkingUI'

const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ai-assistant-mic-svg">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
)

/**
 * ИИ-помощник: плавающая кнопка и панель. Микрофон всегда виден и включён.
 */
function AIAssistantWidget({
  visible,
  onClose,
  setActiveTab,
  setBpmCommand,
  setResultsDashboardFocus,
  onBpmCommandConsumedRef,
  onThinkingPanelOpen,
  isThinkingPanelOpen,
  thinkingSteps,
  currentMessage,
  isPaused,
  addThinkingStep,
  setThinkingSteps,
  setCurrentMessage,
  setIsPaused,
  setClarificationMessage,
}) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [position, setPosition] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [voiceError, setVoiceError] = useState(null)
  const [clarificationText, setClarificationText] = useState(null)
  const [chatHistory, setChatHistory] = useState([])
  const dragStart = useRef({ x: 0, y: 0, left: 0, top: 0 })
  const didDrag = useRef(false)
  const widgetRef = useRef(null)
  const isPausedRef = useRef(false)
  const lastTopicRef = useRef(null)
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') + '/'
  isPausedRef.current = isPaused

  const [localThinkingSteps, setLocalThinkingSteps] = useState([])
  const addThinkingStepLocal = useCallback((label) => {
    setLocalThinkingSteps((s) => [...s, { id: `step-${Date.now()}`, label, status: 'done' }])
    setCurrentMessage?.(label)
  }, [setCurrentMessage])
  const steps = thinkingSteps ?? localThinkingSteps
  const addStep = addThinkingStep ?? addThinkingStepLocal
  const displayClarification = clarificationText
  const setClarification = setClarificationMessage || setClarificationText

  useEffect(() => {
    if (!onBpmCommandConsumedRef) return
    onBpmCommandConsumedRef.current = () => addStep?.('Готово ✓')
    return () => { onBpmCommandConsumedRef.current = null }
  }, [onBpmCommandConsumedRef, addStep])

  const handlePointerDown = useCallback((e) => {
    if (!e.target.closest('.ai-assistant-toggle') && !e.target.closest('.ai-assistant-panel')) return
    if (e.target.closest('.ai-assistant-panel-close') || e.target.closest('.ai-assistant-input') || e.target.closest('.ai-assistant-send') || e.target.closest('.ai-assistant-mic') || e.target.closest('.ai-assistant-open-thinking')) return
    didDrag.current = false
    const el = widgetRef.current
    const left = position != null ? position.x : (el ? el.getBoundingClientRect().left : 0)
    const top = position != null ? position.y : (el ? el.getBoundingClientRect().top : 0)
    dragStart.current = { x: e.clientX - left, y: e.clientY - top, left, top }
    setDragging(true)
  }, [position])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => {
      didDrag.current = true
      const nx = e.clientX - dragStart.current.x
      const ny = e.clientY - dragStart.current.y
      setPosition({ x: Math.max(0, nx), y: Math.max(0, ny) })
    }
    const onUp = () => setDragging(false)
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
  }, [dragging])

  const handleToggleClick = useCallback(() => {
    if (didDrag.current) return
    setOpen((o) => !o)
  }, [])

  useEffect(() => {
    if (!open || position == null) return
    const el = widgetRef.current
    if (!el) return
    const panel = el.querySelector('.ai-assistant-panel')
    if (!panel) return
    requestAnimationFrame(() => {
      const panelHeight = panel.offsetHeight || 320
      const toggleHeight = 60
      const bottom = position.y + toggleHeight + panelHeight
      if (bottom > window.innerHeight - 24) {
        const newY = Math.max(0, window.innerHeight - 24 - panelHeight - toggleHeight)
        setPosition((p) => (p && p.y !== newY ? { ...p, y: newY } : p))
      }
    })
  }, [open, position])

  const handleMicClick = useCallback(() => {
    if (!isSupported) return
    setVoiceError(null)
    if (isListening) {
      stopListening()
      setTranscript(getTranscript())
      setIsListening(false)
      return
    }
    setTranscript('')
    startListening(
      (text) => setTranscript(text),
      (err) => {
        setVoiceError(err)
        setIsListening(false)
      }
    )
    setIsListening(true)
  }, [isListening])

  useEffect(() => {
    if (!isListening) return
    return () => { stopListening() }
  }, [isListening])

  const runExecutor = useCallback(
    async (scenarioId, topicOrMetric) => {
      setThinkingSteps?.([])
      setLocalThinkingSteps([])
      setCurrentMessage?.('')
      setIsPaused?.(false)
      setClarification(null)
      setOpen(true)
      onThinkingPanelOpen?.(true)
      const ctx = {
        setActiveTab,
        setBpmCommand,
        setResultsDashboardFocus,
        addThinkingStep: addStep,
        isPaused: () => isPausedRef.current,
      }
      try {
        await runScenario(scenarioId, ctx, topicOrMetric)
      } catch (err) {
        addStep?.(`Ошибка: ${err?.message || 'неизвестная'}`)
      }
    },
    [setActiveTab, setBpmCommand, setResultsDashboardFocus, addStep, setThinkingSteps, setCurrentMessage, setIsPaused, onThinkingPanelOpen]
  )

  const handleSend = useCallback(() => {
    const text = (transcript || question || '').trim()
    setTranscript('')
    setQuestion('')
    if (!text) return

    setChatHistory((h) => [...h.slice(-14), { role: 'user', text }])

    if (/добавь ещё|ещё карточку|ещё одну|продолжи|добавь карточку/i.test(text) && lastTopicRef.current) {
      setChatHistory((h) => [...h, { role: 'assistant', text: 'Добавляю карточку…' }])
      runExecutor('createPlanningCase', lastTopicRef.current)
      return
    }

    const result = classifyIntent(text)
    const { scenarioId, confidence, topic, metric } = result
    const topicOrMetric = topic ?? metric

    if (scenarioId === 'createPlanningCase' && topicOrMetric) lastTopicRef.current = topicOrMetric

    if (confidence >= 0.95 && scenarioId) {
      setChatHistory((h) => [...h, { role: 'assistant', text: 'Выполняю…' }])
      runExecutor(scenarioId, topicOrMetric)
      return
    }
    if (confidence < 0.7) {
      setClarification('Уточните: создание кейса, фокус на метрику, полный проект, риски или cashflow.')
      setOpen(true)
      return
    }
    setClarification('Уточните: создание кейса, фокус на метрику, полный проект, риски или cashflow.')
    setOpen(true)
  }, [question, transcript, runExecutor])

  const handleStopThinking = useCallback(() => setIsPaused?.(true), [setIsPaused])
  const handleResumeThinking = useCallback(() => setIsPaused?.(false), [setIsPaused])

  if (!visible) return null

  const style = position != null ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : {}
  const inputValue = transcript || question
  const isThinkingMode = (thinkingSteps ?? localThinkingSteps).length > 0

  return (
    <div ref={widgetRef} className={`ai-assistant-widget ${open ? 'ai-assistant-widget-open' : ''} ${dragging ? 'ai-assistant-widget-dragging' : ''}`} style={style}>
      <div className="ai-assistant-panel" onPointerDown={handlePointerDown}>
        <div className="ai-assistant-panel-header">
          <span className="ai-assistant-panel-title">ИИ-помощник</span>
          <span className="ai-assistant-online">
            <span className="ai-assistant-dot" /> online
          </span>
          <button type="button" className="ai-assistant-panel-close" onClick={() => setOpen(false)} aria-label="Свернуть">×</button>
        </div>

        {isThinkingMode ? (
          <>
            <p className="ai-assistant-greeting">Режим мышления открыт в правой панели.</p>
            <button type="button" className="ai-assistant-open-thinking" onClick={() => onThinkingPanelOpen?.(true)}>
              Открыть мышление
            </button>
          </>
        ) : (
          <>
            {chatHistory.length > 0 && (
              <div className="ai-assistant-chat-history">
                {chatHistory.slice(-6).map((msg, i) => (
                  <p key={i} className={`ai-assistant-msg ai-assistant-msg-${msg.role}`}>
                    <span className="ai-assistant-msg-role">{msg.role === 'user' ? 'Вы' : 'ИИ'}:</span> {msg.text}
                  </p>
                ))}
              </div>
            )}
            <p className="ai-assistant-greeting">{chatHistory.length ? 'Продолжайте диалог.' : 'Здравствуйте, задайте свой промпт.'}</p>
            <button type="button" className="ai-assistant-open-thinking" onClick={() => onThinkingPanelOpen?.(true)}>
              Открыть мышление
            </button>
            {displayClarification && (
              <p className="ai-assistant-clarification">{displayClarification}</p>
            )}
            {voiceError && (
              <p className="ai-assistant-voice-error">{voiceError}</p>
            )}
            <div className="ai-assistant-input-row">
              <textarea
                className="ai-assistant-input"
                placeholder={isListening ? 'Слушаю…' : 'Введите промпт'}
                value={inputValue}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                rows={3}
                disabled={isListening}
              />
              <button
                type="button"
                className={`ai-assistant-mic ${isListening ? 'ai-assistant-mic-active' : ''} ${!isSupported ? 'ai-assistant-mic-disabled' : ''}`}
                onClick={handleMicClick}
                title={isSupported ? (isListening ? 'Остановить' : 'Голосовой ввод') : 'Голос недоступен'}
                aria-label={isListening ? 'Остановить запись' : 'Голосовой ввод'}
              >
                <MicIcon />
              </button>
            </div>
            <button type="button" className="ai-assistant-send" onClick={handleSend}>
              Отправить
            </button>
          </>
        )}
      </div>
      <button
        type="button"
        className="ai-assistant-toggle"
        onPointerDown={handlePointerDown}
        onClick={handleToggleClick}
        aria-label={open ? 'Свернуть ИИ-помощник' : 'Открыть ИИ-помощник'}
        title="ИИ-помощник (перетащите для перемещения)"
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
