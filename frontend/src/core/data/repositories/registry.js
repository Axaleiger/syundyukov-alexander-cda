import { createStaticRepositories } from "./createStaticRepositories.js"
import { createHttpRepositories } from "./http/createHttpRepositories.js"

const useStaticRepos = import.meta.env.VITE_USE_STATIC_REPOS === "1"

/** @type {import('./contracts/repositoryContracts.js').AppRepositories} */
let active = useStaticRepos
	? createStaticRepositories()
	: createHttpRepositories()

/**
 * Активный набор репозиториев (composition root по умолчанию).
 * Для смены источника: `setRepositories(...)` при старте или в тестах.
 */
export function getRepositories() {
	return active
}

/**
 * @param {import('./contracts/repositoryContracts.js').AppRepositories} next
 */
export function setRepositories(next) {
	active = next
}
