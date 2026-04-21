/**
 * Подпись узла «Цель N» на графе мышления — как на prompt-builder.html:
 * только имя цели из каталога + модальность, без хвоста кванта (G02/G03/…).
 * Пример: «Цель 1: максимизация добычи нефти (Максимизация показателя →+∞)».
 */

import { assetModelingKnowledge } from "./knowledge.js"

function decapitalizeRu(s) {
	const t = String(s || "").trim()
	if (!t) return ""
	return t.charAt(0).toLocaleLowerCase("ru-RU") + t.slice(1)
}

/** (FCF) → (fcf), (NPV) → (npv) */
function lowercaseAcronymsInParentheses(s) {
	return s.replace(/\(([A-ZА-ЯЁ]{2,10})\)/g, (_, grp) => `(${grp.toLowerCase()})`)
}

/** Первая буква строки — заглавная (остальное без изменений). */
export function capitalizeFirstRu(s) {
	const t = String(s ?? "").trim()
	if (!t) return ""
	return t.charAt(0).toLocaleUpperCase("ru-RU") + t.slice(1)
}

function modalityClause(direction, semantics) {
	if (direction === "max" || semantics === "maximize")
		return "(Максимизация показателя →+∞)"
	if (direction === "min" || semantics === "minimize")
		return "(Минимизация показателя → минимум)"
	if (direction === "optimize" || semantics === "optimize")
		return "(Оптимизация показателя при заданных ограничениях)"
	if (semantics === "resilience")
		return "(Удержание показателя в допустимой зоне устойчивости)"
	if (semantics === "sensitivity_down")
		return "(Снижение чувствительности к драйверам модели)"
	if (semantics === "reserves_in_situ")
		return "(Сохранение и отработка запасов в рамках допущений)"
	return "(Целевой режим показателя)"
}

/**
 * Ядро формулировки цели из каталога + модальность (без префикса «Цель N»).
 * @returns {{ core: string, mode: string } | null}
 */
function buildObjectiveCoreAndMode(objectiveId) {
	const id = String(objectiveId || "").trim()
	const dims = assetModelingKnowledge.dimensions?.objectives || []
	const row = dims.find((o) => o.id === id)
	if (!row?.name) return null
	const core = lowercaseAcronymsInParentheses(decapitalizeRu(row.name))
	const mode = modalityClause(row.direction, row.semantics)
	return { core, mode }
}

/**
 * Текст для раскрытия узла цели: только формулировка, с большой буквы, без «Цель №».
 * @param {number} branchIndex1Based — 1…4
 * @param {string | null | undefined} objectiveId
 */
export function formatFormalizatorObjectiveDetailBody(branchIndex1Based, objectiveId) {
	void branchIndex1Based
	const built = buildObjectiveCoreAndMode(objectiveId)
	if (!built) {
		return "Уточните формулировку цели в запросе (выберите цель из каталога)."
	}
	let out = `${built.core} ${built.mode}`.replace(/\s{2,}/g, " ").trim()
	return capitalizeFirstRu(out)
}

/**
 * @param {number} branchIndex1Based — 1…4 (номер ветки «Цель N» на графе)
 * @param {string | null | undefined} objectiveId — id вида G01 из каталога целей
 * @returns {string}
 */
export function formatFormalizatorObjectiveNodeLabel(branchIndex1Based, objectiveId) {
	const n = Math.max(1, Number(branchIndex1Based) || 1)
	const built = buildObjectiveCoreAndMode(objectiveId)

	if (!built) {
		return `Цель ${n}: уточните формулировку цели в запросе (выберите цель из каталога)`
	}

	let out = `Цель ${n}: ${built.core} ${built.mode}`
	out = out.replace(/\s{2,}/g, " ").trim()
	return out
}
