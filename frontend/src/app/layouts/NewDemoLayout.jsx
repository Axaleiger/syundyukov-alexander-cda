import { useCallback, useMemo, useState } from "react"
import { Outlet, useNavigate } from "react-router-dom"
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
import { useStand } from "../stands/standContext"
import { standHref } from "../stands/standPathUtils"

export default function NewDemoLayout() {
	const [thinkingConfirmCounter, setThinkingConfirmCounter] = useState(0)
	const navigate = useNavigate()
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
		setBpmCommand,
		setScenarioComparisonRevision,
		setConfiguratorInitialNodes,
		setConfiguratorInitialEdges,
		setOpenConfiguratorFromPlanning,
		setShowBpm,
		setHypercubeCaseIntro,
		setConfiguratorNodeCommand,
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

	const { bpmCommandConsumedRef } = useBpmCommandBridge({
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

	const handleThinkingConfirmForNewDemo = useCallback(() => {
		handleThinkingConfirm()
		setThinkingConfirmCounter((v) => v + 1)
	}, [handleThinkingConfirm])

	return (
		<div className={styles.shell} data-new-demo-shell="true">
			<NewDemoHeader />
			<div className={styles.body}>
				<NewDemoSidebar />
				<main className={styles.main}>
					<div className={styles.mainInner}>
						<Outlet />
					</div>
				</main>
			</div>
			<NewDemoAIAssistantWidget
				visible
				setActiveTab={setActiveTab}
				setBpmCommand={setBpmCommand}
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
