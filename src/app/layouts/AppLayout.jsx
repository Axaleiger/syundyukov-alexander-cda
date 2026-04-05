import React, { Suspense, useEffect, useCallback, useRef, useMemo } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import styles from "./AppLayout.module.css"
import "../../modules/thinking/thinkingDrawerGlobals.css"
import { useAppStore } from "../../core/store/appStore"
import CDPage from "../../modules/cd/ui/CDPage"
import BPMBoard from "../../modules/planning/ui/BPMBoard"
import { getBoardIdForAsset } from "../../modules/planning/lib/planningHelpers"
import { getScenarioGraphNodesFromBoard } from "../../modules/planning/lib/planningGraphNodes"
import { HeaderMain } from "../../shared/ui/Header/HeaderMain"
import { SidebarMain } from "../../shared/ui/Sidebar/SidebarMain"
import { SecondarySidebar } from "../../shared/ui/SecondarySidebar/SecondarySidebar"
import AIAssistantWidget from "../../modules/ai/ui/AIAssistantWidget"
import AiThinkingUI from "../../modules/thinking/ui/AiThinkingUI"
import BrainChainView from "../../modules/thinking/ui/BrainChainView"
import { getSchemaFromFlowCode } from "../../modules/ontology/lib/ontologyBootstrap"

/** Совпадает с `ADMIN_SUB_TABS` в SecondarySidebar / main-stand */
const LEGACY_ADMIN_SUBTAB_IDS = new Set([
	"roles",
	"catalog",
	"integration",
	"changes",
	"add-service",
])

export const AppLayout = () => {
	const location = useLocation()
	const navigate = useNavigate()
	const {
		cdPageNode,
		setCdPageNode,
		showBpm,
		setShowBpm,
		bpmHighlight,
		setBpmHighlight,
		selectedScenarioName,
		selectedAssetId,
		bpmStages,
		bpmTasks,
		bpmCommand,
		aiMode,
		setAiMode,
		setBpmCommand,
		thinkingPanelOpen,
		setThinkingPanelOpen,
		thinkingSteps,
		setThinkingSteps,
		thinkingCurrentMessage,
		setThinkingCurrentMessage,
		thinkingPaused,
		setThinkingPaused,
		thinkingAwaitingConfirm,
		setThinkingAwaitingConfirm,
		thinkingConfirmPhase,
		setThinkingConfirmPhase,
		thinkingGraphNodes,
		setThinkingGraphNodes,
		setScenarioComparisonRevision,
		brainPanelOpenKey,
		setBrainPanelOpenKey,
		selectedDecisionPathId,
		setSelectedDecisionPathId,
		appliedDecisionPathId,
		setAppliedDecisionPathId,
		flowCode,
		setFlowCode,
		openConfiguratorFromPlanning,
		setOpenConfiguratorFromPlanning,
		setConfiguratorInitialNodes,
		setConfiguratorInitialEdges,
		setResultsDashboardFocus,
		setHypercubeCaseIntro,
		setConfiguratorNodeCommand,
		setAdminSubTab,
		setServicePageName,
	} = useAppStore()

	const thinkingConfirmResolverRef = useRef(null)
	const legacyHashNavigationDoneRef = useRef("")
	const bpmCommandConsumedRef = useRef(null)
	const thinkingConfirmPhaseRef = useRef(null)
	thinkingConfirmPhaseRef.current = thinkingConfirmPhase

	const thinkingChainRevealedRef = useRef(false)
	const prevThinkingPanelOpenRef = useRef(thinkingPanelOpen)
	const selectedDecisionPathIdRef = useRef(null)
	selectedDecisionPathIdRef.current = selectedDecisionPathId

	useEffect(() => {
		if (thinkingPanelOpen && !prevThinkingPanelOpenRef.current) {
			setBrainPanelOpenKey((k) => k + 1)
			thinkingChainRevealedRef.current = false
		}
		prevThinkingPanelOpenRef.current = thinkingPanelOpen
	}, [thinkingPanelOpen, setBrainPanelOpenKey])

	const resetThinkingChain = useCallback(() => {
		thinkingChainRevealedRef.current = false
	}, [])

	const graphNodesForThinking = useMemo(() => {
		if (bpmStages?.length && bpmTasks) {
			const fromBoard = getScenarioGraphNodesFromBoard(bpmStages, bpmTasks)
			if (fromBoard.length) return fromBoard
		}
		return thinkingGraphNodes
	}, [bpmStages, bpmTasks, thinkingGraphNodes])

	const setActiveTab = useCallback(
		(tab) => {
			if (tab === "face") navigate("/face")
			else if (tab === "scenarios") navigate("/scenarios")
			else if (tab === "planning") navigate("/planning")
			else if (tab === "ontology") navigate("/ontology")
			else if (tab === "results") navigate("/results")
			else if (tab === "admin") navigate("/admin")
		},
		[navigate],
	)

	const path = (location.pathname || "").replace(/\/$/, "") || "/"
	const isThinkingDrawerCollapsed =
		path.endsWith("/planning") || path.endsWith("/ontology")
	const showCollapsedBrainMinimal =
		isThinkingDrawerCollapsed && thinkingConfirmPhase === "brain"

	const requestUserConfirm = useCallback(
		(label, options) => {
			setThinkingPanelOpen(true)
			thinkingChainRevealedRef.current = false
			setThinkingPaused(false)
			setThinkingAwaitingConfirm(true)
			const phase = options?.phase ?? "planning"
			const refreshScenarioPanel = !!options?.refreshScenarioPanel
			setThinkingConfirmPhase(phase)
			setThinkingCurrentMessage(label)
			return new Promise((resolve) => {
				thinkingConfirmResolverRef.current = () => {
					setThinkingAwaitingConfirm(false)
					if (refreshScenarioPanel) {
						setScenarioComparisonRevision((n) => n + 1)
					}
					if (thinkingConfirmPhaseRef.current !== "brain")
						setThinkingConfirmPhase(null)
					thinkingConfirmResolverRef.current = null
					resolve()
				}
			})
		},
		[
			setThinkingPanelOpen,
			setThinkingPaused,
			setThinkingAwaitingConfirm,
			setThinkingConfirmPhase,
			setThinkingCurrentMessage,
			setScenarioComparisonRevision,
		],
	)

	const onBpmCommandConsumed = useCallback(
		async (opts) => {
			setBpmCommand(null)

			const codeForSchema = opts?.flowCode ?? flowCode

			if (opts?.flowCode) {
				setFlowCode(opts.flowCode)
			}

			if (opts?.switchToOntology === false) {
				bpmCommandConsumedRef.current?.()
				return
			}

			await requestUserConfirm(
				"Проверьте сквозной бизнес-сценарий на доске планирования и нажмите «Согласовать», чтобы построить схему в Конфигураторе систем.",
				{ phase: "brain" },
			)

			const schema = getSchemaFromFlowCode(codeForSchema)

			if (schema?.nodes?.length) {
				setConfiguratorInitialNodes(schema.nodes)
				setConfiguratorInitialEdges(schema.edges || [])
			} else {
				setConfiguratorInitialNodes(null)
				setConfiguratorInitialEdges(null)
			}

			setOpenConfiguratorFromPlanning(true)

			setShowBpm(false)
			navigate("/ontology")
			bpmCommandConsumedRef.current?.()
		},
		[
			flowCode,
			setBpmCommand,
			setFlowCode,
			setConfiguratorInitialNodes,
			setConfiguratorInitialEdges,
			setOpenConfiguratorFromPlanning,
			setShowBpm,
			requestUserConfirm,
			navigate,
		],
	)

	const handleThinkingConfirm = useCallback(() => {
		if (selectedDecisionPathIdRef.current) {
			setAppliedDecisionPathId(selectedDecisionPathIdRef.current)
		}
		if (thinkingConfirmResolverRef.current) {
			thinkingConfirmResolverRef.current()
		}
		setThinkingPanelOpen(false)
		setThinkingCurrentMessage("")
		setThinkingPaused(false)
		setThinkingConfirmPhase(null)
	}, [
		setAppliedDecisionPathId,
		setThinkingPanelOpen,
		setThinkingCurrentMessage,
		setThinkingPaused,
		setThinkingConfirmPhase,
	])

	const handleRecalculateDecision = useCallback(() => {
		if (!selectedDecisionPathIdRef.current) return
		setBpmCommand({
			scenarioId: "createPlanningCase",
			params: { topic: selectedDecisionPathIdRef.current },
		})
	}, [setBpmCommand])

	useEffect(() => {
		if (!thinkingPanelOpen) return
		const prev = document.body.style.overflow
		document.body.style.overflow = "hidden"
		return () => {
			document.body.style.overflow = prev
		}
	}, [thinkingPanelOpen])

	const addThinkingStep = useCallback(
		(label) => {
			setThinkingSteps((prev) => {
				if (prev.length && prev[prev.length - 1]?.label === label) return prev
				return [
					...prev,
					{
						id: `step-${Date.now()}-${prev.length}-${Math.random().toString(36).slice(2)}`,
						label,
						status: "done",
					},
				]
			})
			setThinkingCurrentMessage(label)
		},
		[setThinkingSteps, setThinkingCurrentMessage],
	)

	useEffect(() => {
		if (!openConfiguratorFromPlanning) return
		setOpenConfiguratorFromPlanning(false)
	}, [openConfiguratorFromPlanning, setOpenConfiguratorFromPlanning])

	useEffect(() => {
		const params = new URLSearchParams(location.search)
		const cd = params.get("cd")
		if (cd) {
			try {
				setCdPageNode(decodeURIComponent(cd))
			} catch {
				setCdPageNode(cd)
			}
		}
		if (params.get("bpm") === "1") {
			setShowBpm(true)
			setBpmHighlight(params.get("highlight") || null)
			return
		}

		const rawHash = (location.hash || "").replace(/^#/, "")
		if (!rawHash) {
			legacyHashNavigationDoneRef.current = ""
			return
		}

		const hashKey = location.hash || ""
		if (legacyHashNavigationDoneRef.current === hashKey) return

		const serviceMatch = rawHash.match(/^\/?service\/(.+)$/)
		if (serviceMatch) {
			const name = serviceMatch[1]
			try {
				setServicePageName(decodeURIComponent(name))
			} catch {
				setServicePageName(name)
			}
			legacyHashNavigationDoneRef.current = hashKey
			navigate("/planning", { replace: true })
			return
		}

		if (rawHash.startsWith("admin-")) {
			const sub = rawHash.slice(6)
			const validSub = LEGACY_ADMIN_SUBTAB_IDS.has(sub) ? sub : "roles"
			setAdminSubTab(validSub)
			legacyHashNavigationDoneRef.current = hashKey
			navigate("/admin", { replace: true })
		}
	}, [
		location.search,
		location.hash,
		location.pathname,
		navigate,
		setCdPageNode,
		setShowBpm,
		setBpmHighlight,
		setServicePageName,
		setAdminSubTab,
	])

	const aiAssistantAndThinkingDrawer = (
		<>
			<AIAssistantWidget
				visible={aiMode}
				setActiveTab={setActiveTab}
				setBpmCommand={setBpmCommand}
				setResultsDashboardFocus={setResultsDashboardFocus}
				setHypercubeCaseIntro={setHypercubeCaseIntro}
				setConfiguratorNodeCommand={setConfiguratorNodeCommand}
				setShowBpm={setShowBpm}
				onThinkingPanelOpen={setThinkingPanelOpen}
				isThinkingPanelOpen={thinkingPanelOpen}
				thinkingSteps={thinkingSteps}
				currentMessage={thinkingCurrentMessage}
				isPaused={thinkingPaused}
				addThinkingStep={addThinkingStep}
				setThinkingSteps={setThinkingSteps}
				setCurrentMessage={setThinkingCurrentMessage}
				setIsPaused={setThinkingPaused}
				requestUserConfirm={requestUserConfirm}
				setThinkingPhase={setThinkingConfirmPhase}
				setThinkingGraphNodes={setThinkingGraphNodes}
				resetThinkingChain={resetThinkingChain}
				onBpmCommandConsumedRef={bpmCommandConsumedRef}
			/>
			{thinkingPanelOpen ? (
				<>
					<div
						className={styles["app-thinking-overlay"]}
						onClick={() => setThinkingPanelOpen(false)}
						aria-hidden
					/>
					<div
						className={`${styles["app-thinking-drawer"]} ${isThinkingDrawerCollapsed ? styles["app-thinking-drawer--collapsed"] : ""}`}
					>
						<div className={styles["app-thinking-drawer-head"]}>
							<h3 className={styles["app-thinking-drawer-title"]}>Режим мышления</h3>
							<button
								type="button"
								className={styles["app-thinking-drawer-close"]}
								onClick={() => setThinkingPanelOpen(false)}
								aria-label="Закрыть"
							>
								×
							</button>
						</div>
						<div className={styles["app-thinking-drawer-body"]}>
							{showCollapsedBrainMinimal ? (
								<div className={styles["app-thinking-drawer-minimal"]}>
									<h3 className={styles["app-thinking-drawer-title"]}>
										Цепочка размышлений
									</h3>
									<button
										type="button"
										className={`${styles["app-thinking-drawer-exit"]} ${styles["app-thinking-drawer-exit--success"]}`}
										onClick={handleThinkingConfirm}
									>
										Согласовать предлагаемый сценарий
									</button>
								</div>
							) : thinkingConfirmPhase === "brain" ? (
								<BrainChainView
									key={`brain-${brainPanelOpenKey}`}
									steps={thinkingSteps}
									graphNodes={graphNodesForThinking}
									chainAlreadyRevealed={thinkingChainRevealedRef.current}
									selectedDecisionPathId={selectedDecisionPathId}
									appliedDecisionPathId={appliedDecisionPathId}
									onSelectDecisionPath={setSelectedDecisionPathId}
									onRecalculate={handleRecalculateDecision}
									awaitingConfirm={thinkingAwaitingConfirm}
									onConfirm={handleThinkingConfirm}
								/>
							) : (
								<AiThinkingUI
									steps={thinkingSteps}
									currentMessage={thinkingCurrentMessage}
									isPaused={thinkingPaused}
									isFinished={thinkingSteps.some(
										(s) => s.label && s.label.includes("Готово"),
									)}
									onStop={() => setThinkingPaused(true)}
									onResume={() => setThinkingPaused(false)}
									awaitingConfirm={thinkingAwaitingConfirm}
									onConfirm={handleThinkingConfirm}
								/>
							)}
							<button
								type="button"
								className={styles["app-thinking-drawer-exit"]}
								onClick={() => {
									thinkingChainRevealedRef.current = true
									setThinkingPanelOpen(false)
									setThinkingCurrentMessage("")
									setThinkingPaused(false)
								}}
							>
								Закрыть панель
							</button>
						</div>
					</div>
				</>
			) : null}
		</>
	)

	if (cdPageNode) {
		return (
			<div className={styles.app}>
				<CDPage
					nodeName={cdPageNode}
					onBack={() => {
						setCdPageNode(null)
						if (typeof window !== "undefined") {
							if (window.history.length > 1) window.history.back()
							else window.close()
						}
					}}
				/>
			</div>
		)
	}

	if (showBpm) {
		return (
			<div className={styles.app}>
				<Suspense fallback={<div className={styles["bpm-loading"]}>Загрузка...</div>}>
					<BPMBoard
						scenarioName={selectedScenarioName}
						highlightCardName={bpmHighlight}
						initialBoardId={
							selectedAssetId ? getBoardIdForAsset(selectedAssetId) : "hantos"
						}
						initialStages={
							bpmCommand?.scenarioId === "createPlanningCase" ? undefined : bpmStages
						}
						initialTasks={
							bpmCommand?.scenarioId === "createPlanningCase" ? undefined : bpmTasks
						}
						aiMode={aiMode}
						setAiMode={setAiMode}
						bpmCommand={bpmCommand}
						onBpmCommandConsumed={onBpmCommandConsumed}
						onClose={() => {
							setShowBpm(false)
							setBpmHighlight(null)
						}}
					/>
				</Suspense>
				{aiAssistantAndThinkingDrawer}
			</div>
		)
	}

	return (
		<div className={`${styles.app} ${styles["app-with-sidebar"]}`}>
			<HeaderMain />

			<div className={styles["app-body"]}>
				<SidebarMain />
				<SecondarySidebar />
				<main className={styles["app-main"]}>
					<Outlet context={{ onBpmCommandConsumed }} />
				</main>
			</div>
			{aiAssistantAndThinkingDrawer}
		</div>
	)
}
