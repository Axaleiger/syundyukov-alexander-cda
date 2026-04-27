import { create } from "zustand"
import { persist } from "zustand/middleware"
import { DEFAULT_FLOW_CODE } from "../../modules/ontology/lib/ontologyBootstrap.js"
import { SCENARIO_STAGE_FILTERS } from "../data/static/scenariosData.js"

const DEFAULT_SCENARIO_NAME = "Управление добычей с учетом ближайшего бурения"
const DEFAULT_SCENARIO_FILTERS = SCENARIO_STAGE_FILTERS.reduce(
	(acc, name) => ({ ...acc, [name]: true }),
	{},
)

const persistStorageName =
	import.meta.env.VITE_STAND_SCOPE === "newDemo"
		? "cda-app-store-new-demo"
		: import.meta.env.VITE_STAND_SCOPE === "main"
			? "cda-app-store-main"
			: "cda-app-store"

export const useAppStore = create(
	persist(
		(set) => ({
	// UI
	aiMode: false,
	setAiMode: (v) => set({ aiMode: v }),

	// asset
	selectedAssetId: null,
	setSelectedAssetId: (id) => set({ selectedAssetId: id }),

	/** Выбранный заголовок сценария на демо-face (dock); main /face не использует */
	faceSelectedScenarioTitle: null,
	setFaceSelectedScenarioTitle: (v) => set({ faceSelectedScenarioTitle: v }),

	/** Строка «влияние» на демо-face после подтверждения thinking brain */
	agreedInfluenceLine: null,
	setAgreedInfluenceLine: (v) => set({ agreedInfluenceLine: v }),

	/** Пресет доски ИИ (base_drilling | fcf_no_drill | opex_reduction) после перехода на планирование */
	aiAssistantPreset: null,
	setAiAssistantPreset: (v) => set({ aiAssistantPreset: v }),

	/**
	 * Согласованный на главной пресет доски ИИ — снова показывается на /planning без URL (до сброса сессии).
	 * @type {string | null}
	 */
	agreedAiPlanningBoardPreset: null,
	setAgreedAiPlanningBoardPreset: (v) => set({ agreedAiPlanningBoardPreset: v }),

	/**
	 * Активный пресет потока «лицо → мышление» (для панели сценария и графа до закрытия drawer).
	 * @type {string | null}
	 */
	aiFaceBrainPreset: null,
	setAiFaceBrainPreset: (v) => set({ aiFaceBrainPreset: v }),

	/**
	 * Дельты метрик для «консенсусного» сценария после согласования плана ИИ (panels.md).
	 * @type {Record<string, { amount: number, favorable: boolean }> | null}
	 */
	aiScenarioMetricDeltaOverride: null,
	setAiScenarioMetricDeltaOverride: (v) => set({ aiScenarioMetricDeltaOverride: v }),

	/** Сброс контекста главной (карта/ИИ), без отмены согласованного пресета планирования — он сбрасывается в resetExpoPreset. */
	resetDemoFaceScenarioWorkflow: () =>
		set({
			faceSelectedScenarioTitle: null,
			agreedInfluenceLine: null,
			aiAssistantPreset: null,
			aiFaceBrainPreset: null,
			aiScenarioMetricDeltaOverride: null,
		}),

	cdPageNode: null,
	setCdPageNode: (v) => set({ cdPageNode: v }),

	// scenarios
	scenarioComparisonRevision: 0,
	setScenarioComparisonRevision: (v) =>
		set((s) => ({
			scenarioComparisonRevision:
				typeof v === "function" ? v(s.scenarioComparisonRevision) : v,
		})),
	incScenarioComparison: () =>
		set((s) => ({
			scenarioComparisonRevision: s.scenarioComparisonRevision + 1,
		})),

	// face / AI
	hypercubeCaseIntro: false,
	setHypercubeCaseIntro: (v) => set({ hypercubeCaseIntro: v }),

	// ontology / AI
	configuratorNodeCommand: null,
	setConfiguratorNodeCommand: (v) => set({ configuratorNodeCommand: v }),

	// scenarios
	scenarioStageFilters: DEFAULT_SCENARIO_FILTERS,

	setScenarioStageFilters: (fn) =>
		set((state) => ({
			scenarioStageFilters:
				typeof fn === "function" ? fn(state.scenarioStageFilters) : fn,
		})),

	/** После загрузки этапов с API: добавить отсутствующие ключи в фильтр (по умолчанию true). */
	mergeScenarioStageFilterKeys: (names) =>
		set((state) => {
			const next = { ...state.scenarioStageFilters }
			for (const name of names) {
				if (next[name] === undefined) next[name] = true
			}
			return { scenarioStageFilters: next }
		}),

	scenariosStageFilter: null,
	setScenariosStageFilter: (v) => set({ scenariosStageFilter: v }),

	// ---------- PLANNING ----------

	// service page
	servicePageName: null,
	setServicePageName: (v) => set({ servicePageName: v }),

	// scenario
	selectedScenarioName: DEFAULT_SCENARIO_NAME,
	setSelectedScenarioName: (v) => set({ selectedScenarioName: v }),

	/** UUID сценария из API (для выбора кейса планирования) */
	selectedScenarioId: null,
	setSelectedScenarioId: (v) => set({ selectedScenarioId: v }),

	/** UUID кейса планирования (для сохранения доски) */
	planningCaseId: null,
	setPlanningCaseId: (v) => set({ planningCaseId: v }),

	// BPM
	bpmCommand: null,
	setBpmCommand: (v) => set({ bpmCommand: v }),

	bpmHighlight: null,
	setBpmHighlight: (v) => set({ bpmHighlight: v }),

	showBpm: false,
	setShowBpm: (v) => set({ showBpm: v }),

	bpmStages: null,
	bpmTasks: null,
	/** Связи карточек при загрузке с API; правки только в BPMBoard до появления сохранения */
	bpmConnections: null,
	setBpmBoard: (stages, tasks, connections) =>
		set((state) => {
			const sameStages = state.bpmStages === stages
			const sameTasks = state.bpmTasks === tasks
			const sameConn =
				connections === undefined || state.bpmConnections === connections
			if (sameStages && sameTasks && sameConn) {
				return state
			}

			return {
				bpmStages: stages,
				bpmTasks: tasks,
				...(connections !== undefined ? { bpmConnections: connections } : {}),
			}
		}),

	flowCode: DEFAULT_FLOW_CODE,
	setFlowCode: (v) => set({ flowCode: v }),

	openConfiguratorFromPlanning: false,
	setOpenConfiguratorFromPlanning: (v) =>
		set({ openConfiguratorFromPlanning: v }),

	configuratorInitialNodes: null,
	configuratorInitialEdges: null,
	setConfiguratorInitialNodes: (v) => set({ configuratorInitialNodes: v }),
	setConfiguratorInitialEdges: (v) => set({ configuratorInitialEdges: v }),

	showConfiguratorDoc: false,
	setShowConfiguratorDoc: (v) => set({ showConfiguratorDoc: v }),

	/** Expo reset preset: вернуть интерфейс в исходное состояние. */
	resetExpoPreset: () =>
		set({
			aiMode: false,
			selectedAssetId: null,
			faceSelectedScenarioTitle: null,
			agreedInfluenceLine: null,
			aiAssistantPreset: null,
			agreedAiPlanningBoardPreset: null,
			aiFaceBrainPreset: null,
			aiScenarioMetricDeltaOverride: null,
			cdPageNode: null,
			scenarioComparisonRevision: 0,
			hypercubeCaseIntro: false,
			configuratorNodeCommand: null,
			scenarioStageFilters: DEFAULT_SCENARIO_FILTERS,
			scenariosStageFilter: null,
			servicePageName: null,
			selectedScenarioName: DEFAULT_SCENARIO_NAME,
			selectedScenarioId: null,
			planningCaseId: null,
			bpmCommand: null,
			bpmHighlight: null,
			showBpm: false,
			bpmStages: null,
			bpmTasks: null,
			bpmConnections: null,
			flowCode: DEFAULT_FLOW_CODE,
			openConfiguratorFromPlanning: false,
			configuratorInitialNodes: null,
			configuratorInitialEdges: null,
			showConfiguratorDoc: false,
		}),
		}),
		{
			name: persistStorageName,
			version: 1,
			partialize: (s) => ({
				selectedScenarioId: s.selectedScenarioId,
				selectedScenarioName: s.selectedScenarioName,
				agreedAiPlanningBoardPreset: s.agreedAiPlanningBoardPreset,
			}),
		},
	),
)
