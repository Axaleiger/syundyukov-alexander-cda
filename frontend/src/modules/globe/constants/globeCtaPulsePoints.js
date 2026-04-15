/**
 * CTA на глобусе: ДО Ямал, Хантос, Ноябрьскнефтегаз (id как в static mapPoints / API).
 * Меняется только цвет — lat/lon не трогаем.
 */
export const GLOBE_CTA_PULSE_ASSET_IDS = new Set(["do-yamal", "do-hantos", "do-noyabrsk"])

/**
 * Та же тройка для любого источника данных: slug из БД, id из json, или по name.
 */
export function globePointIsCtaPulse(point) {
	if (!point) return false
	const id = String(point.id || "").toLowerCase()
	if ([...GLOBE_CTA_PULSE_ASSET_IDS].some((k) => k === id)) return true
	for (const k of GLOBE_CTA_PULSE_ASSET_IDS) {
		if (id.endsWith(k) || id.includes(k.replace(/^do-/, ""))) return true
	}
	if (id.includes("yamal")) return true
	if (id.includes("hantos")) return true
	if (id.includes("noyabrsk") || id.includes("noyabr")) return true

	const name = String(point.name || "")
	if (/ямал/i.test(name)) return true
	if (/хантос/i.test(name)) return true
	if (/ноябрьск/i.test(name) && /нефт/i.test(name)) return true

	return false
}

/** Плавный переход голубой ↔ оранжевый (Гц). */
export const GLOBE_CTA_PULSE_HZ = 1.1

const BASE_BLUE = "#0ea5e9"
const PULSE_ORANGE = "#f97316"

export function globeCtaPulseMix01(timeSeconds) {
	return (Math.sin(timeSeconds * Math.PI * 2 * GLOBE_CTA_PULSE_HZ) + 1) / 2
}

export function mixHexColor(hexA, hexB, t) {
	const u = Math.max(0, Math.min(1, t))
	const pa = parseInt(String(hexA).replace("#", ""), 16)
	const pb = parseInt(String(hexB).replace("#", ""), 16)
	const ar = (pa >> 16) & 255
	const ag = (pa >> 8) & 255
	const ab = pa & 255
	const br = (pb >> 16) & 255
	const bg = (pb >> 8) & 255
	const bb = pb & 255
	const r = Math.round(ar + (br - ar) * u)
	const g = Math.round(ag + (bg - ag) * u)
	const b = Math.round(ab + (bb - ab) * u)
	return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`
}

export function globeCtaPulseColor(timeSeconds) {
	return mixHexColor(BASE_BLUE, PULSE_ORANGE, globeCtaPulseMix01(timeSeconds))
}

/**
 * Пульс как у розы «Зрелость ЦД» (NewDemoHealth.module.css → newDemoHealthRoseOutlinePulse).
 * Держите период в паре с `animation: … 2.35s …` у `.ndRadarArea` / контуров роз.
 */
export const NEW_DEMO_ROSE_SYNC_PULSE_SEC = 0.5

/** Палитра new-demo: #e66b21 ↔ #f97316 (без персикового / янтарного). */
const ROSE_ORANGE_LO = { r: 230, g: 107, b: 33 }
const ROSE_ORANGE_HI = { r: 249, g: 115, b: 22 }

function easeInOutCubic(t) {
	return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/**
 * 0→1→0 за период, с ease-in-out на половинах — ближе к `animation-timing-function: ease-in-out` у розы.
 */
export function newDemoRoseSyncPulseMix01(timeSeconds) {
	const T = NEW_DEMO_ROSE_SYNC_PULSE_SEC
	const s = (((timeSeconds % T) + T) % T) / T
	if (s <= 0.5) return easeInOutCubic(s * 2)
	return easeInOutCubic((1 - s) * 2)
}

/** Только оранжевые оттенки (без голубого), как обводка розы. */
export function newDemoRoseSyncPulseHex(timeSeconds) {
	const u = newDemoRoseSyncPulseMix01(timeSeconds)
	const r = Math.round(ROSE_ORANGE_LO.r + (ROSE_ORANGE_HI.r - ROSE_ORANGE_LO.r) * u)
	const g = Math.round(ROSE_ORANGE_LO.g + (ROSE_ORANGE_HI.g - ROSE_ORANGE_LO.g) * u)
	const b = Math.round(ROSE_ORANGE_LO.b + (ROSE_ORANGE_HI.b - ROSE_ORANGE_LO.b) * u)
	return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`
}
