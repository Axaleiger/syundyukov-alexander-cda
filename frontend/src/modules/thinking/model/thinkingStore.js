import { create } from "zustand"

/**
 * Состояние панели «Режим мышления», графа и подтверждений (без BPM/planning bridge).
 */
export const useThinkingStore = create((set) => ({
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

	resetExpoPreset: () =>
		set({
			thinkingPanelOpen: false,
			thinkingSteps: [],
			thinkingCurrentMessage: "",
			thinkingPaused: false,
			thinkingConfirmPhase: null,
			thinkingAwaitingConfirm: false,
			thinkingGraphNodes: [],
			brainPanelOpenKey: 0,
			selectedDecisionPathId: null,
			appliedDecisionPathId: null,
		}),
}))
