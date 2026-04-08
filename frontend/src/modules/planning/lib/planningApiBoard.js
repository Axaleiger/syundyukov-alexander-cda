/**
 * Преобразует доску из GET /api/v1/planning/cases/{id} в формат BPMBoard.
 * @param {unknown} board
 * @returns {{ stages: string[], tasks: Record<string, object[]>, connections: object[] } | null}
 */
export function normalizePlanningBoardPayload(board) {
	if (!board || typeof board !== "object") return null
	const stages = Array.isArray(board.stages) ? board.stages : []
	const rawTasks = board.tasks && typeof board.tasks === "object" ? board.tasks : {}
	const tasks = {}
	for (const name of stages) {
		const list = rawTasks[name]
		tasks[name] = Array.isArray(list)
			? list.map((t) => normalizeTask(t))
			: []
	}
	const connections = Array.isArray(board.connections) ? board.connections : []
	return { stages, tasks, connections }
}

/**
 * @param {object} t
 */
function normalizeTask(t) {
	if (!t || typeof t !== "object") return t
	const deadline =
		t.deadline != null
			? typeof t.deadline === "string"
				? new Date(t.deadline)
				: t.deadline
			: null
	const entries = Array.isArray(t.entries) ? t.entries : []
	return {
		...t,
		deadline,
		entries:
			entries.length > 0
				? entries
				: [{ system: "", input: "", output: "" }],
	}
}
