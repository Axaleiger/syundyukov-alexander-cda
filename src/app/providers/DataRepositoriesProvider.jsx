import React, { createContext, useContext, useMemo } from "react"
import { getRepositories } from "../../core/data/repositories/registry.js"

const RepositoriesContext = createContext(null)

/**
 * Корень привязки репозиториев для React-дерева.
 * По умолчанию — тот же объект, что и `getRepositories()` из registry.
 * Позже: передать `value` с Google Sheets / DB реализациями.
 */
export function DataRepositoriesProvider({ children, value }) {
	const repos = useMemo(() => value ?? getRepositories(), [value])
	return (
		<RepositoriesContext.Provider value={repos}>
			{children}
		</RepositoriesContext.Provider>
	)
}

/** @returns {import('../../core/data/repositories/contracts/repositoryContracts.js').AppRepositories} */
export function useRepositories() {
	const ctx = useContext(RepositoriesContext)
	if (!ctx) {
		throw new Error("useRepositories: оберните приложение в DataRepositoriesProvider")
	}
	return ctx
}
