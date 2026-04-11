import {
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom"

import appLayoutStyles from "../../app/layouts/AppLayout.module.css"
import { useStand } from "../../app/stands/standContext"
import { standHref } from "../../app/stands/standPathUtils"
import BPMBoard from "../../modules/planning/ui/BPMBoard"
import { normalizePlanningBoardPayload } from "../../modules/planning/lib/planningApiBoard"
import { serializeBoardForSave } from "../../modules/planning/lib/serializeBoardForSave"
import { useAppStore } from "../../core/store/appStore"
import { bpmToMermaid } from "../../modules/planning/lib/bpmToMermaid"
import { useMapPointsData } from "../../modules/globe/model/useMapPointsData"
import { API_V1_PREFIX, apiFetch } from "../../core/data/repositories/http/httpClient.js"
import {
	AI_PLANNING_BOARD_PRESETS,
	AI_PLANNING_PRESET_SCENARIO_NAMES,
} from "../../modules/planning/data/aiPlanningBoardPresets.js"

const PLANNING_CASES_LIST_URL = `${API_V1_PREFIX}/planning/cases`

function normalizeScenarioTitle(s) {
	return String(s || "")
		.trim()
		.toLowerCase()
		.replace(/[\u201c\u201d\u201e\u00ab\u00bb]/g, '"')
}

/**
 * UUID сценария по имени (короткому или полному) или по коду SC-… из списка API.
 * @param {string} title
 * @returns {Promise<string | null>}
 */
async function resolveScenarioIdFromApi(title) {
	if (!title || typeof title !== "string") return null
	const list = await apiFetch(`${API_V1_PREFIX}/scenarios`)
	if (!Array.isArray(list)) return null
	const n = normalizeScenarioTitle(title)

	const byExact = list.find((s) => normalizeScenarioTitle(s.name) === n)
	if (byExact) return String(byExact.id)

	const byPrefix = list.find((s) =>
		normalizeScenarioTitle(s.name).startsWith(n),
	)
	if (byPrefix) return String(byPrefix.id)

	const byContains = list.find((s) =>
		normalizeScenarioTitle(s.name).includes(n),
	)
	if (byContains) return String(byContains.id)

	const code = title.trim().match(/^SC-\d+/i)
	if (code) {
		const c = code[0].toUpperCase()
		const byExt = list.find(
			(s) => String(s.externalCode || "").toUpperCase() === c,
		)
		if (byExt) return String(byExt.id)
	}

	return null
}

export function PlanningPage() {
	const navigate = useNavigate()
	const { routePrefix } = useStand()
	const { onBpmCommandConsumed } = useOutletContext() || {}
	const [searchParams, setSearchParams] = useSearchParams()
	const aiFromThinking = searchParams.get("aiFromThinking") === "1"
	const presetFromUrl = searchParams.get("preset") || ""

	const {
		selectedScenarioName,
		setSelectedScenarioName,
		selectedScenarioId,
		setSelectedScenarioId,
		selectedAssetId,
		bpmHighlight,
		bpmStages,
		bpmTasks,
		bpmConnections,
		bpmCommand,
		setBpmBoard,
		planningCaseId,
		setPlanningCaseId,
		aiMode,
		setAiMode,
		setFlowCode,
		servicePageName,
		setServicePageName,
		aiAssistantPreset,
		setAiAssistantPreset,
		agreedAiPlanningBoardPreset,
		setAgreedAiPlanningBoardPreset,
	} = useAppStore()

	const mapPointsData = useMapPointsData()

	const disabledTabs = useMemo(() => {
		const raw = (import.meta.env.VITE_EXPO_DISABLE_TABS || "").trim()
		if (!raw) return new Set()
		return new Set(
			raw
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean),
		)
	}, [])

	const [boardMountKey, setBoardMountKey] = useState("default")
	const [planningCaseLoading, setPlanningCaseLoading] = useState(false)
	const saveBoardTimerRef = useRef(null)
	const pendingBoardRef = useRef(null)
	const planningCaseIdRef = useRef(null)
	const flushBoardSaveRef = useRef(() => Promise.resolve())

	planningCaseIdRef.current = planningCaseId

	flushBoardSaveRef.current = () => {
		const caseId = planningCaseIdRef.current
		const pending = pendingBoardRef.current
		if (!caseId || !pending) return Promise.resolve()
		const board = serializeBoardForSave(
			pending.stages,
			pending.tasks,
			pending.connections,
		)
		return apiFetch(
			`${API_V1_PREFIX}/planning/cases/${caseId}/board`,
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ board }),
			},
		).catch((err) => {
			console.error("planning board save failed", err)
		})
	}

	const selectedAssetPoint = useMemo(
		() =>
			selectedAssetId
				? mapPointsData.find((p) => p.id === selectedAssetId)
				: null,
		[selectedAssetId, mapPointsData],
	)

	/** Пресет xlsx: из URL при переходе или из стора после поглощения loadAiPresetBoard. */
	const resolvedAiPresetKey = useMemo(() => {
		if (aiFromThinking && presetFromUrl && AI_PLANNING_BOARD_PRESETS[presetFromUrl])
			return presetFromUrl
		if (aiAssistantPreset && AI_PLANNING_BOARD_PRESETS[aiAssistantPreset])
			return aiAssistantPreset
		if (
			agreedAiPlanningBoardPreset &&
			AI_PLANNING_BOARD_PRESETS[agreedAiPlanningBoardPreset]
		)
			return agreedAiPlanningBoardPreset
		return null
	}, [
		aiFromThinking,
		presetFromUrl,
		aiAssistantPreset,
		agreedAiPlanningBoardPreset,
	])

	const resolvedAiPresetBoard = resolvedAiPresetKey
		? AI_PLANNING_BOARD_PRESETS[resolvedAiPresetKey]
		: null

	/** Доска из пресета ИИ должна оставаться на экране после onBpmCommandConsumed (bpmCommand → null). */
	const aiPresetPlanningActive = Boolean(
		bpmCommand?.scenarioId === "loadAiPresetBoard" || resolvedAiPresetBoard,
	)

	useEffect(() => {
		if (!aiFromThinking || !presetFromUrl) return
		const presetBoard = AI_PLANNING_BOARD_PRESETS[presetFromUrl]
		if (!presetBoard) return
		setSelectedScenarioId(null)
		setPlanningCaseId(null)
		setSelectedScenarioName(presetBoard.scenarioName)
		setBoardMountKey(`ai-preset-${presetFromUrl}-${Date.now()}`)
	}, [
		aiFromThinking,
		presetFromUrl,
		setPlanningCaseId,
		setSelectedScenarioId,
		setSelectedScenarioName,
	])

	const handleAiPlanningAgreeReturn = useCallback(() => {
		const preset = presetFromUrl || aiAssistantPreset
		if (!preset) return
		setAgreedAiPlanningBoardPreset(preset)
		setAiAssistantPreset(null)
		const next = new URLSearchParams(searchParams)
		next.delete("aiFromThinking")
		next.delete("preset")
		setSearchParams(next, { replace: true })
		const faceBase = standHref(routePrefix, "face")
		navigate(`${faceBase}?aiReturn=1&preset=${encodeURIComponent(preset)}`)
	}, [
		aiAssistantPreset,
		navigate,
		presetFromUrl,
		routePrefix,
		searchParams,
		setAgreedAiPlanningBoardPreset,
		setAiAssistantPreset,
		setSearchParams,
	])

	/** После согласования на главной имя сценария в сторе может отличаться от пресета доски. */
	useEffect(() => {
		if (!agreedAiPlanningBoardPreset || aiFromThinking || aiAssistantPreset) return
		const board = AI_PLANNING_BOARD_PRESETS[agreedAiPlanningBoardPreset]
		if (!board?.scenarioName) return
		if (selectedScenarioName === board.scenarioName) return
		setSelectedScenarioName(board.scenarioName)
		setSelectedScenarioId(null)
		setPlanningCaseId(null)
	}, [
		agreedAiPlanningBoardPreset,
		aiAssistantPreset,
		aiFromThinking,
		selectedScenarioName,
		setPlanningCaseId,
		setSelectedScenarioId,
		setSelectedScenarioName,
	])

	// После reset preset selectedScenarioId может быть null, а имя дефолтного сценария уже есть.
	// Восстанавливаем scenarioId через API, чтобы Planning не оставался пустым.
	useEffect(() => {
		if (selectedScenarioId || !selectedScenarioName) return
		let cancelled = false
		;(async () => {
			try {
				const sid = await resolveScenarioIdFromApi(selectedScenarioName)
				if (!cancelled && sid) setSelectedScenarioId(sid)
			} catch {
				/* noop */
			}
		})()
		return () => {
			cancelled = true
		}
	}, [selectedScenarioId, selectedScenarioName, setSelectedScenarioId])

	useEffect(() => {
		if (!selectedScenarioId) {
			// Доска из пресета ИИ (xlsx): в API может не быть scenarioId — не сбрасывать key,
			// иначе BPMBoard перемонтируется и теряет данные после loadAiPresetBoard.
			const keepAiPresetBoard =
				(aiFromThinking &&
					presetFromUrl &&
					AI_PLANNING_BOARD_PRESETS[presetFromUrl]) ||
				(agreedAiPlanningBoardPreset &&
					AI_PLANNING_BOARD_PRESETS[agreedAiPlanningBoardPreset]) ||
				(selectedScenarioName &&
					AI_PLANNING_PRESET_SCENARIO_NAMES.has(selectedScenarioName))
			if (keepAiPresetBoard) {
				setPlanningCaseId(null)
				return
			}
			setBoardMountKey("default")
			setPlanningCaseId(null)
			return
		}

		setBoardMountKey(`pending-${selectedScenarioId}`)

		let cancelled = false
		setPlanningCaseLoading(true)

		;(async () => {
			try {
				const cases = await apiFetch(PLANNING_CASES_LIST_URL)
				if (cancelled) return
				const match = Array.isArray(cases)
					? cases.find(
							(c) =>
								String(c.scenarioId ?? "") ===
								String(selectedScenarioId ?? ""),
						)
					: null
				if (!match) {
					if (selectedScenarioName) {
						try {
							const sid = await resolveScenarioIdFromApi(
								selectedScenarioName,
							)
							if (
								!cancelled &&
								sid &&
								sid !== String(selectedScenarioId ?? "")
							) {
								setSelectedScenarioId(sid)
								return
							}
						} catch {
							/* fall through */
						}
					}
					setBpmBoard(null, null, null)
					setPlanningCaseId(null)
					setBoardMountKey(`${selectedScenarioId}-none`)
					return
				}
				const detail = await apiFetch(
					`${API_V1_PREFIX}/planning/cases/${match.id}`,
				)
				if (cancelled) return
				const board =
					normalizePlanningBoardPayload(detail.board ?? {}) ?? {
						stages: [],
						tasks: {},
						connections: [],
					}
				setPlanningCaseId(match.id)
				setBpmBoard(board.stages, board.tasks, board.connections)
				setFlowCode(bpmToMermaid(board.stages, board.tasks))
				setBoardMountKey(`${selectedScenarioId}-${match.id}`)
			} catch {
				if (!cancelled) {
					setPlanningCaseId(null)
					setBpmBoard(null, null, null)
					setBoardMountKey(`${selectedScenarioId}-error`)
				}
			} finally {
				if (!cancelled) setPlanningCaseLoading(false)
			}
		})()

		return () => {
			cancelled = true
			if (saveBoardTimerRef.current) {
				clearTimeout(saveBoardTimerRef.current)
				saveBoardTimerRef.current = null
			}
			void flushBoardSaveRef.current()
		}
	}, [
		selectedScenarioId,
		selectedScenarioName,
		agreedAiPlanningBoardPreset,
		aiFromThinking,
		presetFromUrl,
		setBpmBoard,
		setFlowCode,
		setPlanningCaseId,
		setSelectedScenarioId,
	])

	const handleBoardChange = useCallback((stages, tasks, connections) => {
		setBpmBoard(stages, tasks, connections)
		setFlowCode(bpmToMermaid(stages, tasks))
		pendingBoardRef.current = { stages, tasks, connections }
		if (!planningCaseIdRef.current) return
		if (saveBoardTimerRef.current) {
			clearTimeout(saveBoardTimerRef.current)
		}
		saveBoardTimerRef.current = setTimeout(() => {
			saveBoardTimerRef.current = null
			void flushBoardSaveRef.current()
		}, 650)
	}, [setBpmBoard, setFlowCode])

	const handleOpenPlanningWithScenario = useCallback(
		async (arg) => {
			const name =
				typeof arg === "string" ? arg : arg?.name
			let sid =
				typeof arg === "object" && arg?.scenarioId
					? String(arg.scenarioId)
					: null
			if (!sid && name) {
				try {
					sid = await resolveScenarioIdFromApi(name)
				} catch {
					sid = null
				}
			}
			setSelectedScenarioName(
				name ||
					"Проактивное управление ремонтами и приоритетами",
			)
			setSelectedScenarioId(sid)
			setAiAssistantPreset(null)
			setAgreedAiPlanningBoardPreset(null)
			navigate("/planning")
		},
		[
			navigate,
			setAgreedAiPlanningBoardPreset,
			setAiAssistantPreset,
			setSelectedScenarioId,
			setSelectedScenarioName,
		],
	)

	const handleBackToScenarios = useCallback(() => {
		navigate(standHref(routePrefix, "scenarios"))
	}, [navigate, routePrefix])

	const canGoBackToScenarios = !disabledTabs.has("scenarios")

	if (servicePageName) {
		return (
			<div
				className={`${appLayoutStyles["app-content"]} ${appLayoutStyles["app-content-service"]}`}
			>
				<div className={appLayoutStyles["service-page"]}>
					<button
						type="button"
						className={appLayoutStyles["service-page-back"]}
						onClick={() => {
							setServicePageName(null)
						}}
					>
						<span
							className={appLayoutStyles["service-page-back-arrow"]}
							aria-hidden
						/>
						Назад
					</button>

					<h1 className={appLayoutStyles["service-page-title"]}>
						{servicePageName}
					</h1>
				</div>
			</div>
		)
	}

	const hideBoardForCaseFetch =
		!aiPresetPlanningActive &&
		selectedScenarioId &&
		planningCaseLoading &&
		bpmCommand?.scenarioId !== "createPlanningCase" &&
		bpmCommand?.scenarioId !== "loadAiPresetBoard"
	/** Доска из API, режим ИИ createPlanningCase или пресет доски из ИИ (xlsx-аналог). */
	const showPlanningBoard =
		!hideBoardForCaseFetch &&
		(Boolean(planningCaseId) ||
			bpmCommand?.scenarioId === "createPlanningCase" ||
			aiPresetPlanningActive)

	const showNoCaseWarning =
		Boolean(selectedScenarioId) &&
		!planningCaseLoading &&
		!planningCaseId &&
		bpmCommand?.scenarioId !== "createPlanningCase" &&
		bpmCommand?.scenarioId !== "loadAiPresetBoard"

	return (
		<div
			className={`${appLayoutStyles["app-content"]} ${appLayoutStyles["app-content-bpm"]}`}
		>
			{selectedScenarioId &&
				planningCaseLoading &&
				bpmCommand?.scenarioId !== "createPlanningCase" &&
				bpmCommand?.scenarioId !== "loadAiPresetBoard" && (
					<div className={appLayoutStyles["bpm-loading"]} aria-live="polite">
						Загрузка доски планирования…
					</div>
				)}
			{showNoCaseWarning && (
				<div
					className={appLayoutStyles["bpm-board-warning"]}
					role="alert"
				>
					Для этого сценария в базе нет кейса планирования (planning_case)
					— доска не загружается. Данные доски хранятся только в БД;
					обратитесь к администратору, чтобы создать кейс для сценария, или
					выберите другой сценарий.
				</div>
			)}
			{aiFromThinking && presetFromUrl && AI_PLANNING_BOARD_PRESETS[presetFromUrl] ? (
				<div
					className={appLayoutStyles["bpm-ai-agree-bar"]}
					role="region"
					aria-label="Согласование возврата после сценария ИИ"
				>
					<span>Сценарий сформирован ИИ помощником и требует согласования.</span>
					<button type="button" onClick={handleAiPlanningAgreeReturn}>
						Согласовать
					</button>
				</div>
			) : null}
			{showPlanningBoard && (
				<Suspense
					fallback={
						<div className={appLayoutStyles["bpm-loading"]}>
							Загрузка...
						</div>
					}
				>
					<BPMBoard
						key={boardMountKey}
						scenarioName={selectedScenarioName}
						initialStages={
							bpmCommand?.scenarioId === "createPlanningCase"
								? undefined
								: resolvedAiPresetBoard
									? resolvedAiPresetBoard.stages
									: bpmStages
						}
						initialTasks={
							bpmCommand?.scenarioId === "createPlanningCase"
								? undefined
								: resolvedAiPresetBoard
									? resolvedAiPresetBoard.tasks
									: bpmTasks
						}
						initialConnections={
							bpmCommand?.scenarioId === "createPlanningCase"
								? undefined
								: resolvedAiPresetBoard?.connections ??
									bpmConnections ??
									undefined
						}
						selectedAssetName={selectedAssetPoint?.name}
						highlightCardName={bpmHighlight}
						onClose={canGoBackToScenarios ? handleBackToScenarios : undefined}
						onBoardChange={handleBoardChange}
						aiMode={aiMode}
						setAiMode={setAiMode}
						onOpenPlanningWithScenario={handleOpenPlanningWithScenario}
						bpmCommand={bpmCommand}
						onBpmCommandConsumed={onBpmCommandConsumed}
						animateAiBoardReveal={Boolean(
							aiFromThinking &&
								presetFromUrl &&
								AI_PLANNING_BOARD_PRESETS[presetFromUrl],
						)}
					/>
				</Suspense>
			)}
		</div>
	)
}

export default PlanningPage
