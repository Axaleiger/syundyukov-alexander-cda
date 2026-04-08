/**
 * Базовый fetch к FastAPI: в dev Vite проксирует `/api` → бэкенд.
 * @param {string} path — путь с префиксом, напр. `/api/v1/me`
 * @param {RequestInit} [init]
 */
export async function apiFetch(path, init) {
	const res = await fetch(path, {
		...init,
		headers: {
			Accept: "application/json",
			...(init?.headers || {}),
		},
	})
	if (!res.ok) {
		const text = await res.text().catch(() => "")
		throw new Error(
			`API ${res.status} ${res.statusText}${text ? `: ${text.slice(0, 200)}` : ""}`,
		)
	}
	const ct = res.headers.get("content-type") || ""
	if (ct.includes("application/json")) {
		return res.json()
	}
	return res.text()
}

export const API_V1_PREFIX = "/api/v1"
