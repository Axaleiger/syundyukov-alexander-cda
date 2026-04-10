import { useEffect, useMemo, useState } from "react"
import { useRepositories } from "../../../app/providers/DataRepositoriesProvider"
import { API_V1_PREFIX, apiFetch } from "../../../core/data/repositories/http/httpClient.js"

const useStaticRepos = import.meta.env.VITE_USE_STATIC_REPOS === "1"

/**
 * Точки карты главной: из БД при работе с API, иначе static mapPoints.json.
 */
export function useMapPointsData() {
	const { mapGlobe } = useRepositories()
	const staticPoints = useMemo(() => mapGlobe.getMapPoints(), [mapGlobe])
	const [remote, setRemote] = useState(null)

	useEffect(() => {
		if (useStaticRepos) {
			setRemote(null)
			return
		}
		let cancelled = false
		;(async () => {
			try {
				const rows = await apiFetch(`${API_V1_PREFIX}/face/map-points`)
				if (cancelled) return
				const normalized = rows.map((r) => ({
					id: r.id,
					name: r.name,
					lon: r.lon,
					lat: r.lat,
					city: r.city ?? null,
					assetId: r.assetId,
				}))
				setRemote(normalized)
			} catch {
				if (!cancelled) setRemote(staticPoints)
			}
		})()
		return () => {
			cancelled = true
		}
	}, [mapGlobe, staticPoints])

	if (useStaticRepos) return staticPoints
	return remote ?? staticPoints
}
