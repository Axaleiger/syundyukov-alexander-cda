import React, { useState, useRef, useCallback, useEffect } from "react"
import classicStyles from "./AIAssistantWidget.module.css"
import newDemoStyles from "../../face/ui/new-demo/assistant/NewDemoAIAssistantWidget.module.css"
import { isSupported, startListening, stopListening, getTranscript } from "../lib/voiceHandler"
import { classifyIntent } from "../lib/intentClassifier"
import { runScenario } from "../lib/scenarioExecutors"
import {
	DEMO_AI_ASSISTANT_RESET_ACTION_LABEL,
	DEMO_AI_ASSISTANT_SUGGESTIONS,
} from "../lib/demoAiAssistantSuggestions"
import { useMapPointsData } from "../../globe/model/useMapPointsData"
import { useStand } from "../../../app/stands/standContext"
import { restartDemoSessionFromPreset } from "../../../shared/lib/restartDemoSessionFromPreset"

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

/**
 * ИИ-помощник: общая логика new-demo и main.
 * @param {'classic' | 'newDemo'} [appearance='classic'] — classic: плавающий перетаскиваемый виджет; newDemo: оформление new-demo стенда.
 */
function AIAssistantWidget({
	appearance = "classic",
	visible,
	onClose,
	selectedAssetId = null,
	setSelectedAssetId,
	assistantCloseSignal = 0,
	navigateToPlanningAfterAi,
	thinkingConfirmCounter = 0,
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
	thinkingSteps,
	currentMessage,
	isPaused,
	addThinkingStep,
	setThinkingSteps,
	setCurrentMessage,
	setIsPaused,
	setClarificationMessage,
}) {
	const styles = appearance === "newDemo" ? newDemoStyles : classicStyles
	const enableDrag = appearance === "classic"
	const { routePrefix } = useStand()
	const mapPointsData = useMapPointsData()

	const [open, setOpen] = useState(false)
	const [question, setQuestion] = useState("")
	const [position, setPosition] = useState(null)
	const [dragging, setDragging] = useState(false)
	const [isListening, setIsListening] = useState(false)
	const [transcript, setTranscript] = useState("")
	const [voiceError, setVoiceError] = useState(null)
	const [clarificationText, setClarificationText] = useState(null)
	const [chatHistory, setChatHistory] = useState([])
	const dragStart = useRef({ x: 0, y: 0, left: 0, top: 0 })
	const didDrag = useRef(false)
	const widgetRef = useRef(null)
	const isPausedRef = useRef(false)
	const lastTopicRef = useRef(null)
	const base = `${(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}/`
	isPausedRef.current = isPaused

	const [localThinkingSteps, setLocalThinkingSteps] = useState([])
	const [requestEpoch, setRequestEpoch] = useState(0)
	const [confirmedRequestEpoch, setConfirmedRequestEpoch] = useState(-1)
	const [isResultReopenable, setIsResultReopenable] = useState(false)

	const addThinkingStepLocal = useCallback(
		(label) => {
			setLocalThinkingSteps((s) => [
				...s,
				{ id: `step-${Date.now()}`, label, status: "done" },
			])
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
		setConfirmedRequestEpoch(requestEpoch)
		setIsResultReopenable(false)
	}, [thinkingConfirmCounter, requestEpoch])

	useEffect(() => {
		if (assistantCloseSignal > 0) setOpen(false)
	}, [assistantCloseSignal])

	const handlePointerDown = useCallback(
		(e) => {
			if (!enableDrag) return
			const t = e.target
			if (!(t instanceof Element)) return
			if (!t.closest(`.${styles.toggle}`) && !t.closest(`.${styles.panel}`))
				return
			if (
				t.closest(`.${styles.panelClose}`) ||
				t.closest(`.${styles.input}`) ||
				t.closest(`.${styles.send}`) ||
				t.closest(`.${styles.mic}`) ||
				t.closest(`.${styles.openThinking}`) ||
				t.closest(`.${styles.suggestionButton}`)
			)
				return
			didDrag.current = false
			const el = widgetRef.current
			const left =
				position != null ? position.x : el ? el.getBoundingClientRect().left : 0
			const top =
				position != null ? position.y : el ? el.getBoundingClientRect().top : 0
			dragStart.current = { x: e.clientX - left, y: e.clientY - top, left, top }
			setDragging(true)
		},
		[position, styles, enableDrag],
	)

	useEffect(() => {
		if (!dragging) return
		const onMove = (e) => {
			didDrag.current = true
			const nx = e.clientX - dragStart.current.x
			const ny = e.clientY - dragStart.current.y
			setPosition({ x: Math.max(0, nx), y: Math.max(0, ny) })
		}
		const onUp = () => setDragging(false)
		document.addEventListener("pointermove", onMove)
		document.addEventListener("pointerup", onUp)
		return () => {
			document.removeEventListener("pointermove", onMove)
			document.removeEventListener("pointerup", onUp)
		}
	}, [dragging])

	const handleToggleClick = useCallback(() => {
		if (didDrag.current) return
		setOpen((o) => !o)
	}, [])

	useEffect(() => {
		if (!enableDrag || !open || position == null) return
		const el = widgetRef.current
		if (!el) return
		const panel = el.querySelector(`.${styles.panel}`)
		if (!panel) return
		requestAnimationFrame(() => {
			const panelHeight = panel.offsetHeight || 320
			const toggleHeight = 60
			const bottom = position.y + toggleHeight + panelHeight
			if (bottom > window.innerHeight - 24) {
				const newY = Math.max(
					0,
					window.innerHeight - 24 - panelHeight - toggleHeight,
				)
				setPosition((p) => (p && p.y !== newY ? { ...p, y: newY } : p))
			}
		})
	}, [open, position, enableDrag, styles.panel])

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

	useEffect(() => {
		if (!isListening) return
		return () => {
			stopListening()
		}
	}, [isListening])

	const runExecutor = useCallback(
		async (scenarioId, topicOrMetric, preset) => {
			if (!selectedAssetId) {
				setOpen(true)
				setChatHistory((h) => [
					...h.slice(-14),
					{
						role: "assistant",
						text: "Выберите актив в списке или на карте — без актива сценарии не формируются.",
					},
				])
				return
			}
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
				navigateToPlanningAfterAi,
			}
			try {
				const payload =
					scenarioId === "aiFaceToPlanning" && preset
						? {
								preset,
								topic:
									typeof topicOrMetric === "string" ? topicOrMetric : undefined,
							}
						: topicOrMetric
				await runScenario(scenarioId, ctx, payload)
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
			navigateToPlanningAfterAi,
			selectedAssetId,
		],
	)

	const handleSend = useCallback(() => {
		const text = (transcript || question || "").trim()
		setTranscript("")
		setQuestion("")
		if (!text) return
		if (!selectedAssetId) {
			setChatHistory((h) => [
				...h.slice(-14),
				{ role: "user", text },
				{
					role: "assistant",
					text: "Сначала выберите актив в списке выше или на главной странице — без актива запрос не выполняется.",
				},
			])
			setOpen(true)
			return
		}
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
		const { scenarioId, confidence, topic, metric, preset } = result
		const topicOrMetric = topic ?? metric

		if (scenarioId === "createPlanningCase" && topicOrMetric) {
			lastTopicRef.current = topicOrMetric
		}

		if (confidence >= 0.95 && scenarioId) {
			setChatHistory((h) => [...h, { role: "assistant", text: "Выполняю…" }])
			runExecutor(scenarioId, topicOrMetric, preset)
			return
		}

		if (appearance === "classic" && confidence < 0.7) {
			setClarification(
				"Уточните: создание кейса, добавить стадию/карточку/блок, фокус на метрику, полный проект, риски или cashflow.",
			)
			setOpen(true)
			return
		}

		setClarification(
			"Уточните: создание кейса, добавить стадию/карточку/блок, фокус на метрику, полный проект, риски или cashflow.",
		)
		setOpen(true)
	}, [question, transcript, runExecutor, selectedAssetId, setClarification, appearance])

	const handleSuggestionPick = useCallback((value) => {
		setTranscript("")
		setQuestion(value)
	}, [])

	const handleResetScenario = useCallback(() => {
		void restartDemoSessionFromPreset(routePrefix).catch((e) => {
			console.warn("[ai-assistant] restartDemoSessionFromPreset", e)
		})
	}, [routePrefix])

	const hasThinkingResult = (thinkingSteps ?? localThinkingSteps).length > 0
	useEffect(() => {
		if (hasThinkingResult && requestEpoch > confirmedRequestEpoch) {
			setIsResultReopenable(true)
		}
	}, [hasThinkingResult, requestEpoch, confirmedRequestEpoch])

	if (!visible) return null

	const style =
		enableDrag && position != null
			? { left: position.x, top: position.y, right: "auto", bottom: "auto" }
			: {}
	const inputValue = transcript || question
	const isThinkingMode = isThinkingPanelOpen && hasThinkingResult
	const isUnrecognizedState = Boolean(displayClarification)
	const needsAssetSelection = !selectedAssetId && !isThinkingMode

	return (
		<div
			ref={widgetRef}
			className={`${styles.widget} ${open ? styles.widgetOpen : ""}`}
			style={style}
		>
			<div
				className={styles.panel}
				onPointerDown={enableDrag ? handlePointerDown : undefined}
			>
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
						<p className={styles.greeting}>
							Режим мышления открыт в правой панели.
						</p>
						<button
							type="button"
							className={styles.openThinking}
							onClick={() => onThinkingPanelOpen?.(true)}
						>
							{appearance === "newDemo" ? "Открыть Мышление" : "Открыть мышление"}
						</button>
					</>
				) : needsAssetSelection ? (
					<>
						<p className={styles.greeting}>
							Выберите актив — без привязки к активу ИИ не может сформировать сценарий. Тот же выбор
							доступен на главной странице на карте.
						</p>
						<div className={styles.assetPickScroll} role="listbox" aria-label="Список активов">
							<div className={styles.suggestionList}>
								{mapPointsData.map((p) => (
									<button
										key={p.id}
										type="button"
										className={styles.suggestionButton}
										role="option"
										onClick={() => setSelectedAssetId?.(p.id)}
									>
										<span className={styles.assetPickName}>{p.name}</span>
										{p.city ? (
											<span className={styles.assetPickCity}>{p.city}</span>
										) : null}
									</button>
								))}
							</div>
						</div>
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
									: appearance === "newDemo"
										? "Здравствуйте, задайте свой промпт или воспользуйтесь ранее подготовленными"
										: "Здравствуйте, задайте свой промпт."}
						</p>

						<div className={styles.suggestionList} aria-label="Готовые промпты">
							{DEMO_AI_ASSISTANT_SUGGESTIONS.map((option) => (
								<button
									key={option}
									type="button"
									className={styles.suggestionButton}
									onClick={() => handleSuggestionPick(option)}
								>
									{option}
								</button>
							))}
							<button
								type="button"
								className={`${styles.suggestionButton} ${styles.suggestionButtonReset}`}
								onClick={handleResetScenario}
							>
								{DEMO_AI_ASSISTANT_RESET_ACTION_LABEL}
							</button>
						</div>

						{displayClarification ? (
							<p
								className={
									appearance === "newDemo"
										? styles.clarificationHidden
										: styles.clarification
								}
							>
								{displayClarification}
							</p>
						) : null}
						{voiceError ? <p className={styles.voiceError}>{voiceError}</p> : null}

						<div className={styles.inputRow}>
							<textarea
								className={styles.input}
								placeholder={isListening ? "Слушаю…" : "Введите промпт"}
								value={inputValue}
								onChange={(e) => setQuestion(e.target.value)}
								onKeyDown={(e) =>
									e.key === "Enter" &&
									!e.shiftKey &&
									(e.preventDefault(), handleSend())
								}
								rows={3}
								disabled={isListening}
							/>
							<button
								type="button"
								className={`${styles.mic} ${isListening ? styles.micActive : ""} ${!isSupported ? styles.micDisabled : ""}`}
								onClick={handleMicClick}
								title={
									isSupported
										? isListening
											? "Остановить"
											: "Голосовой ввод"
										: "Голос недоступен"
								}
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
								{appearance === "newDemo" ? "Открыть Мышление" : "Открыть мышление"}
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
				onPointerDown={enableDrag ? handlePointerDown : undefined}
				onClick={handleToggleClick}
				aria-label={open ? "Свернуть ИИ-помощник" : "Открыть ИИ-помощник"}
				title={
					enableDrag
						? "ИИ-помощник (перетащите для перемещения)"
						: "ИИ-помощник"
				}
			>
				<span className={styles.avatarWrap}>
					{appearance === "classic" ? (
						<>
							<img
								src={`${base}ai-assistent.gif`}
								alt=""
								className={styles.avatar}
								onError={(e) => {
									e.target.style.display = "none"
									e.target.nextSibling?.classList.add(styles.avatarFallbackVisible)
								}}
							/>
							<span className={styles.avatarFallback}>🤖</span>
						</>
					) : null}
					<span className={`${styles.dot} ${styles.dotBtn}`} title="Онлайн" />
				</span>
				<span className={styles.toggleLabel}>ИИ-помощник</span>
			</button>
		</div>
	)
}

export default AIAssistantWidget
