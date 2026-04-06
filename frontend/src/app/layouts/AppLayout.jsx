import React, { Suspense, useEffect, useCallback, useMemo } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import styles from "./AppLayout.module.css"
import { useAppStore } from "../../core/store/appStore"
import { useResultsStore } from "../../modules/results/model/resultsStore"
import { useAdminStore } from "../../modules/admin/model/adminStore"
import { useThinkingStore } from "../../modules/thinking/model/thinkingStore"
import CDPage from "../../modules/cd/ui/CDPage"
import BPMBoard from "../../modules/planning/ui/BPMBoard"
import { getBoardIdForAsset } from "../../modules/planning/lib/planningHelpers"
import { getScenarioGraphNodesFromBoard } from "../../modules/planning/lib/planningGraphNodes"
import { HeaderMain } from "../../shared/ui/Header/HeaderMain"
import { SidebarMain } from "../../shared/ui/Sidebar/SidebarMain"
import { SecondarySidebar } from "../../shared/ui/SecondarySidebar/SecondarySidebar"
import AIAssistantWidget from "../../modules/ai/ui/AIAssistantWidget"
import { ThinkingDrawerShell } from "./components/ThinkingDrawerShell"
import { useLegacyHashNavigation } from "./hooks/useLegacyHashNavigation"
import { useThinkingDrawerController } from "./hooks/useThinkingDrawerController"
import { useBpmCommandBridge } from "./hooks/useBpmCommandBridge"
import { useStand } from "../stands/standContext"
import { standHref } from "../stands/standPathUtils"

export const AppLayout = () => {
	const { routePrefix } = useStand()
	const location = useLocation()
	const navigate = useNavigate()
	const {
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
		brainPanelOpenKey,
		setBrainPanelOpenKey,
		selectedDecisionPathId,
		setSelectedDecisionPathId,
		appliedDecisionPathId,
		setAppliedDecisionPathId,
	} = useThinkingStore()

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
		setScenarioComparisonRevision,
		flowCode,
		setFlowCode,
		openConfiguratorFromPlanning,
		setOpenConfiguratorFromPlanning,
		setConfiguratorInitialNodes,
		setConfiguratorInitialEdges,
		setHypercubeCaseIntro,
		setConfiguratorNodeCommand,
		setServicePageName,
	} = useAppStore()

	const setResultsDashboardFocus = useResultsStore((s) => s.setResultsDashboardFocus)
	const setAdminSubTab = useAdminStore((s) => s.setAdminSubTab)

	useLegacyHashNavigation({
		location,
		navigate,
		setCdPageNode,
		setShowBpm,
		setBpmHighlight,
		setServicePageName,
		setAdminSubTab,
	})

	const {
		requestUserConfirm,
		handleThinkingConfirm,
		handleRecalculateDecision,
		addThinkingStep,
		resetThinkingChain,
		thinkingChainRevealedRef,
	} = useThinkingDrawerController({
		thinkingPanelOpen,
		setThinkingPanelOpen,
		setThinkingSteps,
		setThinkingCurrentMessage,
		setThinkingPaused,
		setThinkingAwaitingConfirm,
		thinkingConfirmPhase,
		setThinkingConfirmPhase,
		setScenarioComparisonRevision,
		setAppliedDecisionPathId,
		selectedDecisionPathId,
		setBrainPanelOpenKey,
		setBpmCommand,
	})

	const { onBpmCommandConsumed, bpmCommandConsumedRef } = useBpmCommandBridge({
		flowCode,
		setFlowCode,
		setBpmCommand,
		setConfiguratorInitialNodes,
		setConfiguratorInitialEdges,
		setOpenConfiguratorFromPlanning,
		setShowBpm,
		navigate,
		requestUserConfirm,
	})

	const graphNodesForThinking = useMemo(() => {
		if (bpmStages?.length && bpmTasks) {
			const fromBoard = getScenarioGraphNodesFromBoard(bpmStages, bpmTasks)
			if (fromBoard.length) return fromBoard
		}
		return thinkingGraphNodes
	}, [bpmStages, bpmTasks, thinkingGraphNodes])

	const setActiveTab = useCallback(
		(tab) => {
			if (tab === "face") navigate(standHref(routePrefix, "face"))
			else if (tab === "scenarios") navigate(standHref(routePrefix, "scenarios"))
			else if (tab === "planning") navigate(standHref(routePrefix, "planning"))
			else if (tab === "ontology") navigate(standHref(routePrefix, "ontology"))
			else if (tab === "results") navigate(standHref(routePrefix, "results"))
			else if (tab === "admin") navigate(standHref(routePrefix, "admin"))
		},
		[navigate, routePrefix],
	)

	const path = (location.pathname || "").replace(/\/$/, "") || "/"
	const isThinkingDrawerCollapsed =
		path.endsWith("/planning") || path.endsWith("/ontology")
	const showCollapsedBrainMinimal =
		isThinkingDrawerCollapsed && thinkingConfirmPhase === "brain"

	useEffect(() => {
		if (!openConfiguratorFromPlanning) return
		setOpenConfiguratorFromPlanning(false)
	}, [openConfiguratorFromPlanning, setOpenConfiguratorFromPlanning])

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
			<ThinkingDrawerShell
				thinkingPanelOpen={thinkingPanelOpen}
				setThinkingPanelOpen={setThinkingPanelOpen}
				setThinkingCurrentMessage={setThinkingCurrentMessage}
				isThinkingDrawerCollapsed={isThinkingDrawerCollapsed}
				showCollapsedBrainMinimal={showCollapsedBrainMinimal}
				handleThinkingConfirm={handleThinkingConfirm}
				thinkingSteps={thinkingSteps}
				thinkingCurrentMessage={thinkingCurrentMessage}
				thinkingPaused={thinkingPaused}
				setThinkingPaused={setThinkingPaused}
				thinkingAwaitingConfirm={thinkingAwaitingConfirm}
				thinkingConfirmPhase={thinkingConfirmPhase}
				brainPanelOpenKey={brainPanelOpenKey}
				graphNodesForThinking={graphNodesForThinking}
				thinkingChainRevealedRef={thinkingChainRevealedRef}
				selectedDecisionPathId={selectedDecisionPathId}
				appliedDecisionPathId={appliedDecisionPathId}
				setSelectedDecisionPathId={setSelectedDecisionPathId}
				handleRecalculateDecision={handleRecalculateDecision}
			/>
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
