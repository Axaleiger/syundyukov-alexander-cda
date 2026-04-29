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
import { useThinkingStore } from "../../thinking/model/thinkingStore.js"

/** Эталонные подсказки / пресет доски без выбранного шаблона → тот же id, что в prompt-builder / scenario_presets.json */
const BOARD_PRESET_TO_SCENARIO_TEMPLATE_ID = Object.freeze({
	base_drilling: "base_oil",
	fcf_no_drill: "fcf_no_drill_capex",
	opex_reduction: "opex_program",
})

const HORIZON_LABEL_BY_ID = Object.freeze({
	T06: "Оперативный такт 8 недель",
	T05: "Квартальный тактический горизонт",
	T01: "1 год",
	T08: "2 года",
	H03: "3 года",
	H05: "5 лет",
	H10: "10 лет",
})

const OBJECTIVES_WITHOUT_MODE = new Set([
	"G06",
	"G07",
	"G17",
	"G18",
	"G19",
	"G20",
	"G21",
	"G22",
])
const OBJECTIVES_WITH_MINIMIZE_MODE = new Set(["G13", "G05"])
const OBJECTIVES_YEAR_THRESHOLD = new Set(["G16"])
const CONSTRAINT_DEFAULT_VALUES = Object.freeze({
	C02: 100000000,
	C03: 50000000,
	C04: 95,
	C05: 12,
})

const DEFAULT_NEW_DEMO_WIZARD_SETS = Object.freeze({
	...EMPTY_WIZARD_SETS,
	bases: ["B01"],
	horizons: ["T01"],
	objectives: ["G01"],
	levers: ["L01", "L02", "L04"],
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
	const [wizardSets, setWizardSets] = useState(() =>
		normalizeWizardSets(DEFAULT_NEW_DEMO_WIZARD_SETS),
	)
	const [wizardTargets, setWizardTargets] = useState({ objectives: {}, constraints: {} })
	const [constructorExpanded, setConstructorExpanded] = useState(false)
	const [wizardDirty, setWizardDirty] = useState(false)
	const [hasTemplateSelection, setHasTemplateSelection] = useState(false)
	const [hasConstructorInput, setHasConstructorInput] = useState(false)
	const [hasConstructorFinalConfirm, setHasConstructorFinalConfirm] = useState(false)
	const [hasVoiceInput, setHasVoiceInput] = useState(false)
	const lastSeededNormRef = useRef("")
	const promptInputRef = useRef(null)

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

	useEffect(() => {
		if (appearance !== "newDemo" || !open) return
		// #region agent log
		fetch("http://127.0.0.1:7689/ingest/835d33eb-bbbf-4335-a415-5b77553fca5e", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "945340" }, body: JSON.stringify({ sessionId: "945340", runId: "pre-fix", hypothesisId: "H1", location: "AIAssistantWidget.jsx:open-reset-effect:start", message: "newDemo open reset effect entered", data: { open, selectedTemplateId, wizardBases: wizardSets?.bases || [], wizardStep }, timestamp: Date.now() }) }).catch(() => {})
		// #endregion
		setSelectedTemplateId(null)
		setWizardDirty(false)
		setConstructorExpanded(false)
		setWizardStep(1)
		setWizardSets(normalizeWizardSets(DEFAULT_NEW_DEMO_WIZARD_SETS))
		setWizardTargets({ objectives: { G01: { mode: "maximize", value: 10 } }, constraints: {} })
		setHasTemplateSelection(false)
		setHasConstructorInput(false)
		setHasConstructorFinalConfirm(false)
		setHasVoiceInput(false)
		lastSeededNormRef.current = ""
		// #region agent log
		fetch("http://127.0.0.1:7689/ingest/835d33eb-bbbf-4335-a415-5b77553fca5e", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "945340" }, body: JSON.stringify({ sessionId: "945340", runId: "pre-fix", hypothesisId: "H1", location: "AIAssistantWidget.jsx:open-reset-effect:end", message: "newDemo open reset effect applied defaults", data: { appliedBases: DEFAULT_NEW_DEMO_WIZARD_SETS.bases, appliedHorizons: DEFAULT_NEW_DEMO_WIZARD_SETS.horizons, appliedObjectives: DEFAULT_NEW_DEMO_WIZARD_SETS.objectives }, timestamp: Date.now() }) }).catch(() => {})
		// #endregion
	}, [appearance, open])

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
			const finalTranscript = getTranscript()
			setTranscript(finalTranscript)
			if (String(finalTranscript || "").trim()) setHasVoiceInput(true)
			setIsListening(false)
			return
		}
		setTranscript("")
		startListening(
			(text) => {
				setTranscript(text)
				if (String(text || "").trim()) setHasVoiceInput(true)
			},
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
	const selectedAssetName = useMemo(() => {
		if (!selectedAssetId) return ""
		return String(mapPointsData.find((p) => p.id === selectedAssetId)?.name || "").trim()
	}, [mapPointsData, selectedAssetId])

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
			const seeded = normalizeWizardSets(t.sets)
			if (Array.isArray(seeded.objectives) && seeded.objectives.length > 1) {
				seeded.objectives = [seeded.objectives[0]]
			}
			setWizardSets(seeded)
			setWizardTargets({ objectives: {}, constraints: {} })
			setWizardStep(1)
			setConstructorExpanded(false)
			setWizardDirty(false)
			lastSeededNormRef.current = ""
		}
	}, [appearance, selectedTemplateId, scenarioPresetsList])

	useEffect(() => {
		if (appearance !== "newDemo") return
		if (selectedTemplateId) return
		if (wizardDirty) return
		const raw = String(transcript || question || "").trim()
		if (!raw) return
		if (!livePipeline?.semanticWizardSets) {
			if (!livePipeline) lastSeededNormRef.current = ""
			return
		}
		const n = livePipeline.normText ?? ""
		if (n !== lastSeededNormRef.current) {
			// #region agent log
			fetch("http://127.0.0.1:7689/ingest/835d33eb-bbbf-4335-a415-5b77553fca5e", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "945340" }, body: JSON.stringify({ sessionId: "945340", runId: "pre-fix", hypothesisId: "H2", location: "AIAssistantWidget.jsx:livePipeline-seed:before-apply", message: "livePipeline semantic seed about to apply", data: { rawLength: raw.length, prevBases: wizardSets?.bases || [], semanticBases: livePipeline?.semanticWizardSets?.bases || [] }, timestamp: Date.now() }) }).catch(() => {})
			// #endregion
			lastSeededNormRef.current = n
			const seeded = normalizeWizardSets(livePipeline.semanticWizardSets)
			if (Array.isArray(seeded.objectives) && seeded.objectives.length > 1) {
				seeded.objectives = [seeded.objectives[0]]
			}
			setWizardSets(seeded)
			setWizardTargets({ objectives: {}, constraints: {} })
			setWizardStep(1)
		}
	}, [appearance, selectedTemplateId, livePipeline, wizardDirty, transcript, question])

	const withAssetPrefix = useCallback(
		(text) => {
			const body = String(text || "").trim()
			if (!selectedAssetName) return body
			if (!body) return `Сформируй сценарий для «${selectedAssetName}».`
			if (/для\s+до\s+«[^»]+»/i.test(body) || /для\s+«[^»]+»/i.test(body)) return body
			return `Сформируй сценарий для «${selectedAssetName}». ${body}`
		},
		[selectedAssetName],
	)

	const formatDoAssetName = useCallback(() => {
		const clean = String(selectedAssetName || "").trim().toUpperCase()
		if (!clean) return "АКТИВА"
		return /^ДО\s+/i.test(clean) ? clean : `ДО «${clean}»`
	}, [selectedAssetName])

	const buildFormalizatorTemplatePrompt = useCallback((templateId) => {
		const asset = formatDoAssetName()
		if (templateId === "fcf_no_drill_capex") {
			return `Сформируй сценарий для ${asset} с горизонтом планирования в 3–5 лет, который должен достигать следующих целей:
• максимизация свободного денежного потока (fcf) (Максимизация показателя →+∞), с учётом следующих ограничений:
• без нового бурения скважин, за счёт применения рычагов:
• гТМ / капремонт / срочный ремонт;
• режимы скважин, дросселирование, перераспределение отборов;
• дОФ, УЭЦН, газлифт, компрессия;
• закачка, ППД, МУН, давление пласта;
• приоритизация и фазирование портфеля CAPEX;
• переторжка услуг: повторный тендер и снижение цен с подрядчиками (ребид).`
		}
		if (templateId === "base_oil") {
			return `Сформируй сценарий для ${asset} с горизонтом планирования в 3–5 лет, который должен достигать следующих целей:
• максимизация добычи нефти (Максимизация показателя →+∞), за счёт применения рычагов:
• гТМ / капремонт / срочный ремонт;
• режимы скважин, дросселирование, перераспределение отборов;
• дОФ, УЭЦН, газлифт, компрессия;
• закачка, ППД, МУН, давление пласта;
• цифровизация: ППР, предиктив, диспетчеризация;
• переторжка услуг: повторный тендер и снижение цен с подрядчиками (ребид).`
		}
		if (templateId === "npv_push") {
			return `Сформируй сценарий для ${asset} с горизонтом планирования до конца лоф / пир, который должен достигать следующих целей:
• максимизация чистой приведённой стоимости (npv) (Максимизация показателя →+∞), с учётом следующих ограничений:
• лимит capex (кап) (потолок 100 000 000 ₽);
• лимит opex (потолок 50 000 000 ₽), за счёт применения рычагов:
• приоритизация и фазирование портфеля CAPEX;
• гТМ / капремонт / срочный ремонт;
• режимы скважин, дросселирование, перераспределение отборов;
• закачка, ППД, МУН, давление пласта;
• налоговое планирование (в рамках закона);
• переторжка услуг: повторный тендер и снижение цен с подрядчиками (ребид).`
		}
		return `Сформируй сценарий для ${asset}.`
	}, [formatDoAssetName])

	const buildQuestionFromWizard = useCallback((sets, targets, revealStep = wizardStep) => {
		const d = describeTemplateSets(sets)
		const formatAssetLead = () => `Сформируй сценарий для ${formatDoAssetName()}`
		const horizonLabel = (ids) => {
			const arr = (Array.isArray(ids) ? ids : []).filter((id) => id !== "T03")
			if (!arr.length) return null
			const labels = arr.map((id) => HORIZON_LABEL_BY_ID[id] || id)
			return labels[0] || null
		}
		const objectiveLines = (arr) => {
			if (!Array.isArray(arr) || !arr.length) return []
			return arr.map((item) => {
				const cfg = targets?.objectives?.[item.id] || {}
				const fallbackMode = OBJECTIVES_WITH_MINIMIZE_MODE.has(item.id)
					? "minimize"
					: "maximize"
				const mode = cfg.mode === "threshold" ? "threshold" : cfg.mode || fallbackMode
				const value = Number.isFinite(Number(cfg.value)) ? Number(cfg.value) : 10
				if (OBJECTIVES_WITHOUT_MODE.has(item.id)) {
					return `• ${String(item.name || "").toLowerCase()}`
				}
				if (mode === "threshold") {
					if (OBJECTIVES_YEAR_THRESHOLD.has(item.id)) {
						return `• ${String(item.name || "").toLowerCase()} (порог >= ${Math.round(value)} лет)`
					}
					return `• ${String(item.name || "").toLowerCase()} (порог >= ${value}%)`
				}
				return mode === "minimize"
					? `• ${String(item.name || "").toLowerCase()} (минимизация показателя)`
					: `• ${String(item.name || "").toLowerCase()} (максимизация показателя)`
			})
		}
		const constraintLines = (arr, key, withLeverSection) => {
			if (!Array.isArray(arr) || !arr.length) return []
			return arr.map((item, idx) => {
				const rawValue = targets?.[key]?.[item.id]
				const value = Number.isFinite(Number(rawValue))
					? Number(rawValue)
					: CONSTRAINT_DEFAULT_VALUES[item.id]
				const suffix = idx === arr.length - 1 && withLeverSection ? "," : ";"
				if (item.id === "C02") {
					return `• потолок capex за горизонт модели: ${Math.round(value)} ₽${suffix}`
				}
				if (item.id === "C03") {
					return `• потолок opex (например за год): ${Math.round(value)} ₽${suffix}`
				}
				if (item.id === "C04") {
					return `• нижняя граница добычи нефти: не ниже ${value}% к базовому профилю${suffix}`
				}
				if (item.id === "C05") {
					return `• максимальный срок внедрения мероприятий: ${Math.round(value)} мес.${suffix}`
				}
				return `• ${String(item.name || "").toLowerCase()}${suffix}`
			})
		}
		const leverLines = (arr) => {
			if (!Array.isArray(arr) || !arr.length) return []
			return arr.map((item) => `• ${String(item.name || "").toLowerCase()}.`)
		}

		const horizon = horizonLabel(sets?.horizons)
		const objectives = objectiveLines(d.objectives)
		const levers = leverLines(d.levers)
		const constraints = constraintLines(d.constraints, "constraints", levers.length > 0 && revealStep >= 5)

		let text = formatAssetLead()
		if (revealStep < 2 || !horizon) return `${text}…`
		text += ` с горизонтом планирования в ${horizon}`
		if (revealStep >= 3 && objectives.length) {
			text += ", который должен достигать следующих целей:\n"
			text += objectives.join("\n")
		}
		if (revealStep >= 4 && constraints.length) {
			text += ", с учётом следующих ограничений:\n"
			text += constraints.join("\n")
		}
		if (revealStep >= 5 && levers.length) {
			text += ", за счёт применения рычагов:\n"
			text += `• ${levers.map((x) => x.replace(/^•\s*/, "").replace(/\.$/, "")).join(" / ")}.`
		}
		return text.trim()
	}, [formatDoAssetName, wizardStep])

	const handleToggleDimensionAndSync = useCallback(
		(dimKey, id) => {
			setWizardDirty(true)
			setHasConstructorInput(true)
			setHasConstructorFinalConfirm(false)
			let nextSets = null
			setWizardSets((prev) => {
				const current = Array.isArray(prev[dimKey]) ? prev[dimKey] : []
				if (dimKey === "objectives" || dimKey === "constraints" || dimKey === "levers") {
					const cur = new Set(current)
					if (cur.has(id)) cur.delete(id)
					else cur.add(id)
					nextSets = { ...prev, [dimKey]: [...cur] }
				} else {
					nextSets = { ...prev, [dimKey]: current[0] === id ? [] : [id] }
				}
				return nextSets
			})
			if (nextSets) {
				setQuestion(buildQuestionFromWizard(nextSets, wizardTargets))
				setTranscript("")
			}
		},
		[buildQuestionFromWizard, wizardTargets],
	)

	const handleSetObjectiveMode = useCallback(
		(id, mode) => {
			setWizardDirty(true)
			setHasConstructorInput(true)
			setHasConstructorFinalConfirm(false)
			setWizardTargets((prev) => {
				const current = prev?.objectives?.[id] || {
					mode: OBJECTIVES_WITH_MINIMIZE_MODE.has(id) ? "minimize" : "maximize",
					value: OBJECTIVES_YEAR_THRESHOLD.has(id) ? 3 : 10,
				}
				const next = {
					...prev,
					objectives: {
						...(prev.objectives || {}),
						[id]: {
							...current,
							mode:
								mode === "threshold"
									? "threshold"
									: mode === "minimize"
										? "minimize"
										: "maximize",
						},
					},
				}
				setQuestion(buildQuestionFromWizard(wizardSets, next))
				setTranscript("")
				return next
			})
		},
		[buildQuestionFromWizard, wizardSets],
	)

	const handleObjectiveDelta = useCallback(
		(id, delta) => {
			setWizardDirty(true)
			setHasConstructorInput(true)
			setHasConstructorFinalConfirm(false)
			setWizardTargets((prev) => {
				const current = prev?.objectives?.[id] || {
					mode: "threshold",
					value: OBJECTIVES_YEAR_THRESHOLD.has(id) ? 3 : 10,
				}
				const base = Number.isFinite(Number(current.value)) ? Number(current.value) : 10
				const value = Math.max(0, base + delta)
				const next = {
					...prev,
					objectives: {
						...(prev.objectives || {}),
						[id]: { ...current, mode: "threshold", value },
					},
				}
				setQuestion(buildQuestionFromWizard(wizardSets, next))
				setTranscript("")
				return next
			})
		},
		[buildQuestionFromWizard, wizardSets],
	)

	const handleSetTargetValue = useCallback(
		(groupKey, id, value) => {
			setWizardDirty(true)
			setHasConstructorInput(true)
			setHasConstructorFinalConfirm(false)
			setWizardTargets((prev) => {
				const next = {
					...prev,
					[groupKey]: { ...(prev[groupKey] || {}), [id]: value },
				}
				setQuestion(buildQuestionFromWizard(wizardSets, next))
				setTranscript("")
				return next
			})
		},
		[buildQuestionFromWizard, wizardSets],
	)

	const handleSetConstraintMode = useCallback(
		(id, mode) => {
			setWizardDirty(true)
			setHasConstructorInput(true)
			setHasConstructorFinalConfirm(false)
			setWizardTargets((prev) => {
				const current = prev?.constraints?.[id] || { mode: "threshold", value: 10 }
				const next = {
					...prev,
					constraints: {
						...(prev.constraints || {}),
						[id]: { ...current, mode: mode === "maximize" ? "maximize" : "threshold" },
					},
				}
				setQuestion(buildQuestionFromWizard(wizardSets, next))
				setTranscript("")
				return next
			})
		},
		[buildQuestionFromWizard, wizardSets],
	)

	const handleConstraintDelta = useCallback(
		(id, delta) => {
			setWizardDirty(true)
			setHasConstructorInput(true)
			setHasConstructorFinalConfirm(false)
			setWizardTargets((prev) => {
				const current = prev?.constraints?.[id]
				const base = Number.isFinite(Number(current))
					? Number(current)
					: Number.isFinite(Number(current?.value))
						? Number(current.value)
						: CONSTRAINT_DEFAULT_VALUES[id] ?? 10
				const value = Math.max(0, base + delta)
				const next = {
					...prev,
					constraints: {
						...(prev.constraints || {}),
						[id]: value,
					},
				}
				setQuestion(buildQuestionFromWizard(wizardSets, next))
				setTranscript("")
				return next
			})
		},
		[buildQuestionFromWizard, wizardSets],
	)

	useEffect(() => {
		if (appearance !== "newDemo") return
		if ((wizardSets?.bases || []).length > 0) return
		const preferredBase = (dimensionCatalog?.bases || []).find((x) => x.id === "B01")?.id
		const firstBase = preferredBase || dimensionCatalog?.bases?.[0]?.id
		if (!firstBase) return
		// #region agent log
		fetch("http://127.0.0.1:7689/ingest/835d33eb-bbbf-4335-a415-5b77553fca5e", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "945340" }, body: JSON.stringify({ sessionId: "945340", runId: "pre-fix", hypothesisId: "H3", location: "AIAssistantWidget.jsx:base-default-effect", message: "base default effect sets base", data: { preferredBase, firstBase, currentBases: wizardSets?.bases || [] }, timestamp: Date.now() }) }).catch(() => {})
		// #endregion
		const next = { ...wizardSets, bases: [firstBase] }
		setWizardSets(next)
	}, [appearance, wizardSets, dimensionCatalog])

	useEffect(() => {
		if (appearance !== "newDemo") return
		const horizons = Array.isArray(wizardSets?.horizons) ? wizardSets.horizons : []
		if (!horizons.length) {
			const next = { ...wizardSets, horizons: ["T01"] }
			setWizardSets(next)
			return
		}
		if (!horizons.includes("T04")) return
		const next = { ...wizardSets, horizons: ["T01"] }
		setWizardSets(next)
	}, [appearance, wizardSets])

	const canSendNewDemo = useMemo(() => {
		if (appearance !== "newDemo") return true
		if (hasVoiceInput) return true
		if (hasTemplateSelection && selectedTemplateId) return true
		if (hasConstructorFinalConfirm) return true
		// #region agent log
		fetch("http://127.0.0.1:7689/ingest/835d33eb-bbbf-4335-a415-5b77553fca5e", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "945340" }, body: JSON.stringify({ sessionId: "945340", runId: "pre-fix", hypothesisId: "H4", location: "AIAssistantWidget.jsx:canSendNewDemo", message: "send remains disabled", data: { hasVoiceInput, hasTemplateSelection, selectedTemplateId: selectedTemplateId || null, hasConstructorInput }, timestamp: Date.now() }) }).catch(() => {})
		// #endregion
		return false
	}, [appearance, hasVoiceInput, hasTemplateSelection, selectedTemplateId, hasConstructorFinalConfirm])

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

	useEffect(() => {
		if (appearance !== "newDemo") return
		if (!open) return
		if (!selectedAssetName) return
		if (selectedTemplateId) return
		setQuestion(buildQuestionFromWizard(wizardSets, wizardTargets, wizardStep))
	}, [appearance, open, selectedAssetName, selectedTemplateId, wizardStep, wizardSets, wizardTargets, buildQuestionFromWizard])

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
		if (appearance === "newDemo" && !canSendNewDemo) return
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
				setWizardSets(normalizeWizardSets(DEFAULT_NEW_DEMO_WIZARD_SETS))
				setWizardTargets({ objectives: {}, constraints: {} })
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
		canSendNewDemo,
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
		setQuestion(withAssetPrefix(value))
		setSelectedTemplateId(null)
		setWizardSets(normalizeWizardSets(DEFAULT_NEW_DEMO_WIZARD_SETS))
		setWizardTargets({ objectives: { G01: { mode: "maximize", value: 10 } }, constraints: {} })
		setWizardStep(1)
		setConstructorExpanded(false)
		setWizardDirty(false)
		lastSeededNormRef.current = ""
	}, [withAssetPrefix])

	const handleResetScenario = useCallback(() => {
		const defaultSets = normalizeWizardSets(DEFAULT_NEW_DEMO_WIZARD_SETS)
		const defaultTargets = { objectives: { G01: { mode: "maximize", value: 10 } }, constraints: {} }
		setSelectedTemplateId(null)
		setLivePipeline(null)
		setTranscript("")
		setQuestion(buildQuestionFromWizard(defaultSets, defaultTargets, 1))
		setWizardSets(defaultSets)
		setWizardTargets(defaultTargets)
		setWizardStep(1)
		setConstructorExpanded(false)
		setWizardDirty(false)
		setHasTemplateSelection(false)
		setHasConstructorInput(false)
		setHasConstructorFinalConfirm(false)
		setHasVoiceInput(false)
		lastSeededNormRef.current = ""
	}, [buildQuestionFromWizard])

	const handleToggleConstructorExpanded = useCallback(() => {
		setConstructorExpanded((isOpen) => {
			const nextOpen = !isOpen
			if (
				nextOpen &&
				!wizardDirty &&
				appearance === "newDemo" &&
				((wizardSets?.bases || [])[0] !== "B01" ||
					(wizardSets?.objectives || []).length !== 1 ||
					(wizardSets?.objectives || [])[0] !== "G01" ||
					(wizardSets?.levers || []).length !== 3 ||
					!["L01", "L02", "L04"].every((id) => (wizardSets?.levers || []).includes(id)))
			) {
				setWizardSets((prev) => ({
					...prev,
					bases: ["B01"],
					objectives: ["G01"],
					levers: ["L01", "L02", "L04"],
				}))
			}
			return nextOpen
		})
	}, [appearance, wizardDirty, wizardSets])

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

	useEffect(() => {
		if (appearance !== "newDemo") return
		const el = promptInputRef.current
		if (!el) return
		const nextText = String(inputValue || "")
		if (el.innerText !== nextText) el.innerText = nextText
	}, [appearance, inputValue])

	const renderPromptWithHighlight = (text) => {
		const src = String(text || "")
		if (!src) return null
		const tokens = [
			"Сформируй сценарий для ",
			"с горизонтом планирования в",
			"относительно базы",
			"который должен достигать следующих целей:",
			"с учётом следующих ограничений:",
			"за счёт применения рычагов:",
		]
		const out = []
		let pos = 0
		while (pos < src.length) {
			let nextIdx = -1
			let nextTok = ""
			for (const tok of tokens) {
				const i = src.indexOf(tok, pos)
				if (i >= 0 && (nextIdx < 0 || i < nextIdx)) {
					nextIdx = i
					nextTok = tok
				}
			}
			if (nextIdx < 0) {
				out.push(<span key={`p-${pos}`}>{src.slice(pos)}</span>)
				break
			}
			if (nextIdx > pos) out.push(<span key={`p-${pos}`}>{src.slice(pos, nextIdx)}</span>)
			out.push(
				<span key={`k-${nextIdx}`} className={styles.promptSkeletonToken}>
					{nextTok}
				</span>,
			)
			pos = nextIdx + nextTok.length
		}
		return out
	}
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
											? "Здравствуйте: выберите готовый шаблон сценария (1) ниже или воспользуйтесь конструктором запроса (2). Чтобы задать запрос в свободной форме (3) воспользуйтесь микрофоном в окне запроса."
										: "Здравствуйте, задайте свой промпт."}
						</p>

						{appearance === "newDemo" ? (
							<>
								<NewDemoAiPromptConstructor
									presets={scenarioTemplatesForForm}
									selectedTemplateId={selectedTemplateId}
									constructorExpanded={constructorExpanded}
									onToggleConstructorExpanded={handleToggleConstructorExpanded}
									onSelectTemplate={(t) => {
										setSelectedTemplateId(t.id)
										setHasTemplateSelection(true)
										setQuestion(buildFormalizatorTemplatePrompt(t.id))
										setTranscript("")
									}}
									constructorDisplay={constructorDisplay}
									wizardStep={wizardStep}
									onWizardStep={setWizardStep}
									dimensionCatalog={dimensionCatalog}
									wizardSets={wizardSets}
									wizardTargets={wizardTargets}
									onToggleDimension={handleToggleDimensionAndSync}
									onSetTargetValue={handleSetTargetValue}
									onSetObjectiveMode={handleSetObjectiveMode}
									onObjectiveDelta={handleObjectiveDelta}
									onSetConstraintMode={handleSetConstraintMode}
									onConstraintDelta={handleConstraintDelta}
									maxPerDimension={WIZARD_STEP_MAX}
									onStepUp={() => {
										setWizardDirty(true)
										setHasConstructorFinalConfirm(false)
										setWizardStep((s) => Math.max(1, s - 1))
									}}
									onStepDown={() => {
										setWizardDirty(true)
										setHasConstructorFinalConfirm(false)
										setWizardStep((s) => Math.min(5, s + 1))
									}}
									onConfirmStep={() => {
										if (wizardStep === 3 && !(wizardSets?.objectives?.length > 0)) return
										setWizardDirty(true)
										setWizardStep((s) => {
											if (s >= 5) {
												setHasConstructorInput(true)
												setHasConstructorFinalConfirm(true)
												setConstructorExpanded(false)
												return 5
											}
											return Math.min(5, s + 1)
										})
									}}
								/>
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
								<div className={styles.promptWindowLabel}>
									<span className={styles.sectionBadge}>3</span>
									Окно запроса
								</div>
							</>
						) : null}

						<div className={styles.inputRow}>
							{appearance === "newDemo" ? (
								<div className={styles.inputStack}>
									<div
										className={`${styles.input} ${styles.inputCompact} ${styles.inputRich} ${styles.inputHighlightOverlay}`}
										aria-hidden="true"
									>
										{renderPromptWithHighlight(inputValue)}
									</div>
									<div
										ref={promptInputRef}
										className={`${styles.input} ${styles.inputCompact} ${styles.inputRich} ${styles.inputRichEditable} ${isListening ? styles.inputRichDisabled : ""}`}
										contentEditable={!isListening}
										suppressContentEditableWarning
										data-placeholder={isListening ? "Слушаю…" : "Введите промпт"}
										onInput={(e) => setQuestion(e.currentTarget.innerText)}
										onKeyDown={(e) => {
											if (e.key === "Enter" && !e.shiftKey) {
												e.preventDefault()
												handleSend()
											}
										}}
										aria-label="Введите промпт"
										role="textbox"
										aria-multiline="true"
									/>
								</div>
							) : (
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
							)}
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
							<div className={styles.actionsLeft}>
								{appearance === "newDemo" ? (
									<button
										type="button"
										className={`${styles.openThinking} ${styles.resetInline}`}
										onClick={handleResetScenario}
									>
										{DEMO_AI_ASSISTANT_RESET_ACTION_LABEL}
									</button>
								) : null}
								<button
									type="button"
									className={styles.openThinking}
									onClick={() => onThinkingPanelOpen?.(true)}
									disabled={!isResultReopenable}
								>
									{appearance === "newDemo" ? "Открыть Мышление" : "Открыть мышление"}
								</button>
							</div>
							<button
								type="button"
								className={styles.send}
								onClick={handleSend}
								disabled={appearance === "newDemo" && !canSendNewDemo}
							>
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
