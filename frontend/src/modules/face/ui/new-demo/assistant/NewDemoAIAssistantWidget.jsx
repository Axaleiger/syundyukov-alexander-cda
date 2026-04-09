import React, { useState, useRef, useCallback, useEffect } from "react"
import styles from "./NewDemoAIAssistantWidget.module.css"
import { isSupported, startListening, stopListening, getTranscript } from "../../../../ai/lib/voiceHandler"
import { classifyIntent } from "../../../../ai/lib/intentClassifier"
import { runScenario } from "../../../../ai/lib/scenarioExecutors"

const UNRECOGNIZED_SUGGESTIONS = [
	"Сформируй сквозной сценарий по управлению базовой добычей",
	"Построй сценарий с фокусом на снижение рисков",
	"Собери полный проект с этапами и метриками",
]

const MicIcon = ({ className }) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
	>
		<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
		<path d="M19 10v2a7 7 0 0 1-14 0v-2" />
		<line x1="12" x2="12" y1="19" y2="22" />
	</svg>
)

export default function NewDemoAIAssistantWidget({
	visible,
	setActiveTab,
	setBpmCommand,
	setConfiguratorNodeCommand,
	setResultsDashboardFocus,
	setHypercubeCaseIntro,
	setShowBpm,
	setThinkingPhase,
	setThinkingGraphNodes,
	resetThinkingChain,
	requestUserConfirm,
	onBpmCommandConsumedRef,
	onThinkingPanelOpen,
	isThinkingPanelOpen = false,
	thinkingConfirmCounter = 0,
	thinkingSteps,
	isPaused,
	addThinkingStep,
	setThinkingSteps,
	setCurrentMessage,
	setIsPaused,
	setClarificationMessage,
}) {
	const [open, setOpen] = useState(false)
	const [question, setQuestion] = useState("")
	const [isListening, setIsListening] = useState(false)
	const [transcript, setTranscript] = useState("")
	const [voiceError, setVoiceError] = useState(null)
	const [clarificationText, setClarificationText] = useState(null)
	const [chatHistory, setChatHistory] = useState([])
	const lastTopicRef = useRef(null)
	const isPausedRef = useRef(false)
	useEffect(() => {
		isPausedRef.current = isPaused
	}, [isPaused])

	const [localThinkingSteps, setLocalThinkingSteps] = useState([])
	const [requestEpoch, setRequestEpoch] = useState(0)
	const [confirmedRequestEpoch, setConfirmedRequestEpoch] = useState(-1)
	const [isResultReopenable, setIsResultReopenable] = useState(false)
	const addThinkingStepLocal = useCallback(
		(label) => {
			setLocalThinkingSteps((s) => [...s, { id: `step-${Date.now()}`, label, status: "done" }])
			setCurrentMessage?.(label)
		},
		[setCurrentMessage],
	)
	const addStep = addThinkingStep ?? addThinkingStepLocal
	const displayClarification = clarificationText
	const setClarification = setClarificationMessage || setClarificationText

	useEffect(() => {
		if (!onBpmCommandConsumedRef) return
		onBpmCommandConsumedRef.current = () => addStep?.("Готово ✓")
		return () => {
			onBpmCommandConsumedRef.current = null
		}
	}, [onBpmCommandConsumedRef, addStep])

	useEffect(() => {
		if (!isListening) return
		return () => {
			stopListening()
		}
	}, [isListening])

	useEffect(() => {
		setConfirmedRequestEpoch(requestEpoch)
		setIsResultReopenable(false)
	}, [thinkingConfirmCounter, requestEpoch])

	const handleToggleClick = useCallback(() => {
		setOpen((o) => !o)
	}, [])

	const handleMicClick = useCallback(() => {
		if (!isSupported) return
		setVoiceError(null)
		if (isListening) {
			stopListening()
			setTranscript(getTranscript())
			setIsListening(false)
			return
		}
		setTranscript("")
		startListening(
			(text) => setTranscript(text),
			(err) => {
				setVoiceError(err)
				setIsListening(false)
			},
		)
		setIsListening(true)
	}, [isListening])

	const runExecutor = useCallback(
		async (scenarioId, topicOrMetric) => {
			resetThinkingChain?.()
			setThinkingSteps?.([])
			setThinkingGraphNodes?.([])
			setLocalThinkingSteps([])
			setCurrentMessage?.("")
			setIsPaused?.(false)
			setClarification(null)
			setOpen(true)
			onThinkingPanelOpen?.(true)
			const ctx = {
				setActiveTab,
				setBpmCommand,
				setConfiguratorNodeCommand,
				setResultsDashboardFocus,
				setHypercubeCaseIntro,
				setShowBpm,
				setThinkingPhase,
				setThinkingGraphNodes,
				addThinkingStep: addStep,
				isPaused: () => isPausedRef.current,
				waitForUserConfirm:
					typeof requestUserConfirm === "function" ? requestUserConfirm : undefined,
			}
			try {
				await runScenario(scenarioId, ctx, topicOrMetric)
			} catch (err) {
				addStep?.(`Ошибка: ${err?.message || "неизвестная"}`)
			}
		},
		[
			setActiveTab,
			setBpmCommand,
			setConfiguratorNodeCommand,
			setResultsDashboardFocus,
			setHypercubeCaseIntro,
			setShowBpm,
			setThinkingPhase,
			setThinkingGraphNodes,
			resetThinkingChain,
			addStep,
			setThinkingSteps,
			setCurrentMessage,
			setIsPaused,
			onThinkingPanelOpen,
			requestUserConfirm,
			setClarification,
		],
	)

	const handleSend = useCallback(() => {
		const text = (transcript || question || "").trim()
		setTranscript("")
		setQuestion("")
		if (!text) return
		setRequestEpoch((e) => e + 1)
		setIsResultReopenable(false)

		setChatHistory((h) => [...h.slice(-14), { role: "user", text }])

		if (
			/добавь ещё|ещё карточку|ещё одну|продолжи|добавь карточку/i.test(text) &&
			lastTopicRef.current
		) {
			setChatHistory((h) => [...h, { role: "assistant", text: "Добавляю карточку…" }])
			runExecutor("appendPlanningCard", lastTopicRef.current)
			return
		}

		const result = classifyIntent(text)
		const { scenarioId, confidence, topic, metric } = result
		const topicOrMetric = topic ?? metric

		if (scenarioId === "createPlanningCase" && topicOrMetric) {
			lastTopicRef.current = topicOrMetric
		}

		if (confidence >= 0.95 && scenarioId) {
			setChatHistory((h) => [...h, { role: "assistant", text: "Выполняю…" }])
			runExecutor(scenarioId, topicOrMetric)
			return
		}

		setClarification(
			"Уточните: создание кейса, добавить стадию/карточку/блок, фокус на метрику, полный проект, риски или cashflow.",
		)
		setOpen(true)
	}, [question, transcript, runExecutor, setClarification])

	const handleSuggestionPick = useCallback((value) => {
		setTranscript("")
		setQuestion(value)
	}, [])

	const hasThinkingResult = (thinkingSteps ?? localThinkingSteps).length > 0
	useEffect(() => {
		if (hasThinkingResult && requestEpoch > confirmedRequestEpoch) {
			setIsResultReopenable(true)
		}
	}, [hasThinkingResult, requestEpoch, confirmedRequestEpoch])

	if (!visible) return null

	const inputValue = transcript || question
	const isThinkingMode = isThinkingPanelOpen && hasThinkingResult
	const isUnrecognizedState = Boolean(displayClarification)

	return (
		<div className={`${styles.widget} ${open ? styles.widgetOpen : ""}`}>
			<div className={styles.panel}>
				<div className={styles.panelHeader}>
					<span className={styles.panelTitle}>ИИ-помощник</span>
					<span className={styles.online}>
						<span className={styles.dot} /> online
					</span>
					<button
						type="button"
						className={styles.panelClose}
						onClick={() => setOpen(false)}
						aria-label="Свернуть"
					>
						×
					</button>
				</div>

				{isThinkingMode ? (
					<>
						<p className={styles.greeting}>Режим мышления открыт в правой панели.</p>
						<button
							type="button"
							className={styles.openThinking}
							onClick={() => onThinkingPanelOpen?.(true)}
						>
							Открыть Мышление
						</button>
					</>
				) : (
					<>
						{chatHistory.length > 0 ? (
							<div className={styles.chatHistory}>
								{chatHistory.slice(-6).map((msg, i) => (
									<p
										key={`${msg.role}-${i}`}
										className={`${styles.msg} ${msg.role === "user" ? styles.msgUser : styles.msgAssistant}`}
									>
										<span className={styles.msgRole}>
											{msg.role === "user" ? "Вы" : "ИИ"}:
										</span>{" "}
										{msg.text}
									</p>
								))}
							</div>
						) : null}

						<p className={styles.greeting}>
							{isUnrecognizedState
								? "Запрос не распознан. Введите запрос заново или воспользуйтесь ранее подготовленными"
								: chatHistory.length
									? "Продолжайте диалог."
									: "Здравствуйте, задайте свой промпт."}
						</p>

						{isUnrecognizedState ? (
							<div className={styles.suggestionList}>
								{UNRECOGNIZED_SUGGESTIONS.map((option) => (
									<button
										key={option}
										type="button"
										className={styles.suggestionButton}
										onClick={() => handleSuggestionPick(option)}
									>
										{option}
									</button>
								))}
							</div>
						) : null}

						{displayClarification ? (
							<p className={styles.clarificationHidden}>{displayClarification}</p>
						) : null}
						{voiceError ? <p className={styles.voiceError}>{voiceError}</p> : null}

						<div className={styles.inputRow}>
							<textarea
								className={styles.input}
								placeholder={isListening ? "Слушаю…" : "Введите промпт"}
								value={inputValue}
								onChange={(e) => setQuestion(e.target.value)}
								onKeyDown={(e) =>
									e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())
								}
								rows={3}
								disabled={isListening}
							/>
							<button
								type="button"
								className={`${styles.mic} ${isListening ? styles.micActive : ""} ${!isSupported ? styles.micDisabled : ""}`}
								onClick={handleMicClick}
								title={isSupported ? (isListening ? "Остановить" : "Голосовой ввод") : "Голос недоступен"}
								aria-label={isListening ? "Остановить запись" : "Голосовой ввод"}
							>
								<MicIcon className={styles.micSvg} />
							</button>
						</div>

						<div className={styles.actionsRow}>
							<button
								type="button"
								className={styles.openThinking}
								onClick={() => onThinkingPanelOpen?.(true)}
								disabled={!isResultReopenable}
							>
								Открыть Мышление
							</button>
							<button type="button" className={styles.send} onClick={handleSend}>
								Отправить
							</button>
						</div>
					</>
				)}
			</div>

			<button
				type="button"
				className={styles.toggle}
				onClick={handleToggleClick}
				aria-label={open ? "Свернуть ИИ-помощник" : "Открыть ИИ-помощник"}
				title="ИИ-помощник"
			>
				<span className={styles.avatarWrap}>
					<span className={`${styles.dot} ${styles.dotBtn}`} title="Онлайн" />
				</span>
				<span className={styles.toggleLabel}>ИИ-помощник</span>
			</button>
		</div>
	)
}
