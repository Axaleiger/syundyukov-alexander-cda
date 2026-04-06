import React from "react"
import Routes from "./providers/RouterProvider"
import { DataRepositoriesProvider } from "./providers/DataRepositoriesProvider"

export default function App() {
	return (
		<DataRepositoriesProvider>
			<Routes />
		</DataRepositoriesProvider>
	)
}
