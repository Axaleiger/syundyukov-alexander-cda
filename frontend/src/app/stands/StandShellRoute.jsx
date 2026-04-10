import React from "react"
import { StandProvider } from "./standContext"

export function StandShellRoute({ stand }) {
	const Shell = stand.Shell
	return (
		<StandProvider standId={stand.standId} routePrefix={stand.routePrefix}>
			<Shell />
		</StandProvider>
	)
}
