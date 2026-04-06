import { useCallback, useEffect, useRef, useState } from "react"
import { useFunnelData } from "./useFunnelData"
import { CASE_TREE_STEPS } from "../ui/Hypercube3D/hypercube3DCaseTree"

function toMillions(pct, scale) {
	return ((pct / 100) * scale).toFixed(2)
}

/**
 * Состояние гиперкуба: рычаги, фильтры, fullscreen, case-tree подсветка, sceneProps для сцены.
 */
export function useHypercube3DModel({ onOpenBpm, highlightCaseTree }) {
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

	const npvMillions = toMillions(npv, 800)
	const reservesMillions = toMillions(reserves, 120)
	const extractionMillions = toMillions(extraction, 15)

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
		npv,
		reserves,
		extraction,
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
	}
}
