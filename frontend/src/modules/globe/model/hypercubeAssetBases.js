/**
 * Базовые значения по активам для «Бизнес возможности» (млн руб, млн т, млн т).
 * Слайдеры: NPV ±25%, запасы ±10%, добыча ±15% от базы.
 */
export const HYPERCUBE_ASSET_BASES = {
	prirazlomnoe: { npv: 4200, reserves: 552, extraction: 14.2 },
	"do-vostok": { npv: 2100, reserves: 18.22, extraction: 30 },
	"do-zapolyarye": { npv: 2400, reserves: 88, extraction: 41 },
	"do-noyabrsk": { npv: 3400, reserves: 1000, extraction: 850 },
	"do-orenburg": { npv: 2300, reserves: 265, extraction: 60 },
	"do-hantos": { npv: 5100, reserves: 645, extraction: 235.4 },
	"do-yamal": { npv: 2050, reserves: 102, extraction: 44 },
	"do-meretoyakha": { npv: 2180, reserves: 148, extraction: 36 },
	"do-messoyakha": { npv: 2550, reserves: 172, extraction: 52 },
	"do-salym": { npv: 3050, reserves: 188, extraction: 46 },
	"do-megion": { npv: 2750, reserves: 298, extraction: 58 },
	"do-tomsk": { npv: 1650, reserves: 82, extraction: 22 },
	spb: { npv: 720, reserves: 12, extraction: 3.5 },
	moscow: { npv: 780, reserves: 15, extraction: 4 },
}

/** Fallback: нет выбранной точки или неизвестный id */
export const HYPERCUBE_DEFAULT_BASE = { npv: 2600, reserves: 200, extraction: 50 }

function computeScaleMaxes() {
	const values = Object.values(HYPERCUBE_ASSET_BASES)
	const max = { npv: 1, reserves: 1, extraction: 1 }
	for (const b of values) {
		max.npv = Math.max(max.npv, b.npv * 1.25)
		max.reserves = Math.max(max.reserves, b.reserves * 1.1)
		max.extraction = Math.max(max.extraction, b.extraction * 1.15)
	}
	return max
}

export const HYPERCUBE_SCALE_MAX = computeScaleMaxes()

export function getHypercubeBaseForAsset(assetId) {
	if (assetId && HYPERCUBE_ASSET_BASES[assetId]) {
		return HYPERCUBE_ASSET_BASES[assetId]
	}
	return { ...HYPERCUBE_DEFAULT_BASE }
}
