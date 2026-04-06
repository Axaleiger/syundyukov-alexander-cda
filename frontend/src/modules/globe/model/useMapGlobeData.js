import { useMemo } from "react"
import { useRepositories } from "../../../app/providers/DataRepositoriesProvider"

/** Карта / глобус: готовые ссылки на данные и хелперы из MapGlobeRepository. */
export function useMapGlobeData() {
	const { mapGlobe } = useRepositories()
	const mapPointsData = useMemo(() => mapGlobe.getMapPoints(), [mapGlobe])
	const chainsData = useMemo(() => mapGlobe.getChains(), [mapGlobe])
	const cfArrows = useMemo(() => mapGlobe.getCfArrows(), [mapGlobe])
	const budgetByAsset = useMemo(() => mapGlobe.getBudgetByAsset(), [mapGlobe])

	return {
		mapPointsData,
		chainsData,
		cfArrows,
		budgetByAsset,
		getBudgetForAssetId: mapGlobe.getBudgetForAssetId,
		budgetToColor: mapGlobe.budgetToColor,
		getAssetRegionKey: mapGlobe.getAssetRegionKey,
	}
}
