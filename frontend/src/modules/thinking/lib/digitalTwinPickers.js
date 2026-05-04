/**
 * Подбор цифровых двойников для промежуточных шаров между причиной↔гипотеза и гипотеза↔сценарий.
 * Нумерация «ЦД N» задаётся снаружи; здесь — сколько шаров (1–2) и семантические коды.
 */

/** @typedef {{ codes: string[], score: number }} TwinPick */

const CAUSE_HYP_TWINS = [
	{
		code: "ЦДРБ",
		keys: [
			"запас",
			"геолог",
			"пласт",
			"ресурс",
			"развед",
			"качеств",
			"gb",
			"объём",
			"объем",
			"потенциал",
		],
	},
	{
		code: "ЦДП",
		keys: [
			"промысл",
			"скважин",
			"фонд",
			"добыч",
			"оператив",
			"инфраструктур",
			"энергет",
			"потерь",
			"эффектив",
			"труб",
		],
	},
	{
		code: "ЦДПР",
		keys: [
			"проект",
			"бурен",
			"ввод",
			"капекс",
			"capex",
			"траектор",
			"мощност",
			"программ",
			"конструкц",
		],
	},
	{
		code: "АВНМ",
		keys: [
			"новых мощност",
			"новое строительств",
			"ввод мощност",
			"капитальн",
			"новый фонд",
			"greenfield",
		],
	},
	{
		code: "ЦД РИД",
		keys: [
			"разведк",
			"добыч",
			"локальн",
			"риск добыч",
			"бурени данн",
			"интеграц данн",
		],
	},
]

/** Между гипотезой и сценарием (короткие коды для метаданных). */
const HYP_SCENARIO_TWINS = [
	{ code: "СКВ", label: "ЦД скважины", keys: ["скважин", "гтм", "грп", "регламент скваж"] },
	{ code: "ПЛА", label: "ЦД пласта", keys: ["пласт", "поров", "проницаем", "пластов"] },
	{ code: "ИНФ", label: "ЦД инфраструктуры", keys: ["инфраструктур", "трубопровод", "коллектор", "узел"] },
	{ code: "ФЛЮ", label: "ЦД флюида", keys: ["флюид", "нефт", "вода", "поток", "фаз"] },
	{ code: "ПОД", label: "ЦД подготовки", keys: ["подготовк", "сепарац", "очистк", "дебит"] },
	{ code: "ЭНЕ", label: "ЦД энергетики", keys: ["энергет", "электро", "потреблен", "нагнетан"] },
	{ code: "БУР", label: "ЦД буровой установки", keys: ["бурен", "башмак", "отклонен", "зенит", "ствол", "буров"] },
]

function scoreKeys(textLower, keys) {
	let s = 0
	for (const k of keys) {
		if (textLower.includes(k)) s += 1
	}
	return s
}

function rankCauseHyp(text) {
	const t = String(text || "")
		.toLowerCase()
		.replace(/\s+/g, " ")
	return CAUSE_HYP_TWINS.map((row) => ({
		code: row.code,
		score: scoreKeys(t, row.keys),
	})).sort((a, b) => b.score - a.score)
}

function rankHypScenario(text) {
	const t = String(text || "")
		.toLowerCase()
		.replace(/\s+/g, " ")
	return HYP_SCENARIO_TWINS.map((row) => ({
		code: row.code,
		label: row.label,
		score: scoreKeys(t, row.keys),
	})).sort((a, b) => b.score - a.score)
}

/**
 * 1 или 2 шара; каждый шар — один код или комбинация «код1+код2» в метаданных.
 * @returns {{ codes: string[] }[]}
 */
export function pickDigitalTwinsCauseHyp(causeDetail, hypDetail) {
	const merged = `${causeDetail} ${hypDetail}`
	const rank = rankCauseHyp(merged)
	const top = rank[0]
	const second = rank[1]
	if (!top || top.score <= 0) {
		return [{ codes: ["ЦДП"] }]
	}
	if (second && second.score > 0 && second.score >= top.score * 0.55 && top.code !== second.code) {
		return [{ codes: [top.code] }, { codes: [second.code] }]
	}
	return [{ codes: [top.code] }]
}

/** Подпись на шаре для сегмента гипотеза→сценарий (слова из ТЗ пользователя). */
const HS_CODE_BALL_LABEL = {
	СКВ: "ЦД скважины",
	ПЛА: "ЦД пласта",
	ИНФ: "ЦД инфраструктуры",
	ФЛЮ: "ЦД флюида",
	ПОД: "ЦД подготовки",
	ЭНЕ: "ЦД энергетики",
	БУР: "ЦД буровой установки",
}

/**
 * Текст на шаре: конкретные ЦД, без «ЦД 1».
 * @param {'ch'|'hs'} segment
 * @param {string[]} codes
 */
export function formatDigitalTwinBallLabel(segment, codes) {
	const list = Array.isArray(codes) ? codes.filter(Boolean) : []
  if (!list.length) return segment === "hs" ? "ЦД скважины" : "ЦДП"
	if (segment === "hs") {
		return list.map((c) => HS_CODE_BALL_LABEL[c] || c).join(" + ")
	}
	return list.join(" + ")
}

/**
 * @returns {{ codes: string[] }[]}
 */
export function pickDigitalTwinsHypScenario(hypDetail, scenarioStubText) {
	const merged = `${hypDetail} ${scenarioStubText}`
	const rank = rankHypScenario(merged)
	const top = rank[0]
	const second = rank[1]
	if (!top || top.score <= 0) {
		return [{ codes: ["СКВ"] }]
	}
	if (second && second.score > 0 && second.score >= top.score * 0.5 && top.code !== second.code) {
		return [{ codes: [top.code] }, { codes: [second.code] }]
	}
	return [{ codes: [top.code] }]
}
