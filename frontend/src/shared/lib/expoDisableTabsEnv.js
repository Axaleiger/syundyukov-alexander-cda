/**
 * Список отключённых вкладок стенда из VITE_EXPO_DISABLE_TABS (через запятую).
 * Id приводятся к нижнему регистру, чтобы совпадали с NAV_ITEMS (planning, не Planning).
 *
 * @param {string | undefined} raw
 * @returns {Set<string>}
 */
export function parseExpoDisableTabsSet(raw) {
	const s = String(raw ?? "").trim()
	if (!s) return new Set()
	return new Set(
		s
			.split(",")
			.map((part) => part.trim().toLowerCase())
			.filter(Boolean),
	)
}

/**
 * Множество отключённых вкладок из import.meta.env (Vite подставляет при сборке).
 * @returns {Set<string>}
 */
export function getExpoDisableTabsFromEnv() {
	return parseExpoDisableTabsSet(import.meta.env.VITE_EXPO_DISABLE_TABS)
}
