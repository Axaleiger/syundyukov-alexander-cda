import React, { Suspense, useCallback, useEffect, useMemo } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import styles from "./AppLayout.module.css"
import "./demoStandShell.css"
import { useAppStore } from "../../core/store/appStore"
import { useResultsStore } from "../../modules/results/model/resultsStore"
import { useAdminStore } from "../../modules/admin/model/adminStore"
import { useThinkingStore } from "../../modules/thinking/model/thinkingStore"
import CDPage from "../../modules/cd/ui/CDPage"
import BPMBoard from "../../modules/planning/ui/BPMBoard"
import { getScenarioGraphNodesFromBoard } from "../../modules/planning/lib/planningGraphNodes"
import { DemoHeader } from "./demo/DemoHeader"
import { DemoSidebar } from "./demo/DemoSidebar"
import { DemoSecondarySidebar } from "./demo/DemoSecondarySidebar"
import AIAssistantWidget from "../../modules/ai/ui/AIAssistantWidget"
import { ThinkingDrawerShell } from "./components/ThinkingDrawerShell"
import { useThinkingDrawerController } from "./hooks/useThinkingDrawerController"
import { useBpmCommandBridge } from "./hooks/useBpmCommandBridge"
import { getAppRouteSegment } from "../../shared/lib/appRouteSegment"
import { OPTIMAL_SCENARIO_VARIANT } from "../../modules/thinking/lib/scenarioGraphData"
import { useStand } from "../stands/standContext"
import { standHref } from "../stands/standPathUtils"
import DemoStandRightPanel from "../../demo-stand/components/RightPanel.jsx"
import RussiaGlobe from "../../demo-stand/components/RussiaGlobe.jsx"
import { demoFaceMapAssetSelect } from "../../modules/face/lib/demoFaceMapAssetSelect.js"

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

/**
 * Shell демо-стенда: классы документа, модификаторы стенда, Outlet.
 * Префикс маршрута задаётся stand definition + StandProvider.
 */
export default function DemoLayout() {
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
		scenarioComparisonRevision,
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

	const onAfterThinkingConfirm = useCallback(({ phase }) => {
		if (phase !== "brain") return
		const {
			selectedAssetId: assetId,
			faceSelectedScenarioTitle,
			setAgreedInfluenceLine,
			setScenarioComparisonRevision,
		} = useAppStore.getState()
		if (!assetId) return
		const title =
			faceSelectedScenarioTitle || `Вариант ${OPTIMAL_SCENARIO_VARIANT}`
		setAgreedInfluenceLine(`Влияние предложенного «${title}» на актив`)
		setScenarioComparisonRevision((n) => n + 1)
	}, [])

	useEffect(() => {
		document.documentElement.classList.add("demo-stand-4k-root")
		document.body.classList.add("body-demo", "demo-stand-4k")
		return () => {
			document.documentElement.classList.remove("demo-stand-4k-root")
			document.body.classList.remove("body-demo", "demo-stand-4k")
		}
	}, [])

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
		onAfterThinkingConfirm,
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

	const isDemoFace =
		(location.pathname.startsWith(`${routePrefix}/`) ||
			location.pathname === routePrefix) &&
		getAppRouteSegment(location.pathname) === "face"

	useEffect(() => {
		if (!openConfiguratorFromPlanning) return
		setOpenConfiguratorFromPlanning(false)
	}, [openConfiguratorFromPlanning, setOpenConfiguratorFromPlanning])

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
				faceHologram={isDemoFace}
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
		<div
			data-demo-stand-shell="true"
			className={`app app-with-sidebar ${styles.app} ${styles["app-with-sidebar"]} app--demo app--demo-stand-4k ${isDemoFace ? "app--demo-stand-face" : ""}`}
		>
			{isDemoFace ? (
				<div className="app-demo-globe-fixed">
					<div className="app-demo-globe-transform">
						<RussiaGlobe
							immersiveBackground
							demoLarge
							standLayout
							onAssetSelect={demoFaceMapAssetSelect}
						/>
					</div>
				</div>
			) : null}
			<DemoHeader isFaceRoute={isDemoFace} />

			<div
				className={`app-body ${styles["app-body"]} demo-shell-body ${isDemoFace ? "app-body--immersive-face" : ""}`}
			>
				<DemoSidebar />
				<DemoSecondarySidebar />
				<main
					className={`app-main ${styles["app-main"]} app-main--demo ${isDemoFace ? "app-main--demo-immersive" : ""}`}
				>
					<Outlet context={{ onBpmCommandConsumed }} />
				</main>
				{isDemoFace && selectedAssetId ? (
					<aside className="app-right-panel app-right-panel--demo-float">
						<DemoStandRightPanel
							assetId={selectedAssetId}
							scenarioComparisonRevision={scenarioComparisonRevision}
						/>
					</aside>
				) : null}
			</div>
			{aiAssistantAndThinkingDrawer}
		</div>
	)
}
