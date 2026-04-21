import React, { useState, useRef, useCallback, useEffect, useMemo } from "react"
import classicStyles from "./AIAssistantWidget.module.css"
import newDemoStyles from "../../face/ui/new-demo/assistant/NewDemoAIAssistantWidget.module.css"
import { isSupported, startListening, stopListening, getTranscript } from "../lib/voiceHandler"
import { classifyIntent, SCENARIO_IDS } from "../lib/intentClassifier"
import { runScenario } from "../lib/scenarioExecutors"
import { runPromptPipeline, applyWizardSetsToPipeline } from "../../promptPipeline/runPromptPipeline.js"
import { buildSemanticScenarioGraphBundle } from "../../thinking/lib/semanticScenarioGraphBundle.js"
import {
	describeTemplateSets,
	buildPipelineFromScenarioTemplate,
} from "../../promptPipeline/buildPipelineFromScenarioTemplate.js"
import { boardPresetFromScenarioTemplateId } from "../../promptPipeline/boardPresetFromScenarioTemplate.js"
import { assetModelingKnowledge } from "../../promptPipeline/knowledge.js"
import {
	EMPTY_WIZARD_SETS,
	mergeTemplateSetsWithWizard,
	normalizeWizardSets,
	WIZARD_STEP_MAX,
} from "../../promptPipeline/wizardSets.js"
import scenarioPresetsData from "../../thinking/data/prompt-pipeline/scenario_presets.json"
import NewDemoAiPromptConstructor from "../../face/ui/new-demo/assistant/NewDemoAiPromptConstructor.jsx"
import {
	mapThreeScenarioTemplatesForNewDemo,
	NEW_DEMO_THREE_SCENARIO_TEMPLATE_LABELS,
} from "../../face/ui/new-demo/assistant/newDemoThreeScenarioTemplateLabels.js"
import {
	DEMO_AI_ASSISTANT_RESET_ACTION_LABEL,
	DEMO_AI_ASSISTANT_SUGGESTIONS,
} from "../lib/demoAiAssistantSuggestions"
import { useMapPointsData } from "../../globe/model/useMapPointsData"
import { useStand } from "../../../app/stands/standContext"
import { restartDemoSessionFromPreset } from "../../../shared/lib/restartDemoSessionFromPreset"
import { useThinkingStore } from "../../thinking/model/thinkingStore.js"

/** Эталонные подсказки / пресет доски без выбранного шаблона → тот же id, что в prompt-builder / scenario_presets.json */
const BOARD_PRESET_TO_SCENARIO_TEMPLATE_ID = Object.freeze({
	base_drilling: "base_oil",
	fcf_no_drill: "fcf_no_drill_capex",
	opex_reduction: "opex_program",
})

function normRuPromptLine(s) {
	return String(s || "")
		.toLowerCase()
		.replace(/ё/g, "е")
		.replace(/\u00a0/g, " ")
		.replace(/\s+/g, " ")
		.replace(/[.!?…]+$/u, "")
		.trim()
}

/** Текст запроса совпадает с одной из трёх длинных подписей карточек (как на new-demo face), без выбора шаблона в UI. */
function scenarioTemplateFromCanonicalNewDemoPrompt(text, scenarioPresetsList) {
	const nt = normRuPromptLine(text)
	if (!nt) return null
	for (const [presetId, label] of Object.entries(NEW_DEMO_THREE_SCENARIO_TEMPLATE_LABELS)) {
		if (normRuPromptLine(label) === nt) {
			return scenarioPresetsList.find((p) => p.id === presetId) ?? null
		}
	}
	return null
}

/**
 * Неточное совпадение (латиница/опечатки/лишняя пунктуация): те же три сценария, что на карточках new-demo.
 */
function scenarioTemplateFromHeuristicNewDemoPrompt(text, scenarioPresetsList) {
	const n = normRuPromptLine(text)
	if (!n || n.length < 36) return null
	const byId = (id) => scenarioPresetsList.find((p) => p.id === id) ?? null
	if ((n.includes("npv") || n.includes("нпв")) && (n.includes("лимит") || n.includes("капитал"))) {
		return byId("npv_push")
	}
	if (
		n.includes("свободного денежного потока") ||
		(n.includes("без нового бурения") && (n.includes("capex") || n.includes("капекс")))
	) {
		return byId("fcf_no_drill_capex")
	}
	if (n.includes("устойчивому профилю") || (n.includes("базовой добыч") && n.includes("устойчив"))) {
		return byId("base_oil")
	}
	return null
}

/**
 * Шаблон конструктора для пайплайна: явный выбор пользователя; эталонная строка карточки; канонический шаблон по пресету лица.
 * @param {object | null} pipe — результат первого шага runPromptPipeline (для подстановки по suggestedPreset)
 */
function resolveNewDemoScenarioTemplateForPipeline(
	selectedTemplateId,
	scenarioPresetsList,
	presetFromIntent,
	pipe,
	userText,
) {
	let tpl =
		selectedTemplateId != null && selectedTemplateId !== ""
			? (scenarioPresetsList.find((p) => p.id === selectedTemplateId) ?? null)
			: null
	if (!tpl) {
		tpl = scenarioTemplateFromCanonicalNewDemoPrompt(userText, scenarioPresetsList)
	}
	if (!tpl) {
		tpl = scenarioTemplateFromHeuristicNewDemoPrompt(userText, scenarioPresetsList)
	}
	if (!tpl) {
		const presetKey =
			presetFromIntent ||
			(pipe && typeof pipe.suggestedPreset === "string" ? pipe.suggestedPreset : null)
		const sid =
			presetKey && BOARD_PRESET_TO_SCENARIO_TEMPLATE_ID[presetKey]
				? BOARD_PRESET_TO_SCENARIO_TEMPLATE_ID[presetKey]
				: null
		tpl = sid ? (scenarioPresetsList.find((p) => p.id === sid) ?? null) : null
	}
	return tpl
}

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
	const [selectedTemplateId, setSelectedTemplateId] = useState(null)
	const [livePipeline, setLivePipeline] = useState(null)
	const debounceRef = useRef(null)
	const [wizardStep, setWizardStep] = useState(1)
	const [wizardSets, setWizardSets] = useState(() => normalizeWizardSets(EMPTY_WIZARD_SETS))
	const lastSeededNormRef = useRef("")

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

	const scenarioPresetsList = useMemo(
		() => scenarioPresetsData?.presets ?? [],
		[scenarioPresetsData],
	)

	const scenarioTemplatesForForm = useMemo(
		() => mapThreeScenarioTemplatesForNewDemo(scenarioPresetsList),
		[scenarioPresetsList],
	)

	const dimensionCatalog = useMemo(() => {
		const d = assetModelingKnowledge.dimensions || {}
		const row = (arr) =>
			Array.isArray(arr)
				? arr.map((x) => ({ id: x.id, name: String(x.name || x.id) }))
				: []
		return {
			bases: row(d.bases),
			horizons: row(d.horizons),
			horizonPhases: row(d.horizon_phases),
			objectives: row(d.objectives),
			constraints: row(d.constraints),
			levers: row(d.levers),
		}
	}, [])

	const constructorDisplay = useMemo(() => {
		if (appearance !== "newDemo") return null
		const d = describeTemplateSets(wizardSets)
		return {
			...d,
			matchedIntents: selectedTemplateId ? [] : livePipeline?.matchedIntents ?? [],
		}
	}, [appearance, wizardSets, livePipeline, selectedTemplateId])

	useEffect(() => {
		if (appearance !== "newDemo") return
		if (!selectedTemplateId) return
		const t = scenarioPresetsList.find((p) => p.id === selectedTemplateId)
		if (t?.sets) {
			setWizardSets(normalizeWizardSets(t.sets))
			setWizardStep(1)
			lastSeededNormRef.current = ""
		}
	}, [appearance, selectedTemplateId, scenarioPresetsList])

	useEffect(() => {
		if (appearance !== "newDemo") return
		if (selectedTemplateId) return
		if (!livePipeline?.semanticWizardSets) {
			if (!livePipeline) lastSeededNormRef.current = ""
			return
		}
		const n = livePipeline.normText ?? ""
		if (n !== lastSeededNormRef.current) {
			lastSeededNormRef.current = n
			setWizardSets(normalizeWizardSets(livePipeline.semanticWizardSets))
			setWizardStep(1)
		}
	}, [appearance, selectedTemplateId, livePipeline])

	const toggleWizardDimension = useCallback((dimKey, id) => {
		setWizardSets((prev) => {
			const max = WIZARD_STEP_MAX[dimKey] ?? 4
			const cur = new Set(prev[dimKey] || [])
			if (cur.has(id)) cur.delete(id)
			else {
				if (cur.size >= max) return prev
				cur.add(id)
			}
			return { ...prev, [dimKey]: [...cur] }
		})
	}, [])

	useEffect(() => {
		if (appearance !== "newDemo" || !open || !selectedAssetId) return
		const raw = (transcript || question || "").trim()
		if (debounceRef.current) clearTimeout(debounceRef.current)
		if (!raw) {
			setLivePipeline(null)
			return
		}
		debounceRef.current = setTimeout(() => {
			debounceRef.current = null
			setLivePipeline(runPromptPipeline(raw))
		}, 520)
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current)
		}
	}, [appearance, open, selectedAssetId, question, transcript])

	const runExecutor = useCallback(
		async (scenarioId, topicOrMetric, preset, execOptions = {}) => {
			setSelectedTemplateId(null)
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
			useThinkingStore.getState().setThinkingGraphBundleOverride(null)
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
								...(execOptions.semanticGraphBundle
									? { semanticGraphBundle: execOptions.semanticGraphBundle }
									: {}),
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
		let text = (transcript || question || "").trim()
		if (
			!text &&
			appearance === "newDemo" &&
			selectedTemplateId &&
			scenarioPresetsList.length
		) {
			const t =
				scenarioTemplatesForForm.find((p) => p.id === selectedTemplateId) ||
				scenarioPresetsList.find((p) => p.id === selectedTemplateId)
			if (t?.label) text = t.label
		}
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
		let { scenarioId, confidence, topic, metric, preset } = result
		/**
		 * Текст карточек «Сформируй сквозной сценарий…» содержит триггер `сквозной сценарий` из CASE_TRIGGERS
		 * → classifyIntent даёт createPlanningCase; для NPV дополнительно срабатывает focusMetric по «npv».
		 * При явно выбранном шаблоне сценария нужен aiFaceToPlanning + семантический бандл, а не другие сценарии.
		 */
		if (
			appearance === "newDemo" &&
			selectedTemplateId &&
			scenarioPresetsList.some((p) => p.id === selectedTemplateId)
		) {
			if (
				scenarioId === SCENARIO_IDS.createPlanningCase ||
				scenarioId === SCENARIO_IDS.focusMetric
			) {
				scenarioId = SCENARIO_IDS.aiFaceToPlanning
				confidence = Math.max(confidence, 0.96)
			}
		}
		const topicOrMetric = topic ?? metric

		if (scenarioId === "createPlanningCase" && topicOrMetric) {
			lastTopicRef.current = topicOrMetric
		}

		/** Демо-кнопки и жёсткие триггеры дают aiFaceToPlanning с confidence ≥ 0.95 раньше ветки newDemo — без бандла граф остаётся «пустым» по detailText у scenario-k. */
		if (appearance === "newDemo" && scenarioId === "aiFaceToPlanning" && confidence >= 0.95) {
			const mergedSets = normalizeWizardSets(wizardSets)
			let pipe = runPromptPipeline(text)
			const tplPipe = resolveNewDemoScenarioTemplateForPipeline(
				selectedTemplateId,
				scenarioPresetsList,
				preset,
				pipe,
				text,
			)
			if (tplPipe) {
				pipe = buildPipelineFromScenarioTemplate(
					{ ...tplPipe, sets: mergeTemplateSetsWithWizard(tplPipe.sets, mergedSets) },
					text,
				)
			} else {
				pipe = applyWizardSetsToPipeline(pipe, mergedSets)
			}
			const presetBoard = tplPipe
				? boardPresetFromScenarioTemplateId(tplPipe.id)
				: preset || pipe.suggestedPreset || "base_drilling"
			const bundle = buildSemanticScenarioGraphBundle(presetBoard, pipe)
			lastTopicRef.current = text
			setChatHistory((h) => [...h, { role: "assistant", text: "Выполняю…" }])
			void runExecutor(
				"aiFaceToPlanning",
				text.length > 220 ? text.slice(0, 220) : text,
				presetBoard,
				{ semanticGraphBundle: bundle },
			)
			return
		}

		if (confidence >= 0.95 && scenarioId) {
			setChatHistory((h) => [...h, { role: "assistant", text: "Выполняю…" }])
			runExecutor(scenarioId, topicOrMetric, preset)
			return
		}

		if (appearance === "newDemo") {
			const mergedSets = normalizeWizardSets(wizardSets)
			const hasWizardObjectives = mergedSets.objectives.length > 0
			let pipe = runPromptPipeline(text)
			const tplPipe = resolveNewDemoScenarioTemplateForPipeline(
				selectedTemplateId,
				scenarioPresetsList,
				preset,
				pipe,
				text,
			)
			if (tplPipe) {
				pipe = buildPipelineFromScenarioTemplate(
					{ ...tplPipe, sets: mergeTemplateSetsWithWizard(tplPipe.sets, mergedSets) },
					text,
				)
			} else {
				pipe = applyWizardSetsToPipeline(pipe, mergedSets)
			}
			const presetBoard = tplPipe
				? boardPresetFromScenarioTemplateId(tplPipe.id)
				: pipe.suggestedPreset || "base_drilling"
			if (tplPipe || hasWizardObjectives || (pipe.domainOk && pipe.goals?.length)) {
				lastTopicRef.current = text
				const bundle = buildSemanticScenarioGraphBundle(presetBoard, pipe)
				setChatHistory((h) => [
					...h,
					{ role: "assistant", text: "Разбираю запрос и строю цепочку мышления…" },
				])
				void runExecutor(
					"aiFaceToPlanning",
					text.length > 220 ? text.slice(0, 220) : text,
					presetBoard,
					{ semanticGraphBundle: bundle },
				)
				setWizardSets(normalizeWizardSets(EMPTY_WIZARD_SETS))
				setWizardStep(1)
				lastSeededNormRef.current = ""
				return
			}
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
	}, [
		question,
		transcript,
		runExecutor,
		selectedAssetId,
		setClarification,
		appearance,
		selectedTemplateId,
		scenarioPresetsList,
		scenarioTemplatesForForm,
		wizardSets,
	])

	const handleSuggestionPick = useCallback((value) => {
		setTranscript("")
		setQuestion(value)
		setSelectedTemplateId(null)
		setWizardSets(normalizeWizardSets(EMPTY_WIZARD_SETS))
		setWizardStep(1)
		lastSeededNormRef.current = ""
	}, [])

	const handleResetScenario = useCallback(() => {
		setSelectedTemplateId(null)
		setLivePipeline(null)
		setWizardSets(normalizeWizardSets(EMPTY_WIZARD_SETS))
		setWizardStep(1)
		lastSeededNormRef.current = ""
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
										? "Здравствуйте: выберите шаблон сценария или опишите задачу в окне запроса."
										: "Здравствуйте, задайте свой промпт."}
						</p>

						{appearance === "newDemo" ? (
							<>
								<NewDemoAiPromptConstructor
									presets={scenarioTemplatesForForm}
									selectedTemplateId={selectedTemplateId}
									onSelectTemplate={(t) => {
										setSelectedTemplateId(t.id)
										setQuestion(t.label)
										setTranscript("")
									}}
									constructorDisplay={constructorDisplay}
									wizardStep={wizardStep}
									onWizardStep={setWizardStep}
									dimensionCatalog={dimensionCatalog}
									wizardSets={wizardSets}
									onToggleDimension={toggleWizardDimension}
									maxPerDimension={WIZARD_STEP_MAX}
								/>
								<button
									type="button"
									className={`${styles.suggestionButton} ${styles.suggestionButtonReset}`}
									onClick={handleResetScenario}
								>
									{DEMO_AI_ASSISTANT_RESET_ACTION_LABEL}
								</button>
							</>
						) : (
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
						)}

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

						{appearance === "newDemo" ? (
							<>
								<div className={styles.promptWindowLabel}>Окно запроса</div>
								<p className={styles.constructorHint}>
									Первая строка задаёт смысл запроса. Ниже можно уточнить детали и согласовать с
									выбранным шаблоном.
								</p>
							</>
						) : null}

						<div className={styles.inputRow}>
							<textarea
								className={`${styles.input} ${appearance === "newDemo" ? styles.inputCompact : ""}`}
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
