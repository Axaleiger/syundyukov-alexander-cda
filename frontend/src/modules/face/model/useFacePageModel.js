import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { useFaceData } from "./useFaceData"
import { useAppStore } from "../../../core/store/appStore"
import { demoFaceMapAssetSelect } from "../lib/demoFaceMapAssetSelect"
import { PANELS_SCENARIO_CONTENT } from "../../ai/lib/panelsScenarioContent.js"
import {
	buildLeftDepthAggregated,
	buildLeftRoseCoverageAggregated,
	buildLeftRoseCoverageOneSeed,
	buildLeftRoseDepthOneSeed,
	buildRightRoseCoverageAllObjectsAggregated,
	buildRightRoseCoverageAllObjectsOneSeed,
	buildRightRoseCoverageForProgramAggregated,
	buildRightRoseCoverageForProgramOneSeed,
	buildRightRoseDepthAllObjectsAggregated,
	buildRightRoseDepthAllObjectsOneSeed,
	buildRightRoseDepthForProgramAggregated,
	buildRightRoseDepthForProgramOneSeed,
} from "../ui/new-demo/health/newDemoHealthRoseValues.js"
import { filterObjectsForSelectedProgram } from "../ui/new-demo/health/newDemoHealthProgramObjects.js"

/**
 * Общая модель главной (face): данные роз, выбор актива, переходы в сценарии/планирование.
 * @param {string} pathPrefix — "" для основного приложения, "/demo" для демо-маршрутов
 * @param {object} [options]
 * @param {{ name: string }[]} [options.newDemoRightObjectsList]
 * @param {{ min: number, max: number }} [options.newDemoPercentRange] — для new-demo: диапазон процентов; без выбранного актива — среднее по всем активам карты
 * @param {{ left?: 'coverage' | 'depth', right?: 'coverage' | 'depth' }} [options.newDemoHealthMetricMode]
 */
export function useFacePageModel(pathPrefix = "", options = {}) {
	const { newDemoRightObjectsList, newDemoPercentRange, newDemoHealthMetricMode } = options
	const metricLeft = newDemoHealthMetricMode?.left ?? "coverage"
	const metricRight = newDemoHealthMetricMode?.right ?? "coverage"
	const navigate = useNavigate()
	const [searchParams, setSearchParams] = useSearchParams()

	const {
		mapPointsData,
		productionStages: PRODUCTION_STAGES,
		objectsByStage: OBJECTS_BY_STAGE,
		defaultObjects: DEFAULT_OBJECTS,
		scenarioStageFilters: SCENARIO_STAGE_FILTERS,
		getAssetStatus,
		getAssetStatusLabel,
		getAssetStatusIcon,
	} = useFaceData()

	const {
		selectedAssetId,
		setSelectedAssetId,
		scenarioComparisonRevision,
		setBpmHighlight,
		setScenarioStageFilters,
		setScenariosStageFilter,
		setCdPageNode,
		hypercubeCaseIntro,
		resetDemoFaceScenarioWorkflow,
		setScenarioComparisonRevision,
		setAiScenarioMetricDeltaOverride,
		setAgreedInfluenceLine,
	} = useAppStore()

	const aiReturn = searchParams.get("aiReturn")
	const aiPresetParam = searchParams.get("preset")
	useEffect(() => {
		if (aiReturn !== "1") return
		const block = aiPresetParam ? PANELS_SCENARIO_CONTENT[aiPresetParam] : null
		if (block) {
			setAgreedInfluenceLine(null)
			setAiScenarioMetricDeltaOverride(block.metricDeltas)
			setScenarioComparisonRevision((n) => n + 1)
		}
		const next = new URLSearchParams(searchParams)
		next.delete("aiReturn")
		next.delete("preset")
		setSearchParams(next, { replace: true })
	}, [
		aiReturn,
		aiPresetParam,
		searchParams,
		setSearchParams,
		setAgreedInfluenceLine,
		setScenarioComparisonRevision,
		setAiScenarioMetricDeltaOverride,
	])

	const [selectedLeftStageIndex, setSelectedLeftStageIndex] = useState(null)
	const [selectedRightObjectIndex, setSelectedRightObjectIndex] = useState(null)

	const toAppPath = useCallback(
		(segment) => {
			const base = pathPrefix.replace(/\/$/, "")
			return base ? `${base}/${segment}` : `/${segment}`
		},
		[pathPrefix],
	)

	const handleMapAssetSelect = useCallback(
		(pointId) => {
			demoFaceMapAssetSelect(pointId)
		},
		[],
	)

	const handleClearSelectedAsset = useCallback(() => {
		resetDemoFaceScenarioWorkflow()
		setSelectedAssetId(null)
	}, [resetDemoFaceScenarioWorkflow, setSelectedAssetId])

	const selectedAssetPoint = useMemo(
		() => (selectedAssetId ? mapPointsData.find((p) => p.id === selectedAssetId) : null),
		[selectedAssetId, mapPointsData],
	)

	const assetStatus = selectedAssetId ? getAssetStatus(selectedAssetId) : null
	const assetStatusLabel = assetStatus ? getAssetStatusLabel(assetStatus) : null
	const assetStatusIcon = assetStatus ? getAssetStatusIcon(assetStatus) : null

	const faceSeed = useMemo(() => {
		if (!selectedAssetId) return 0
		return Math.abs(
			selectedAssetId.split("").reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0),
		)
	}, [selectedAssetId])

	const healthAggregationAssetIds = useMemo(
		() => (mapPointsData || []).map((p) => p.id).filter(Boolean),
		[mapPointsData],
	)

	const rightRoseData = useMemo(() => {
		const seed = faceSeed || 1337
		const useNewDemoPercents = newDemoRightObjectsList != null && newDemoPercentRange != null

		if (useNewDemoPercents) {
			const { min, max } = newDemoPercentRange
			const filtered = filterObjectsForSelectedProgram(
				newDemoRightObjectsList,
				PRODUCTION_STAGES,
				selectedLeftStageIndex,
			)

			if (metricRight === "depth") {
				if (faceSeed === 0) {
					if (selectedLeftStageIndex == null) {
						return buildRightRoseDepthAllObjectsAggregated(
							newDemoRightObjectsList,
							healthAggregationAssetIds,
							PRODUCTION_STAGES,
						)
					}
					return buildRightRoseDepthForProgramAggregated(
						newDemoRightObjectsList,
						healthAggregationAssetIds,
						selectedLeftStageIndex,
						PRODUCTION_STAGES,
					)
				}
				if (selectedLeftStageIndex == null) {
					return buildRightRoseDepthAllObjectsOneSeed(
						newDemoRightObjectsList,
						seed,
						PRODUCTION_STAGES,
					)
				}
				return buildRightRoseDepthForProgramOneSeed(
					newDemoRightObjectsList,
					seed,
					selectedLeftStageIndex,
					PRODUCTION_STAGES,
				)
			}

			if (faceSeed === 0) {
				if (selectedLeftStageIndex == null) {
					return buildRightRoseCoverageAllObjectsAggregated(
						newDemoRightObjectsList,
						healthAggregationAssetIds,
						PRODUCTION_STAGES,
						min,
						max,
					)
				}
				return buildRightRoseCoverageForProgramAggregated(
					newDemoRightObjectsList,
					healthAggregationAssetIds,
					selectedLeftStageIndex,
					PRODUCTION_STAGES,
					min,
					max,
				)
			}

			if (selectedLeftStageIndex == null) {
				return buildRightRoseCoverageAllObjectsOneSeed(
					newDemoRightObjectsList,
					seed,
					PRODUCTION_STAGES,
					min,
					max,
				)
			}
			return buildRightRoseCoverageForProgramOneSeed(
				newDemoRightObjectsList,
				seed,
				selectedLeftStageIndex,
				PRODUCTION_STAGES,
				min,
				max,
			)
		}

		let base =
			newDemoRightObjectsList != null
				? newDemoRightObjectsList
				: selectedLeftStageIndex != null
					? OBJECTS_BY_STAGE[PRODUCTION_STAGES[selectedLeftStageIndex].name] || DEFAULT_OBJECTS
					: DEFAULT_OBJECTS
		if (faceSeed === 0) return base
		const r = (i, j) => ((faceSeed * (i + 1) * 7 + (j + 1) * 11) % 17) - 8
		return base.map((item, i) => ({
			...item,
			value: Math.max(50, Math.min(99, (item.value ?? 70) + r(i, 0))),
			coverage: Math.max(50, Math.min(99, (item.coverage ?? item.value ?? 70) + r(i, 1))),
		}))
	}, [
		selectedLeftStageIndex,
		faceSeed,
		OBJECTS_BY_STAGE,
		PRODUCTION_STAGES,
		DEFAULT_OBJECTS,
		newDemoRightObjectsList,
		newDemoPercentRange,
		metricRight,
		healthAggregationAssetIds,
	])

	const leftRoseData = useMemo(() => {
		const seed = faceSeed || 1337
		if (newDemoPercentRange != null && newDemoRightObjectsList != null) {
			const { min, max } = newDemoPercentRange

			if (metricLeft === "depth") {
				if (faceSeed === 0) {
					return buildLeftDepthAggregated(
						PRODUCTION_STAGES,
						newDemoRightObjectsList,
						healthAggregationAssetIds,
					)
				}
				return buildLeftRoseDepthOneSeed(
					PRODUCTION_STAGES,
					newDemoRightObjectsList,
					seed,
				)
			}

			if (faceSeed === 0) {
				return buildLeftRoseCoverageAggregated(
					PRODUCTION_STAGES,
					newDemoRightObjectsList,
					healthAggregationAssetIds,
					min,
					max,
				)
			}

			return buildLeftRoseCoverageOneSeed(
				PRODUCTION_STAGES,
				newDemoRightObjectsList,
				seed,
				min,
				max,
			)
		}
		if (faceSeed === 0) return PRODUCTION_STAGES
		const r = (i, j) => ((faceSeed * (i + 1) * 7 + (j + 1) * 13) % 17) - 8
		return PRODUCTION_STAGES.map((item, i) => ({
			...item,
			value: Math.max(50, Math.min(99, item.value + r(i, 0))),
			coverage: Math.max(50, Math.min(99, (item.coverage || item.value) + r(i, 1))),
		}))
	}, [
		faceSeed,
		PRODUCTION_STAGES,
		newDemoPercentRange,
		newDemoRightObjectsList,
		metricLeft,
		healthAggregationAssetIds,
	])

	const handleLeftSegmentClick = useCallback((index) => {
		setSelectedLeftStageIndex((prev) => (prev === index ? null : index))
		setSelectedRightObjectIndex(null)
	}, [])

	const handleRightSegmentClick = useCallback(
		(index) => {
			const name = rightRoseData[index]?.name
			if (
				name === "ЦД пласта" ||
				name === "Пласт" ||
				(name && name.startsWith("Пласт"))
			) {
				setCdPageNode("ЦД пласта")
				setSelectedRightObjectIndex(null)
				return
			}
			setSelectedRightObjectIndex((prev) => (prev === index ? null : index))
		},
		[rightRoseData, setCdPageNode],
	)

	const handleLifecycleStageClick = useCallback(
		(stageName) => {
			setScenarioStageFilters(
				SCENARIO_STAGE_FILTERS.reduce((acc, name) => ({ ...acc, [name]: name === stageName }), {}),
			)
			setScenariosStageFilter(stageName)
			navigate(toAppPath("scenarios"))
		},
		[
			navigate,
			toAppPath,
			setScenarioStageFilters,
			setScenariosStageFilter,
			SCENARIO_STAGE_FILTERS,
		],
	)

	const openPlanningWithHighlight = useCallback(
		(highlight) => {
			setBpmHighlight(highlight || null)
			navigate(toAppPath("planning"))
		},
		[navigate, toAppPath, setBpmHighlight],
	)

	return {
		mapPointsData,
		PRODUCTION_STAGES,
		hypercubeCaseIntro,
		selectedAssetId,
		setSelectedAssetId,
		scenarioComparisonRevision,
		selectedLeftStageIndex,
		selectedRightObjectIndex,
		selectedAssetPoint,
		assetStatus,
		assetStatusLabel,
		assetStatusIcon,
		faceSeed,
		leftRoseData,
		rightRoseData,
		handleMapAssetSelect,
		handleClearSelectedAsset,
		handleLeftSegmentClick,
		handleRightSegmentClick,
		handleLifecycleStageClick,
		openPlanningWithHighlight,
	}
}
