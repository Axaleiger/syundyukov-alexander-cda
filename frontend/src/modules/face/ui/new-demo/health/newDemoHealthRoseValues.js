import { newDemoPercentInRange } from "../../../lib/newDemoDeterministicPercent.js"
import {
	getStageNamesContainingObject,
	STAGE_NAME_TO_CD_OBJECT_NAMES,
} from "./newDemoHealthProgramObjects.js"

/** Тот же hash, что и `faceSeed` при выбранном активе (`useFacePageModel`). */
export function faceSeedFromAssetId(assetId) {
	return Math.abs(
		String(assetId)
			.split("")
			.reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0),
	)
}

function average(nums) {
	if (!nums.length) return 0
	return nums.reduce((a, b) => a + b, 0) / nums.length
}

function seedsForAggregation(assetIds) {
	return assetIds.length > 0 ? assetIds.map((id) => faceSeedFromAssetId(id)) : [1337]
}

/**
 * Охват: значение объекта в программе, усреднённое по активам (те же числа, что на розе 2 при выбранной программе).
 */
export function valueCoverageObjectInProgramAggregated(
	objectCatalog,
	assetIds,
	programStageIndex,
	programStages,
	objectName,
	percentMin,
	percentMax,
) {
	const stage = programStages[programStageIndex]
	if (!stage) return 0
	const allowed = new Set(STAGE_NAME_TO_CD_OBJECT_NAMES[stage.name] || [])
	if (!allowed.has(objectName)) return 0
	const seeds = seedsForAggregation(assetIds)
	const catalogIndex = objectCatalog.findIndex((x) => x.name === objectName)
	const idx = catalogIndex >= 0 ? catalogIndex : 0
	const perAsset = seeds.map((seed) =>
		Math.round(
			valueForProgramObject(seed, programStageIndex, objectName, idx, percentMin, percentMax),
		),
	)
	return Math.round(average(perAsset))
}

/**
 * Значение объекта O в контексте программы (лепесток розы 1) с индексом programStageIndex.
 * @param {number} catalogIndex — индекс объекта в полном списке NEW_DEMO_HEALTH_RIGHT_OBJECTS (стабильная соль).
 */
export function valueForProgramObject(
	seed,
	programStageIndex,
	objectName,
	catalogIndex,
	min,
	max,
) {
	const salt = (programStageIndex + 1) * 173 + String(objectName).length * 3 + catalogIndex * 11
	return newDemoPercentInRange(seed, salt, catalogIndex, min, max)
}

/**
 * Роза 1 (охват), один актив (seed): для программы — среднее **округлённых** процентов её объектов
 * (совпадает с средним по лепесткам розы 2 при выбранной этой программе).
 */
export function buildLeftRoseCoverageOneSeed(programStages, objectCatalog, seed, percentMin, percentMax) {
	return programStages.map((stage, programIndex) => {
		const objNames = STAGE_NAME_TO_CD_OBJECT_NAMES[stage.name]
		if (!objNames?.length) {
			return { ...stage, value: stage.value ?? 0, coverage: stage.coverage ?? stage.value ?? 0 }
		}
		const rounded = objNames.map((objectName) => {
			const catalogIndex = objectCatalog.findIndex((o) => o.name === objectName)
			const idx = catalogIndex >= 0 ? catalogIndex : 0
			return Math.round(
				valueForProgramObject(seed, programIndex, objectName, idx, percentMin, percentMax),
			)
		})
		const v = Math.round(average(rounded))
		return { ...stage, value: v, coverage: v }
	})
}

/**
 * Без выбранного актива: среднее по всем активам карты от показателей «как у одного актива»
 * (вложенное среднее: среднее по активам от средних по объектам программы).
 */
export function buildLeftRoseCoverageAggregated(programStages, objectCatalog, assetIds, percentMin, percentMax) {
	const seeds =
		assetIds.length > 0 ? assetIds.map((id) => faceSeedFromAssetId(id)) : [1337]
	return programStages.map((stage, programIndex) => {
		const perAsset = seeds.map((seed) => {
			const row = buildLeftRoseCoverageOneSeed(programStages, objectCatalog, seed, percentMin, percentMax)
			return row[programIndex].value
		})
		const v = Math.round(average(perAsset))
		return { ...stage, value: v, coverage: v }
	})
}

/**
 * Роза 2 (охват), все объекты, один seed: для объекта — среднее **округлённых** процентов по программам,
 * где объект участвует.
 */
export function buildRightRoseCoverageAllObjectsOneSeed(
	objectCatalog,
	seed,
	programStages,
	percentMin,
	percentMax,
) {
	return objectCatalog.map((template, catalogIndex) => {
		const objectName = template.name
		const stageNames = getStageNamesContainingObject(objectName)
		const rounded = stageNames.map((stageName) => {
			const programIndex = programStages.findIndex((s) => s.name === stageName)
			return Math.round(
				valueForProgramObject(
					seed,
					programIndex >= 0 ? programIndex : 0,
					objectName,
					catalogIndex,
					percentMin,
					percentMax,
				),
			)
		})
		const v = Math.round(average(rounded.length ? rounded : [45]))
		return { ...template, value: v, coverage: v }
	})
}

/**
 * Без выбранного актива: по объекту — среднее по программам, где он участвует, от показателя
 * «объект × программа» (то же, что видно при переключении программ на розе 2).
 */
export function buildRightRoseCoverageAllObjectsAggregated(
	objectCatalog,
	assetIds,
	programStages,
	percentMin,
	percentMax,
) {
	return objectCatalog.map((template) => {
		const objectName = template.name
		const stageNames = getStageNamesContainingObject(objectName)
		const vals = stageNames.map((stageName) => {
			const programIndex = programStages.findIndex((s) => s.name === stageName)
			const pi = programIndex >= 0 ? programIndex : 0
			return valueCoverageObjectInProgramAggregated(
				objectCatalog,
				assetIds,
				pi,
				programStages,
				objectName,
				percentMin,
				percentMax,
			)
		})
		const v = Math.round(average(vals.length ? vals : [45]))
		return { ...template, value: v, coverage: v }
	})
}

/** Роза 2 при выбранной программе, один seed. */
export function buildRightRoseCoverageForProgramOneSeed(
	objectCatalog,
	seed,
	programStageIndex,
	programStages,
	percentMin,
	percentMax,
) {
	const stage = programStages[programStageIndex]
	if (!stage) return []
	const allowed = new Set(STAGE_NAME_TO_CD_OBJECT_NAMES[stage.name] || [])
	return objectCatalog
		.filter((o) => allowed.has(o.name))
		.map((template, i) => {
			const catalogIndex = objectCatalog.findIndex((x) => x.name === template.name)
			const idx = catalogIndex >= 0 ? catalogIndex : i
			const v = Math.round(
				valueForProgramObject(seed, programStageIndex, template.name, idx, percentMin, percentMax),
			)
			return { ...template, value: v, coverage: v }
		})
}

/** Выбранная программа, без актива на карте: среднее по активам для каждого объекта программы. */
export function buildRightRoseCoverageForProgramAggregated(
	objectCatalog,
	assetIds,
	programStageIndex,
	programStages,
	percentMin,
	percentMax,
) {
	const stage = programStages[programStageIndex]
	if (!stage) return []
	const allowed = new Set(STAGE_NAME_TO_CD_OBJECT_NAMES[stage.name] || [])
	const filteredTemplates = objectCatalog.filter((o) => allowed.has(o.name))

	return filteredTemplates.map((template) => {
		const v = valueCoverageObjectInProgramAggregated(
			objectCatalog,
			assetIds,
			programStageIndex,
			programStages,
			template.name,
			percentMin,
			percentMax,
		)
		return { ...template, value: v, coverage: v }
	})
}

/**
 * Глубина 10–30 % для пары (программа, объект): та же соль, что у охвата, чтобы структура совпадала.
 */
export function depthForProgramObject(seed, programStageIndex, objectName, catalogIndex) {
	const salt = (programStageIndex + 1) * 173 + String(objectName).length * 3 + catalogIndex * 11
	return newDemoPercentInRange(seed, salt, catalogIndex, 10, 30)
}

export function valueDepthObjectInProgramAggregated(
	objectCatalog,
	assetIds,
	programStageIndex,
	programStages,
	objectName,
) {
	const stage = programStages[programStageIndex]
	if (!stage) return 0
	const allowed = new Set(STAGE_NAME_TO_CD_OBJECT_NAMES[stage.name] || [])
	if (!allowed.has(objectName)) return 0
	const seeds = seedsForAggregation(assetIds)
	const catalogIndex = objectCatalog.findIndex((x) => x.name === objectName)
	const idx = catalogIndex >= 0 ? catalogIndex : 0
	const perAsset = seeds.map((seed) => Math.round(depthForProgramObject(seed, programStageIndex, objectName, idx)))
	return Math.round(average(perAsset))
}

/** Режим «Глубина», один актив: как охват — среднее округлённых глубин объектов программы. */
export function buildLeftRoseDepthOneSeed(programStages, objectCatalog, seed) {
	return programStages.map((stage, programIndex) => {
		const objNames = STAGE_NAME_TO_CD_OBJECT_NAMES[stage.name]
		if (!objNames?.length) {
			return { ...stage, value: stage.value ?? 0, coverage: stage.coverage ?? stage.value ?? 0 }
		}
		const rounded = objNames.map((objectName) => {
			const catalogIndex = objectCatalog.findIndex((o) => o.name === objectName)
			const idx = catalogIndex >= 0 ? catalogIndex : 0
			return Math.round(depthForProgramObject(seed, programIndex, objectName, idx))
		})
		const v = Math.round(average(rounded))
		return { ...stage, value: v, coverage: v }
	})
}

/** Глубина без актива: по программе — среднее по объектам (агрегированных по активам). */
export function buildLeftDepthAggregated(programStages, objectCatalog, assetIds) {
	return programStages.map((stage, programIndex) => {
		const objNames = STAGE_NAME_TO_CD_OBJECT_NAMES[stage.name]
		if (!objNames?.length) {
			return { ...stage, value: stage.value ?? 0, coverage: stage.coverage ?? stage.value ?? 0 }
		}
		const vals = objNames.map((objectName) =>
			valueDepthObjectInProgramAggregated(
				objectCatalog,
				assetIds,
				programIndex,
				programStages,
				objectName,
			),
		)
		const v = Math.round(average(vals))
		return { ...stage, value: v, coverage: v }
	})
}

/** Роза 2, глубина, все объекты, один seed. */
export function buildRightRoseDepthAllObjectsOneSeed(objectCatalog, seed, programStages) {
	return objectCatalog.map((template, catalogIndex) => {
		const objectName = template.name
		const stageNames = getStageNamesContainingObject(objectName)
		const rounded = stageNames.map((stageName) => {
			const programIndex = programStages.findIndex((s) => s.name === stageName)
			const pi = programIndex >= 0 ? programIndex : 0
			return Math.round(depthForProgramObject(seed, pi, objectName, catalogIndex))
		})
		const v = Math.round(average(rounded.length ? rounded : [20]))
		return { ...template, value: v, coverage: v }
	})
}

/** Роза 2, глубина, все объекты, без актива. */
export function buildRightRoseDepthAllObjectsAggregated(objectCatalog, assetIds, programStages) {
	return objectCatalog.map((template) => {
		const objectName = template.name
		const stageNames = getStageNamesContainingObject(objectName)
		const vals = stageNames.map((stageName) => {
			const programIndex = programStages.findIndex((s) => s.name === stageName)
			const pi = programIndex >= 0 ? programIndex : 0
			return valueDepthObjectInProgramAggregated(
				objectCatalog,
				assetIds,
				pi,
				programStages,
				objectName,
			)
		})
		const v = Math.round(average(vals.length ? vals : [20]))
		return { ...template, value: v, coverage: v }
	})
}

/** Роза 2, глубина, выбранная программа, один seed. */
export function buildRightRoseDepthForProgramOneSeed(
	objectCatalog,
	seed,
	programStageIndex,
	programStages,
) {
	const stage = programStages[programStageIndex]
	if (!stage) return []
	const allowed = new Set(STAGE_NAME_TO_CD_OBJECT_NAMES[stage.name] || [])
	return objectCatalog
		.filter((o) => allowed.has(o.name))
		.map((template, i) => {
			const catalogIndex = objectCatalog.findIndex((x) => x.name === template.name)
			const idx = catalogIndex >= 0 ? catalogIndex : i
			const v = Math.round(depthForProgramObject(seed, programStageIndex, template.name, idx))
			return { ...template, value: v, coverage: v }
		})
}

/** Роза 2, глубина, выбранная программа, без актива. */
export function buildRightRoseDepthForProgramAggregated(
	objectCatalog,
	assetIds,
	programStageIndex,
	programStages,
) {
	const stage = programStages[programStageIndex]
	if (!stage) return []
	const allowed = new Set(STAGE_NAME_TO_CD_OBJECT_NAMES[stage.name] || [])
	return objectCatalog
		.filter((o) => allowed.has(o.name))
		.map((template) => {
			const v = valueDepthObjectInProgramAggregated(
				objectCatalog,
				assetIds,
				programStageIndex,
				programStages,
				template.name,
			)
			return { ...template, value: v, coverage: v }
		})
}
