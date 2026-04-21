/**
 * Подписи элементов конструктора из `asset_modeling_knowledge.json`.
 */
import assetModelingKnowledge from "../thinking/data/prompt-pipeline/asset_modeling_knowledge.json"

const dims = assetModelingKnowledge.dimensions || {}

function byId(list, id) {
	const arr = Array.isArray(list) ? list : []
	const row = arr.find((x) => x && x.id === id)
	return row?.name ? String(row.name) : id
}

export function labelBase(id) {
	return byId(dims.bases, id)
}

export function labelHorizon(id) {
	return byId(dims.horizons, id)
}

export function labelHorizonPhase(id) {
	return byId(dims.horizon_phases, id)
}

export function labelObjective(id) {
	return byId(dims.objectives, id)
}

export function labelConstraint(id) {
	const shortName = byId(dims.constraints, id)
	if (shortName && shortName !== id) return shortName
	const ch = dims.dimension_help?.constraints?.[id]
	if (typeof ch === "string" && ch.trim()) {
		const short = ch.trim().split(/[.:]/)[0]
		if (short.length > 4 && short.length < 120) return short.trim()
	}
	return id
}

export function labelLever(id) {
	return byId(dims.levers, id)
}
