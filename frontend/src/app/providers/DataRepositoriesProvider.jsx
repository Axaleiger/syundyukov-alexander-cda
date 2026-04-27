import React, { createContext, useContext, useMemo } from "react"
import { getRepositories } from "../../core/data/repositories/registry.js"

const RepositoriesContext = createContext(null)

let didWarnRepositoriesOutsideProvider = false

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
	if (ctx) return ctx
	if (import.meta.env.DEV && !didWarnRepositoriesOutsideProvider) {
		didWarnRepositoriesOutsideProvider = true
		// eslint-disable-next-line no-console -- диагностика: виджет вне провайдера (портал, отдельный root, ошибка маршрута)
		console.warn(
			"useRepositories: контекст DataRepositoriesProvider отсутствует, подставляется getRepositories()",
		)
	}
	return getRepositories()
}
