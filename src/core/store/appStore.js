import { create } from "zustand"
import { SCENARIO_STAGE_FILTERS } from "../../shared/data/scenariosData"

export const useAppStore = create((set) => ({
	// UI
	aiMode: false,
	setAiMode: (v) => set({ aiMode: v }),

	// asset
	selectedAssetId: null,
	setSelectedAssetId: (id) => set({ selectedAssetId: id }),

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
	setThinkingSteps: (v) => set({ thinkingSteps: v }),

	thinkingCurrentMessage: "",
	setThinkingCurrentMessage: (v) => set({ thinkingCurrentMessage: v }),

	thinkingPaused: false,
	setThinkingPaused: (v) => set({ thinkingPaused: v }),

	thinkingConfirmPhase: null,
	setThinkingConfirmPhase: (v) => set({ thinkingConfirmPhase: v }),

	thinkingAwaitingConfirm: false,
	setThinkingAwaitingConfirm: (v) => set({ thinkingAwaitingConfirm: v }),

	// results
	resultsDashboardFocus: null,
	setResultsDashboardFocus: (v) => set({ resultsDashboardFocus: v }),

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
}))
