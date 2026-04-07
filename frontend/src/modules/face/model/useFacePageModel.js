import { useCallback, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { useFaceData } from "./useFaceData"
import { useAppStore } from "../../../core/store/appStore"
import { demoFaceMapAssetSelect } from "../lib/demoFaceMapAssetSelect"

/**
 * Общая модель главной (face): данные роз, выбор актива, переходы в сценарии/планирование.
 * @param {string} pathPrefix — "" для основного приложения, "/demo" для демо-маршрутов
 */
export function useFacePageModel(pathPrefix = "") {
	const navigate = useNavigate()

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
	} = useAppStore()

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

	const rightRoseData = useMemo(() => {
		let base =
			selectedLeftStageIndex != null
				? OBJECTS_BY_STAGE[PRODUCTION_STAGES[selectedLeftStageIndex].name] || DEFAULT_OBJECTS
				: DEFAULT_OBJECTS
		if (faceSeed === 0) return base
		const r = (i, j) => ((faceSeed * (i + 1) * 7 + (j + 1) * 11) % 17) - 8
		return base.map((item, i) => ({
			...item,
			value: Math.max(50, Math.min(99, item.value + r(i, 0))),
			coverage: Math.max(50, Math.min(99, (item.coverage || item.value) + r(i, 1))),
		}))
	}, [selectedLeftStageIndex, faceSeed, OBJECTS_BY_STAGE, PRODUCTION_STAGES, DEFAULT_OBJECTS])

	const leftRoseData = useMemo(() => {
		if (faceSeed === 0) return PRODUCTION_STAGES
		const r = (i, j) => ((faceSeed * (i + 1) * 7 + (j + 1) * 13) % 17) - 8
		return PRODUCTION_STAGES.map((item, i) => ({
			...item,
			value: Math.max(50, Math.min(99, item.value + r(i, 0))),
			coverage: Math.max(50, Math.min(99, (item.coverage || item.value) + r(i, 1))),
		}))
	}, [faceSeed, PRODUCTION_STAGES])

	const handleLeftSegmentClick = useCallback((index) => {
		setSelectedLeftStageIndex((prev) => (prev === index ? null : index))
		setSelectedRightObjectIndex(null)
	}, [])

	const handleRightSegmentClick = useCallback(
		(index) => {
			const name = rightRoseData[index]?.name
			if (name === "Пласт" || (name && name.startsWith("Пласт"))) {
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
