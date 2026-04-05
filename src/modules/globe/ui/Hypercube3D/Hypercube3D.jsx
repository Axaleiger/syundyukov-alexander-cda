import React, { useState, useEffect, useRef, useCallback } from 'react'
import { loadFunnelFromExcel, buildFunnelFromEntities } from '../../../../core/data/static/loadFunnelFromExcel'
import {
  getEntityLabel as defaultGetEntityLabel,
} from '../../../../core/data/static/funnelEntities'
import { CASE_TREE_STEPS } from './hypercube3DCaseTree'
import { HypercubeLeverControls } from './HypercubeLeverControls'
import { HypercubeInfoPanel } from './HypercubeInfoPanel'
import { HypercubeCanvasShell } from './HypercubeCanvasShell'
import styles from './Hypercube3D.module.css'

function toMillions(pct, scale) {
  return ((pct / 100) * scale).toFixed(2)
}

function Hypercube3D({ onOpenBpm, highlightCaseTree }) {
  const [npv, setNpv] = useState(50)
  const [reserves, setReserves] = useState(50)
  const [extraction, setExtraction] = useState(50)
  const [selectedVariantId, setSelectedVariantId] = useState(null)
  const [selectedPlanePoint, setSelectedPlanePoint] = useState(null)
  const [filterPlanePoint, setFilterPlanePoint] = useState(null)
  const [filterByStatusKey, setFilterByStatusKey] = useState(null)
  const [filterVariantType, setFilterVariantType] = useState(null)
  const [getEntityLabel, setGetEntityLabel] = useState(() => defaultGetEntityLabel)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showRisks, setShowRisks] = useState(false)
  const cubeCanvasRef = useRef(null)

  const [hoveredPlanePoint, setHoveredPlanePoint] = useState(null)

  const handlePlanePointToggle = useCallback((levelIndex, pointIndex) => {
    const same = filterPlanePoint && filterPlanePoint.levelIndex === levelIndex && filterPlanePoint.pointIndex === pointIndex
    if (same) {
      setFilterPlanePoint(null)
      setSelectedPlanePoint(null)
    } else {
      setFilterPlanePoint({ levelIndex, pointIndex })
      setSelectedPlanePoint({ levelIndex, pointIndex })
    }
  }, [filterPlanePoint])

  useEffect(() => {
    loadFunnelFromExcel()
      .then(buildFunnelFromEntities)
      .then((built) => {
        if (built && built.getEntityLabel) setGetEntityLabel(() => built.getEntityLabel)
      })
      .catch(() => {})
  }, [])

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
    } else {
      setCaseTreeRevealStep(-1)
    }
  }, [highlightCaseTree, maxCaseTreeStep])

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
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

  return (
    <div className={styles.root}>
      <HypercubeLeverControls
        npv={npv}
        setNpv={setNpv}
        reserves={reserves}
        setReserves={setReserves}
        extraction={extraction}
        setExtraction={setExtraction}
        npvMillions={npvMillions}
        reservesMillions={reservesMillions}
        extractionMillions={extractionMillions}
      />

      <div className={styles.visualization}>
        <HypercubeInfoPanel
          npvMillions={npvMillions}
          reservesMillions={reservesMillions}
          extractionMillions={extractionMillions}
          filterVariantType={filterVariantType}
          setFilterVariantType={setFilterVariantType}
          showRisks={showRisks}
          setShowRisks={setShowRisks}
        />
        <HypercubeCanvasShell
          cubeCanvasRef={cubeCanvasRef}
          isFullscreen={isFullscreen}
          selectedVariantId={selectedVariantId}
          highlightCaseTree={highlightCaseTree}
          onCloseFunnel={closeFunnel}
          onToggleFullscreen={handleToggleFullscreen}
          sceneProps={sceneProps}
        />
      </div>

      <div className={styles.instructions}>
        <p>Наведите на названия рычагов (NPV, Запасы, Добыча) в блоке выше для полного описания. Точки куба — варианты сценариев; точки на плоскостях воронки — по статусу ЦД (см. легенду). Нажмите на точку куба — откроется воронка сквозных сценариев.</p>
      </div>
    </div>
  )
}

export default Hypercube3D
