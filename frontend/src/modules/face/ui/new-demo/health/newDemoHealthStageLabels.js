/** Подписи этапов только для UI раздела «Зрелость цифровых двойников» (new-demo). Ключи совпадают с `name` в rosesData. */
const STAGE_LABELS = {
	"Геологоразведка и работа с ресурсной базой": "Цифровой двойник ресурсной базы",
	Разработка: "Цифровой двойник промысла",
	"Планирование и обустройство": "Цифровой двойник проектных решений",
	"Бурение и ВСР": "Цифровой двойник новых мощностей",
	Добыча: "Цифровой двойник разведки и добычи",
}

export function getNewDemoHealthStageLabel(canonicalName) {
	return STAGE_LABELS[canonicalName] ?? canonicalName
}

/** Короткие подписи на самой розе: «Цифровой двойник …» → «ЦД …». На плашках списка не используется. */
export function getNewDemoHealthStageRoseLabel(canonicalName) {
	let s = getNewDemoHealthStageLabel(canonicalName).replace(/^Цифровой двойник /, "ЦД ")
	/* Перенос перед «добычи», чтобы вторая строка не заходила на диаграмму */
	if (canonicalName === "Добыча") {
		s = s.replace(/\s+добычи$/, "\nдобычи")
	}
	return s
}
