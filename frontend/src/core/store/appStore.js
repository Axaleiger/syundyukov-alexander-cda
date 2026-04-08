import { create } from "zustand"
import { DEFAULT_FLOW_CODE } from "../../modules/ontology/lib/ontologyBootstrap.js"
import { SCENARIO_STAGE_FILTERS } from "../data/static/scenariosData.js"

export const useAppStore = create((set) => ({
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

	resetDemoFaceScenarioWorkflow: () =>
		set({
			faceSelectedScenarioTitle: null,
			agreedInfluenceLine: null,
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
	scenarioStageFilters: SCENARIO_STAGE_FILTERS.reduce(
		(acc, name) => ({ ...acc, [name]: true }),
		{},
	),

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
	selectedScenarioName: "Управление добычей с учетом ближайшего бурения",
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
}))
