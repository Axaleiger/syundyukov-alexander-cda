import { create } from "zustand"
import { DEFAULT_FLOW_CODE } from "../../modules/ontology/lib/ontologyBootstrap"
import { SCENARIO_STAGE_FILTERS } from "../../shared/data/scenariosData"

export const useAppStore = create((set) => ({
	// UI
	aiMode: false,
	setAiMode: (v) => set({ aiMode: v }),

	// asset
	selectedAssetId: null,
	setSelectedAssetId: (id) => set({ selectedAssetId: id }),

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

	// thinking
	thinkingPanelOpen: false,
	setThinkingPanelOpen: (v) => set({ thinkingPanelOpen: v }),

	thinkingSteps: [],
	setThinkingSteps: (v) =>
		set((state) => ({
			thinkingSteps: typeof v === "function" ? v(state.thinkingSteps) : v,
		})),

	thinkingCurrentMessage: "",
	setThinkingCurrentMessage: (v) => set({ thinkingCurrentMessage: v }),

	thinkingPaused: false,
	setThinkingPaused: (v) => set({ thinkingPaused: v }),

	thinkingConfirmPhase: null,
	setThinkingConfirmPhase: (v) => set({ thinkingConfirmPhase: v }),

	thinkingAwaitingConfirm: false,
	setThinkingAwaitingConfirm: (v) => set({ thinkingAwaitingConfirm: v }),

	thinkingGraphNodes: [],
	setThinkingGraphNodes: (v) =>
		set((state) => ({
			thinkingGraphNodes:
				typeof v === "function" ? v(state.thinkingGraphNodes) : v,
		})),

	resetThinkingChain: () => set({ thinkingGraphNodes: [] }),

	brainPanelOpenKey: 0,
	setBrainPanelOpenKey: (v) =>
		set((state) => ({
			brainPanelOpenKey:
				typeof v === "function" ? v(state.brainPanelOpenKey) : v,
		})),

	selectedDecisionPathId: null,
	setSelectedDecisionPathId: (v) => set({ selectedDecisionPathId: v }),

	appliedDecisionPathId: null,
	setAppliedDecisionPathId: (v) => set({ appliedDecisionPathId: v }),

	// results
	resultsDashboardFocus: null,
	setResultsDashboardFocus: (v) => set({ resultsDashboardFocus: v }),

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

	scenariosStageFilter: null,
	setScenariosStageFilter: (v) => set({ scenariosStageFilter: v }),

	// admin
	adminSubTab: "roles",
	setAdminSubTab: (v) => set({ adminSubTab: v }),

	// ---------- PLANNING ----------

	// service page
	servicePageName: null,
	setServicePageName: (v) => set({ servicePageName: v }),

	// scenario
	selectedScenarioName: "Управление добычей с учетом ближайшего бурения",
	setSelectedScenarioName: (v) => set({ selectedScenarioName: v }),

	// BPM
	bpmCommand: null,
	setBpmCommand: (v) => set({ bpmCommand: v }),

	bpmHighlight: null,
	setBpmHighlight: (v) => set({ bpmHighlight: v }),

	showBpm: false,
	setShowBpm: (v) => set({ showBpm: v }),

	bpmStages: null,
	bpmTasks: null,
	setBpmBoard: (stages, tasks) =>
		set((state) => {
			if (state.bpmStages === stages && state.bpmTasks === tasks) {
				return state // 🚫 не обновляем
			}

			return {
				bpmStages: stages,
				bpmTasks: tasks,
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
