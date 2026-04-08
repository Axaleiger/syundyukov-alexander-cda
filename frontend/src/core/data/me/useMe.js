import { useEffect, useState } from "react"
import { API_V1_PREFIX, apiFetch } from "../repositories/http/httpClient.js"

/**
 * Текущий пользователь из GET /api/v1/me (после сидирования БД).
 */
export function useMe() {
	const [me, setMe] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)

	useEffect(() => {
		let cancelled = false
		setLoading(true)
		setError(null)
		apiFetch(`${API_V1_PREFIX}/me`)
			.then((data) => {
				if (!cancelled) setMe(data)
			})
			.catch((e) => {
				if (!cancelled) {
					setError(e instanceof Error ? e.message : String(e))
				}
			})
			.finally(() => {
				if (!cancelled) setLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [])

	return { me, loading, error }
}
