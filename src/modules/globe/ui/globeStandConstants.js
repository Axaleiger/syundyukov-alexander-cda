/**
 * Константы презентации демо-стенда для RussiaGlobe (без данных/репозиториев).
 * Согласованы с demo-stand RussiaGlobe / standDisplay.
 */

export const STAND_4K_WIDTH = 3840
export const STAND_4K_HEIGHT = 2160

export const DEMO_MAX_GLOBE_W = 1680
export const DEMO_MAX_GLOBE_H = 1500

/** Доля высоты viewport под «купол» stand-face (как в demo-stand) */
export const STAND_FACE_DOME_BAND_VH = 0.7

export const POV_ALT_MIN = 0.04
export const POV_ALT_MAX = 4
export const POV_ALT_MIN_STAND = 0.04

function clamp(v, min, max) {
	return Math.max(min, Math.min(max, v))
}

/** Как в demo-stand: ближе к сцене */
export function povAltitudeTwiceCloser(altOld) {
	return clamp(0.5 * (1 + altOld) - 1, POV_ALT_MIN, POV_ALT_MAX)
}

/** Иммерсив + stand-face: камера с юга (react-globe.gl — приближение к эталону EarthJson) */
export const IMMERSIVE_STAND_POV = { lat: 40, lng: 170, altitude: 1.8 }

/** Иммерсив без stand (не используется на текущем main, но нужен для полного API) */
export const IMMERSIVE_POV = {
	lat: 50,
	lng: 76,
	altitude: povAltitudeTwiceCloser(0.88),
}

/** Крупный демо-режим без immersive */
export const DEMO_STAND_POV = {
	lat: 62,
	lng: 90,
	altitude: povAltitudeTwiceCloser(1.02),
}
