import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import styles from "./NewDemoLayout.module.css"
import { NewDemoHeader } from "./new-demo/NewDemoHeader"
import { NewDemoSidebar } from "./new-demo/NewDemoSidebar"
import NewDemoAIAssistantWidget from "../../modules/face/ui/new-demo/assistant/NewDemoAIAssistantWidget"
import { useAppStore } from "../../core/store/appStore"
import { useResultsStore } from "../../modules/results/model/resultsStore"
import { useThinkingStore } from "../../modules/thinking/model/thinkingStore"
import { getScenarioGraphNodesFromBoard } from "../../modules/planning/lib/planningGraphNodes"
import { useThinkingDrawerController } from "./hooks/useThinkingDrawerController"
import { useBpmCommandBridge } from "./hooks/useBpmCommandBridge"
import { ThinkingDrawerShell } from "./components/ThinkingDrawerShell"
import { ExpoIdleResetGuard } from "../../shared/ui/expo/ExpoIdleResetGuard"
import { useStand } from "../stands/standContext"
import { standHref } from "../stands/standPathUtils"
import { getAppRouteSegment, getFirstEnabledStandTab } from "../../shared/lib/appRouteSegment"

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

export default function NewDemoLayout() {
	const [thinkingConfirmCounter, setThinkingConfirmCounter] = useState(0)
	const [aiAssistantCloseSignal, setAiAssistantCloseSignal] = useState(0)
	const navigate = useNavigate()
	const location = useLocation()
	const { routePrefix } = useStand()
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
		flowCode,
		setFlowCode,
		bpmStages,
		bpmTasks,
		setAiFaceBrainPreset,
		setBpmCommand,
		setScenarioComparisonRevision,
		setConfiguratorInitialNodes,
		setConfiguratorInitialEdges,
		setOpenConfiguratorFromPlanning,
		setShowBpm,
		setHypercubeCaseIntro,
		setConfiguratorNodeCommand,
		setAiAssistantPreset,
		selectedAssetId,
		setSelectedAssetId,
	} = useAppStore()

	const setResultsDashboardFocus = useResultsStore((s) => s.setResultsDashboardFocus)

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
		if (thinkingGraphNodes?.length) return thinkingGraphNodes
		if (bpmStages?.length && bpmTasks) {
			const fromBoard = getScenarioGraphNodesFromBoard(bpmStages, bpmTasks)
			if (fromBoard.length) return fromBoard
		}
		return thinkingGraphNodes
	}, [bpmStages, bpmTasks, thinkingGraphNodes])

	useEffect(() => {
		if (thinkingPanelOpen) return
		setAiFaceBrainPreset(null)
	}, [thinkingPanelOpen, setAiFaceBrainPreset])

	const setActiveTab = useCallback(
		(tab) => {
			const disabled = getDisabledTabsFromEnv()
			if (disabled.has(tab)) return
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
			const disabled = getDisabledTabsFromEnv()
			setAiAssistantPreset(preset)
			setBpmCommand({ scenarioId: "loadAiPresetBoard", params: { preset } })
			if (disabled.has("planning")) {
				navigate(standHref(routePrefix, getFirstEnabledStandTab(disabled)), { replace: true })
				setAiAssistantCloseSignal((n) => n + 1)
				return
			}
			const href = standHref(routePrefix, "planning")
			navigate(`${href}?aiFromThinking=1&preset=${encodeURIComponent(preset)}`)
			setAiAssistantCloseSignal((n) => n + 1)
		},
		[navigate, routePrefix, setBpmCommand, setAiAssistantPreset],
	)

	const handleThinkingConfirmForNewDemo = useCallback(() => {
		handleThinkingConfirm()
		setThinkingConfirmCounter((v) => v + 1)
	}, [handleThinkingConfirm])

	useEffect(() => {
		const disabled = getDisabledTabsFromEnv()
		if (!disabled.size) return
		const segment = getAppRouteSegment(location.pathname)
		if (!disabled.has(segment)) return
		navigate(standHref(routePrefix, getFirstEnabledStandTab(disabled)), { replace: true })
	}, [location.pathname, navigate, routePrefix])

	return (
		<div className={styles.shell} data-new-demo-shell="true">
			<ExpoIdleResetGuard routePrefix={routePrefix} />
			<NewDemoHeader />
			<div className={styles.body}>
				<NewDemoSidebar />
				<main className={styles.main}>
					<div className={styles.mainInner}>
						<Outlet context={{ onBpmCommandConsumed }} />
					</div>
				</main>
			</div>
			<NewDemoAIAssistantWidget
				visible
				selectedAssetId={selectedAssetId}
				setSelectedAssetId={setSelectedAssetId}
				assistantCloseSignal={aiAssistantCloseSignal}
				setActiveTab={setActiveTab}
				setBpmCommand={setBpmCommand}
				navigateToPlanningAfterAi={navigateToPlanningAfterAi}
				setResultsDashboardFocus={setResultsDashboardFocus}
				setHypercubeCaseIntro={setHypercubeCaseIntro}
				setConfiguratorNodeCommand={setConfiguratorNodeCommand}
				setShowBpm={setShowBpm}
				onThinkingPanelOpen={setThinkingPanelOpen}
				isThinkingPanelOpen={thinkingPanelOpen}
				thinkingConfirmCounter={thinkingConfirmCounter}
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
				isThinkingDrawerCollapsed={false}
				showCollapsedBrainMinimal={false}
				handleThinkingConfirm={handleThinkingConfirmForNewDemo}
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
				isNewDemo
			/>
		</div>
	)
}
