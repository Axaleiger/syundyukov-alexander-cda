import React, { Suspense, useEffect, useCallback, useMemo, useState } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import styles from "./AppLayout.module.css"
import { useAppStore } from "../../core/store/appStore"
import { useResultsStore } from "../../modules/results/model/resultsStore"
import { useAdminStore } from "../../modules/admin/model/adminStore"
import { useThinkingStore } from "../../modules/thinking/model/thinkingStore"
import CDPage from "../../modules/cd/ui/CDPage"
import BPMBoard from "../../modules/planning/ui/BPMBoard"
import { getScenarioGraphNodesFromBoard } from "../../modules/planning/lib/planningGraphNodes"
import { HeaderMain } from "../../shared/ui/Header/HeaderMain"
import { SidebarMain } from "../../shared/ui/Sidebar/SidebarMain"
import { SecondarySidebar } from "../../shared/ui/SecondarySidebar/SecondarySidebar"
import { ExpoIdleResetGuard } from "../../shared/ui/expo/ExpoIdleResetGuard"
import AIAssistantWidget from "../../modules/ai/ui/AIAssistantWidget"
import { ThinkingDrawerShell } from "./components/ThinkingDrawerShell"
import { useLegacyHashNavigation } from "./hooks/useLegacyHashNavigation"
import { useThinkingDrawerController } from "./hooks/useThinkingDrawerController"
import { useBpmCommandBridge } from "./hooks/useBpmCommandBridge"
import { useStand } from "../stands/standContext"
import { standHref } from "../stands/standPathUtils"

function getDisabledTabsFromEnv() {
	const raw = (import.meta.env.VITE_EXPO_DISABLE_TABS || "").trim()
	if (!raw) return new Set()
	return new Set(
		raw
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean),
	)
}

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
		setSelectedAssetId,
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
		setAiAssistantPreset,
	} = useAppStore()

	const [aiAssistantCloseSignal, setAiAssistantCloseSignal] = useState(0)
	const [thinkingConfirmCounter, setThinkingConfirmCounter] = useState(0)

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

	const navigateToPlanningAfterAi = useCallback(
		({ preset }) => {
			if (!preset) return
			setAiAssistantPreset(preset)
			setBpmCommand({ scenarioId: "loadAiPresetBoard", params: { preset } })
			const href = standHref(routePrefix, "planning")
			navigate(
				`${href}?aiFromThinking=1&preset=${encodeURIComponent(preset)}`,
			)
			setAiAssistantCloseSignal((n) => n + 1)
		},
		[navigate, routePrefix, setBpmCommand, setAiAssistantPreset],
	)

	const handleThinkingConfirmWithCounter = useCallback(() => {
		handleThinkingConfirm()
		setThinkingConfirmCounter((c) => c + 1)
	}, [handleThinkingConfirm])

	const path = (location.pathname || "").replace(/\/$/, "") || "/"
	const isThinkingDrawerCollapsed =
		path.endsWith("/planning") || path.endsWith("/ontology")
	const showCollapsedBrainMinimal =
		isThinkingDrawerCollapsed && thinkingConfirmPhase === "brain"

	useEffect(() => {
		if (!openConfiguratorFromPlanning) return
		setOpenConfiguratorFromPlanning(false)
	}, [openConfiguratorFromPlanning, setOpenConfiguratorFromPlanning])

	// Expo stand safety: forbid direct access to disabled sections via URL.
	useEffect(() => {
		const disabled = getDisabledTabsFromEnv()
		if (!disabled.size) return
		const raw = (location.pathname || "").replace(/\/$/, "")
		const segment = raw.split("/").filter(Boolean)[0] || "face"
		if (!disabled.has(segment)) return
		navigate(standHref(routePrefix, "planning"), { replace: true })
	}, [location.pathname, navigate, routePrefix])

	const aiAssistantAndThinkingDrawer = (
		<>
			<AIAssistantWidget
				appearance="classic"
				visible={aiMode}
				selectedAssetId={selectedAssetId}
				setSelectedAssetId={setSelectedAssetId}
				assistantCloseSignal={aiAssistantCloseSignal}
				navigateToPlanningAfterAi={navigateToPlanningAfterAi}
				thinkingConfirmCounter={thinkingConfirmCounter}
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
				handleThinkingConfirm={handleThinkingConfirmWithCounter}
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
			<ExpoIdleResetGuard routePrefix={routePrefix} />
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
