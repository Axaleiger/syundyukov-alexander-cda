/**
 * Связь лепестков розы 1 (имена из `rosesData.PRODUCTION_STAGES`) с объектами розы 2
 * (имена из `newDemoCdObjectTwins` / NEW_DEMO_HEALTH_RIGHT_OBJECTS).
 */
export const STAGE_NAME_TO_CD_OBJECT_NAMES = {
	"Геологоразведка и работа с ресурсной базой": ["ЦД пласта", "ЦД флюида", "ЦД керна"],
	Разработка: ["ЦД пласта", "ЦД скважины", "ЦД инфраструктуры", "ЦД флюида", "ЦД подготовки"],
	"Планирование и обустройство": [
		"ЦД инфраструктуры",
		"ЦД энергетики",
		"ЦД буровой установки",
		"ЦД подготовки",
	],
	"Бурение и ВСР": [
		"ЦД пласта",
		"ЦД скважины",
		"ЦД инфраструктуры",
		"ЦД подготовки",
		"ЦД энергетики",
		"ЦД буровой установки",
		"ЦД керна",
	],
	Добыча: ["ЦД пласта", "ЦД скважины", "ЦД флюида", "ЦД буровой установки", "ЦД керна"],
}

/** @param {string} objectName */
export function getStageNamesContainingObject(objectName) {
	const out = []
	for (const [stageName, names] of Object.entries(STAGE_NAME_TO_CD_OBJECT_NAMES)) {
		if (names.includes(objectName)) out.push(stageName)
	}
	return out
}

/**
 * @param {{ name: string }[]} objectCatalog
 * @param {{ name: string }[]} programStages `PRODUCTION_STAGES`
 * @param {number | null} selectedStageIndex
 */
export function filterObjectsForSelectedProgram(objectCatalog, programStages, selectedStageIndex) {
	if (selectedStageIndex == null) return objectCatalog
	const stage = programStages[selectedStageIndex]
	if (!stage) return objectCatalog
	const allowed = new Set(STAGE_NAME_TO_CD_OBJECT_NAMES[stage.name] || [])
	return objectCatalog.filter((o) => allowed.has(o.name))
}
