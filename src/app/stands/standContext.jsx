import React, { createContext, useContext, useMemo } from "react"

const StandContext = createContext(null)

export function StandProvider({ standId, routePrefix, children }) {
	const value = useMemo(
		() => ({
			standId,
			routePrefix,
		}),
		[standId, routePrefix],
	)
	return (
		<StandContext.Provider value={value}>{children}</StandContext.Provider>
	)
}

export function useStand() {
	const ctx = useContext(StandContext)
	if (!ctx) {
		throw new Error("useStand must be used within a stand shell (StandProvider)")
	}
	return ctx
}
