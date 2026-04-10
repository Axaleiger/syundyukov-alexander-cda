import { create } from "zustand"

/**
 * Фокус дашборда «Результаты» (метрика + пояснение), в т.ч. из AI-сценариев.
 */
export const useResultsStore = create((set) => ({
	resultsDashboardFocus: null,
	setResultsDashboardFocus: (v) => set({ resultsDashboardFocus: v }),
	resetExpoPreset: () => set({ resultsDashboardFocus: null }),
}))
