import { Suspense, useCallback, useMemo } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"

import appLayoutStyles from "../../app/layouts/AppLayout.module.css"
import BPMBoard from "../../modules/planning/ui/BPMBoard"
import { getBoardIdForAsset } from "../../modules/planning/lib/planningHelpers"
import { useAppStore } from "../../core/store/appStore"
import { bpmToMermaid } from "../../modules/planning/lib/bpmToMermaid"
import mapPointsData from "../../core/data/static/mapPoints.json"

export function PlanningPage() {
	const navigate = useNavigate()
	const { onBpmCommandConsumed } = useOutletContext() || {}

	const {
		selectedScenarioName,
		setSelectedScenarioName,
		selectedAssetId,
		bpmHighlight,
		bpmStages,
		bpmTasks,
		bpmCommand,
		setBpmBoard,
		aiMode,
		setAiMode,
		setFlowCode,
		servicePageName,
		setServicePageName,
	} = useAppStore()

	const selectedAssetPoint = useMemo(
		() => (selectedAssetId ? mapPointsData.find((p) => p.id === selectedAssetId) : null),
		[selectedAssetId],
	)

	const handleBoardChange = useCallback(
		(stages, tasks) => {
			setBpmBoard(stages, tasks)
			setFlowCode(bpmToMermaid(stages, tasks))
		},
		[setBpmBoard, setFlowCode],
	)

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
						<span className={appLayoutStyles["service-page-back-arrow"]} aria-hidden />
						Назад
					</button>

					<h1 className={appLayoutStyles["service-page-title"]}>{servicePageName}</h1>
				</div>
			</div>
		)
	}

	return (
		<div
			className={`${appLayoutStyles["app-content"]} ${appLayoutStyles["app-content-bpm"]}`}
		>
			<Suspense
				fallback={
					<div className={appLayoutStyles["bpm-loading"]}>Загрузка...</div>
				}
			>
				<BPMBoard
					scenarioName={selectedScenarioName}
					initialBoardId={
						selectedScenarioName &&
						selectedScenarioName.includes(
							"Управление добычей с учетом ближайшего бурения",
						)
							? "do-burenie"
							: selectedScenarioName &&
									selectedScenarioName.includes("Проактивное управление ремонтами")
								? "hantos"
								: selectedAssetId
									? getBoardIdForAsset(selectedAssetId)
									: "hantos"
					}
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
					selectedAssetName={selectedAssetPoint?.name}
					highlightCardName={bpmHighlight}
					onClose={() => navigate("/scenarios")}
					onBoardChange={handleBoardChange}
					aiMode={aiMode}
					setAiMode={setAiMode}
					onOpenPlanningWithScenario={(name) => {
						setSelectedScenarioName(
							name || "Проактивное управление ремонтами и приоритетами",
						)
						navigate("/planning")
					}}
					bpmCommand={bpmCommand}
					onBpmCommandConsumed={onBpmCommandConsumed}
				/>
			</Suspense>
		</div>
	)
}

export default PlanningPage
