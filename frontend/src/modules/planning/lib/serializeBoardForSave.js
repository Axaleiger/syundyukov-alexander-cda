/**
 * Приводит доску к JSON для PUT /planning/cases/{id}/board (даты → ISO-строки).
 * @param {string[]} stages
 * @param {Record<string, object[]>} tasks
 * @param {object[]} [connections]
 */
export function serializeBoardForSave(stages, tasks, connections) {
	const outTasks = {}
	for (const s of stages) {
		const list = tasks[s] || []
		outTasks[s] = list.map(serializeTask)
	}
	return {
		stages,
		tasks: outTasks,
		connections: Array.isArray(connections) ? connections : [],
	}
}

function serializeTask(task) {
	if (!task || typeof task !== "object") return task
	const deadline = task.deadline
	let d = deadline
	if (deadline instanceof Date) {
		d = deadline.toISOString()
	}
	return { ...task, deadline: d }
}
