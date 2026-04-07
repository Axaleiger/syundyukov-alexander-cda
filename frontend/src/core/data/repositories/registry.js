import { createStaticRepositories } from "./createStaticRepositories.js"

/** @type {import('./contracts/repositoryContracts.js').AppRepositories} */
let active = createStaticRepositories()

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
