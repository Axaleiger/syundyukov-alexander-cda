import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useFunnelData } from "./useFunnelData"
import { CASE_TREE_STEPS } from "../ui/Hypercube3D/hypercube3DCaseTree"
import { getHypercubeBaseForAsset, HYPERCUBE_SCALE_MAX } from "./hypercubeAssetBases.js"

function toMillions(pct, scale) {
	return ((pct / 100) * scale).toFixed(2)
}

function factorNpv(slider) {
	return 0.75 + 0.5 * (slider / 100)
}

function factorReserves(slider) {
	return 0.9 + 0.2 * (slider / 100)
}

function factorExtraction(slider) {
	return 0.85 + 0.3 * (slider / 100)
}

function clampScene(v, maxScale) {
	if (!maxScale || maxScale <= 0) return 0
	return Math.max(0, Math.min(100, (v / maxScale) * 100))
}

/**
 * Состояние гиперкуба: рычаги, фильтры, fullscreen, case-tree подсветка, sceneProps для сцены.
 * @param {object} opts
 * @param {string | null | undefined} [opts.selectedAssetId] — выбранный актив (new-demo)
 * @param {boolean} [opts.useAssetHypercubeBases] — базы и ±% от hypercubeAssetBases.js
 */
export function useHypercube3DModel({
	onOpenBpm,
	highlightCaseTree,
	selectedAssetId,
	useAssetHypercubeBases = false,
}) {
	const { pointsPerLevel, getEntityLabel } = useFunnelData()
	const [npv, setNpv] = useState(50)
	const [reserves, setReserves] = useState(50)
	const [extraction, setExtraction] = useState(50)
	const [selectedVariantId, setSelectedVariantId] = useState(null)
	const [selectedPlanePoint, setSelectedPlanePoint] = useState(null)
	const [filterPlanePoint, setFilterPlanePoint] = useState(null)
	const [filterByStatusKey, setFilterByStatusKey] = useState(null)
	const [filterVariantType, setFilterVariantType] = useState(null)
	const [isFullscreen, setIsFullscreen] = useState(false)
	const [showRisks, setShowRisks] = useState(false)
	const cubeCanvasRef = useRef(null)

	const [hoveredPlanePoint, setHoveredPlanePoint] = useState(null)

	const handlePlanePointToggle = useCallback(
		(levelIndex, pointIndex) => {
			const same =
				filterPlanePoint &&
				filterPlanePoint.levelIndex === levelIndex &&
				filterPlanePoint.pointIndex === pointIndex
			if (same) {
				setFilterPlanePoint(null)
				setSelectedPlanePoint(null)
			} else {
				setFilterPlanePoint({ levelIndex, pointIndex })
				setSelectedPlanePoint({ levelIndex, pointIndex })
			}
		},
		[filterPlanePoint],
	)

	const [caseTreeRevealStep, setCaseTreeRevealStep] = useState(-1)

	const maxCaseTreeStep = CASE_TREE_STEPS.length + 2 - 1
	useEffect(() => {
		if (highlightCaseTree) {
			setSelectedVariantId(0)
			setCaseTreeRevealStep(0)
			const iv = setInterval(() => {
				setCaseTreeRevealStep((s) => (s >= maxCaseTreeStep ? s : s + 1))
			}, 550)
			return () => clearInterval(iv)
		}
		setCaseTreeRevealStep(-1)
		return undefined
	}, [highlightCaseTree, maxCaseTreeStep])

	useEffect(() => {
		const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
		document.addEventListener("fullscreenchange", onFullscreenChange)
		return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
	}, [])

	const assetBase = useMemo(
		() => (useAssetHypercubeBases ? getHypercubeBaseForAsset(selectedAssetId) : null),
		[useAssetHypercubeBases, selectedAssetId],
	)

	useEffect(() => {
		if (!useAssetHypercubeBases) return
		setNpv(50)
		setReserves(50)
		setExtraction(50)
	}, [selectedAssetId, useAssetHypercubeBases])

	const npvMillions = useMemo(() => {
		if (!useAssetHypercubeBases) return toMillions(npv, 800)
		const v = assetBase.npv * factorNpv(npv)
		return v.toFixed(2)
	}, [useAssetHypercubeBases, assetBase, npv])

	const reservesMillions = useMemo(() => {
		if (!useAssetHypercubeBases) return toMillions(reserves, 120)
		const v = assetBase.reserves * factorReserves(reserves)
		return v.toFixed(2)
	}, [useAssetHypercubeBases, assetBase, reserves])

	const extractionMillions = useMemo(() => {
		if (!useAssetHypercubeBases) return toMillions(extraction, 15)
		const v = assetBase.extraction * factorExtraction(extraction)
		return v.toFixed(2)
	}, [useAssetHypercubeBases, assetBase, extraction])

	const sceneNpv = useMemo(() => {
		if (!useAssetHypercubeBases) return npv
		const v = assetBase.npv * factorNpv(npv)
		return clampScene(v, HYPERCUBE_SCALE_MAX.npv)
	}, [useAssetHypercubeBases, assetBase, npv])

	const sceneReserves = useMemo(() => {
		if (!useAssetHypercubeBases) return reserves
		const v = assetBase.reserves * factorReserves(reserves)
		return clampScene(v, HYPERCUBE_SCALE_MAX.reserves)
	}, [useAssetHypercubeBases, assetBase, reserves])

	const sceneExtraction = useMemo(() => {
		if (!useAssetHypercubeBases) return extraction
		const v = assetBase.extraction * factorExtraction(extraction)
		return clampScene(v, HYPERCUBE_SCALE_MAX.extraction)
	}, [useAssetHypercubeBases, assetBase, extraction])

	const closeFunnel = useCallback(() => {
		setSelectedVariantId(null)
		setSelectedPlanePoint(null)
		setFilterPlanePoint(null)
	}, [])

	const handleToggleFullscreen = useCallback(() => {
		if (!cubeCanvasRef.current) return
		if (isFullscreen) {
			document.exitFullscreen?.()
			setIsFullscreen(false)
		} else {
			cubeCanvasRef.current.requestFullscreen?.()
			setIsFullscreen(true)
		}
	}, [isFullscreen])

	const sceneProps = {
		npv: sceneNpv,
		reserves: sceneReserves,
		extraction: sceneExtraction,
		pointsPerLevel,
		onPointClick: setSelectedVariantId,
		selectedVariantId,
		onCloseVariant: closeFunnel,
		selectedPlanePoint,
		onPlanePointClick: (levelIndex, pointIndex) => setSelectedPlanePoint({ levelIndex, pointIndex }),
		onPlanePointToggle: handlePlanePointToggle,
		onPlanePointHover: setHoveredPlanePoint,
		hoveredPlanePoint,
		filterPlanePoint,
		filterByStatusKey,
		filterVariantType,
		onOpenBpm,
		getEntityLabel,
		showRisks,
		highlightCaseTree,
		caseTreeRevealStep,
	}

	return {
		npv,
		setNpv,
		reserves,
		setReserves,
		extraction,
		setExtraction,
		npvMillions,
		reservesMillions,
		extractionMillions,
		filterVariantType,
		setFilterVariantType,
		showRisks,
		setShowRisks,
		cubeCanvasRef,
		isFullscreen,
		selectedVariantId,
		highlightCaseTree,
		closeFunnel,
		handleToggleFullscreen,
		sceneProps,
		useAssetHypercubeBases,
	}
}
