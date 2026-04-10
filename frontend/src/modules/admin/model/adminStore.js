import { create } from "zustand"

/** Подвкладка экрана Admin (боковая навигация). */
export const useAdminStore = create((set) => ({
	adminSubTab: "roles",
	setAdminSubTab: (v) => set({ adminSubTab: v }),
	resetExpoPreset: () => set({ adminSubTab: "roles" }),
}))
