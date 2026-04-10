import React from "react"
import { createBrowserRouter } from "react-router-dom"
import { buildStandRouteBranches } from "../stands/standDefinitions"
import { StandShellRoute } from "../stands/StandShellRoute"

const basename = "/"

export const router = createBrowserRouter(
	buildStandRouteBranches().map(({ path, stand, children }) => ({
		path,
		element: <StandShellRoute stand={stand} />,
		children,
	})),
	{ basename },
)
