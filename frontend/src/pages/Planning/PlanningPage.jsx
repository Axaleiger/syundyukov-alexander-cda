import {
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { useNavigate, useOutletContext } from "react-router-dom"

import appLayoutStyles from "../../app/layouts/AppLayout.module.css"
import { useStand } from "../../app/stands/standContext"
import { standHref } from "../../app/stands/standPathUtils"
import BPMBoard from "../../modules/planning/ui/BPMBoard"
import { normalizePlanningBoardPayload } from "../../modules/planning/lib/planningApiBoard"
import { serializeBoardForSave } from "../../modules/planning/lib/serializeBoardForSave"
import { useAppStore } from "../../core/store/appStore"
import { bpmToMermaid } from "../../modules/planning/lib/bpmToMermaid"
import mapPointsData from "../../core/data/static/mapPoints.json"
import { API_V1_PREFIX, apiFetch } from "../../core/data/repositories/http/httpClient.js"

/**
 * @param {string} title
 * @returns {Promise<string | null>}
 */
async function resolveScenarioIdFromApi(title) {
	if (!title || typeof title !== "string") return null
	const list = await apiFetch(`${API_V1_PREFIX}/scenarios`)
	const n = title.trim().toLowerCase()
	const hit = list.find((s) => {
		const sn = (s.name || "").toLowerCase()
		return sn.includes(n) || n.includes(sn.slice(0, Math.min(36, sn.length)))
	})
	return hit ? String(hit.id) : null
}

export function PlanningPage() {
	const navigate = useNavigate()
	const { routePrefix } = useStand()
	const { onBpmCommandConsumed } = useOutletContext() || {}

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
	} = useAppStore()

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
		[selectedAssetId],
	)

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
			setBoardMountKey("default")
			setPlanningCaseId(null)
			return
		}

		setBoardMountKey(`pending-${selectedScenarioId}`)

		let cancelled = false
		setPlanningCaseLoading(true)

		;(async () => {
			try {
				const cases = await apiFetch(`${API_V1_PREFIX}/planning/cases`)
				if (cancelled) return
				const match = cases.find(
					(c) =>
						String(c.scenarioId ?? "") ===
						String(selectedScenarioId ?? ""),
				)
				if (!match) {
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
	}, [selectedScenarioId, setBpmBoard, setFlowCode, setPlanningCaseId])

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
			navigate("/planning")
		},
		[navigate, setSelectedScenarioId, setSelectedScenarioName],
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
		selectedScenarioId &&
		planningCaseLoading &&
		bpmCommand?.scenarioId !== "createPlanningCase"
	/** Доска только из API: кейс в БД или режим создания кейса из ИИ — без демо-пресетов. */
	const showPlanningBoard =
		!hideBoardForCaseFetch &&
		(Boolean(planningCaseId) ||
			bpmCommand?.scenarioId === "createPlanningCase")

	const showNoCaseWarning =
		Boolean(selectedScenarioId) &&
		!planningCaseLoading &&
		!planningCaseId &&
		bpmCommand?.scenarioId !== "createPlanningCase"

	return (
		<div
			className={`${appLayoutStyles["app-content"]} ${appLayoutStyles["app-content-bpm"]}`}
		>
			{selectedScenarioId &&
				planningCaseLoading &&
				bpmCommand?.scenarioId !== "createPlanningCase" && (
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
								: bpmStages
						}
						initialTasks={
							bpmCommand?.scenarioId === "createPlanningCase"
								? undefined
								: bpmTasks
						}
						initialConnections={bpmConnections ?? undefined}
						selectedAssetName={selectedAssetPoint?.name}
						highlightCardName={bpmHighlight}
						onClose={canGoBackToScenarios ? handleBackToScenarios : undefined}
						onBoardChange={handleBoardChange}
						aiMode={aiMode}
						setAiMode={setAiMode}
						onOpenPlanningWithScenario={handleOpenPlanningWithScenario}
						bpmCommand={bpmCommand}
						onBpmCommandConsumed={onBpmCommandConsumed}
					/>
				</Suspense>
			)}
		</div>
	)
}

export default PlanningPage
