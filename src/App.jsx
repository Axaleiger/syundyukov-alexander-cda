import React, { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import './App.css'
import RussiaGlobe from './components/RussiaGlobe'
import WindRose from './components/WindRose'
import { PRODUCTION_STAGES, OBJECTS_BY_STAGE, DEFAULT_OBJECTS } from './data/rosesData'
import Hypercube3D from './components/Hypercube3D'
import LifecycleChart from './components/LifecycleChart'
import CDPage from './components/CDPage'
import RightPanel from './components/RightPanel'

const BPMBoard = lazy(() => import('./components/BPMBoard'))
import AIAssistantWidget from './components/AIAssistantWidget'
import ScenariosList from './components/ScenariosList'
import OntologyTab, { DEFAULT_FLOW_CODE, getSchemaFromFlowCode } from './components/OntologyTab'
import { bpmToMermaid } from './lib/bpmToMermaid'
import { getScenarioGraphNodesFromBoard } from './lib/planningGraphNodes'
import ConfiguratorDocPage from './components/ConfiguratorDocPage'
import ResultsTab from './components/ResultsTab'
import AdminTab from './components/AdminTab'
import ThinkingPanelBody from './components/ThinkingPanelBody'
import FaceScenarioOverlay from './components/FaceScenarioOverlay'
import NavTabIcon from './components/NavTabIcon'
import { OPTIMAL_SCENARIO_VARIANT } from './lib/scenarioGraphData'
import { getAssetStatus, getAssetStatusLabel, getAssetStatusIcon } from './data/assetStatus'
import { SCENARIO_STAGE_FILTERS } from './data/scenariosData'
import mapPointsData from './data/mapPoints.json'

const ADMIN_SUB_TABS = [
  { id: 'roles', label: 'Ролевая модель' },
  { id: 'catalog', label: 'Каталог сервисов' },
  { id: 'integration', label: 'Заявки на интеграцию' },
  { id: 'changes', label: 'Заявки на доработку сервисов' },
  { id: 'add-service', label: 'Заявки на добавление своего сервиса' },
]

const TABS = [
  { id: 'face', label: 'Главная страница', icon: 'home' },
  { id: 'scenarios', label: 'Список сценариев', icon: 'list' },
  { id: 'planning', label: 'Планирование', icon: 'calendar' },
  { id: 'ontology', label: 'Конфигуратор систем', icon: 'gear' },
  { id: 'results', label: 'Результаты', icon: 'chart' },
  { id: 'admin', label: 'Администрирование', icon: 'admin', separatorBefore: true },
]

function getBpmPageUrl(highlight) {
  const base = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}bpm=1&highlight=${encodeURIComponent(highlight || '')}`
}

function getBoardIdForAsset(assetId) {
  if (assetId === 'do-megion') return 'mgn'
  if (assetId === 'do-noyabrsk' || assetId === 'novy-port') return 'nng'
  return 'hantos'
}

function parseTabFromHash() {
  const hash = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#/, '') || 'face'
  const serviceMatch = hash.match(/^\/?service\/(.+)$/)
  if (serviceMatch) return { tab: 'planning', adminSub: 'roles', servicePageName: decodeURIComponent(serviceMatch[1]) }
  if (hash.startsWith('admin-')) {
    const sub = hash.slice(6)
    const valid = ADMIN_SUB_TABS.some((t) => t.id === sub)
    return { tab: 'admin', adminSub: valid ? sub : 'roles', servicePageName: null }
  }
  const valid = TABS.some((t) => t.id === hash)
  return { tab: valid ? hash : 'face', adminSub: 'roles', servicePageName: null }
}

function readDemoModeFlag() {
  if (typeof window === 'undefined') return false
  const v = new URLSearchParams(window.location.search).get('demo')
  return v === 'portrait' || v === '1' || v === 'stand'
}

function readDemoStandFlag() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('demo') === 'stand'
}

function App() {
  const [demoMode] = useState(readDemoModeFlag)
  const [demoStand] = useState(readDemoStandFlag)
  const [faceSelectedScenarioTitle, setFaceSelectedScenarioTitle] = useState(null)
  const faceSelectedScenarioTitleRef = useRef(null)
  useEffect(() => {
    faceSelectedScenarioTitleRef.current = faceSelectedScenarioTitle
  }, [faceSelectedScenarioTitle])
  const [agreedInfluenceLine, setAgreedInfluenceLine] = useState(null)
  const [hudPanelExpanded, setHudPanelExpanded] = useState(null)

  useEffect(() => {
    if (!demoMode) return
    document.body.classList.add('body-demo')
    return () => document.body.classList.remove('body-demo')
  }, [demoMode])

  useEffect(() => {
    if (!demoStand) return
    document.documentElement.classList.add('demo-stand-4k-root')
    document.body.classList.add('demo-stand-4k')
    return () => {
      document.documentElement.classList.remove('demo-stand-4k-root')
      document.body.classList.remove('demo-stand-4k')
    }
  }, [demoStand])

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'face'
    return parseTabFromHash().tab
  })

  const demoHudPanelsRowRef = useRef(null)

  const [servicePageName, setServicePageName] = useState(() => {
    if (typeof window === 'undefined') return null
    const h = window.location.hash.replace(/^#/, '')
    const m = h.match(/^\/?service\/(.+)$/)
    return m ? decodeURIComponent(m[1]) : null
  })
  const [selectedLeftStageIndex, setSelectedLeftStageIndex] = useState(null)
  const [selectedRightObjectIndex, setSelectedRightObjectIndex] = useState(null)
  const [cdPageNode, setCdPageNode] = useState(null)
  const [showBpm, setShowBpm] = useState(false)
  const [bpmHighlight, setBpmHighlight] = useState(null)
  const [selectedAssetId, setSelectedAssetId] = useState(null)
  const [scenariosStageFilter, setScenariosStageFilter] = useState(null)
  const [scenarioStageFilters, setScenarioStageFilters] = useState(() =>
    SCENARIO_STAGE_FILTERS.reduce((acc, name) => ({ ...acc, [name]: true }), {})
  )
  const [scenarioComparisonRevision, setScenarioComparisonRevision] = useState(0)
  const [adminSubTab, setAdminSubTab] = useState(() => {
    if (typeof window === 'undefined') return 'roles'
    return parseTabFromHash().adminSub
  })
  const [showConfiguratorDoc, setShowConfiguratorDoc] = useState(false)
  const [flowCode, setFlowCode] = useState(DEFAULT_FLOW_CODE)
  const [selectedScenarioName, setSelectedScenarioName] = useState('Управление добычей с учетом ближайшего бурения')
  const [aiMode, setAiMode] = useState(false)
  const [bpmCommand, setBpmCommand] = useState(null)
  const [configuratorNodeCommand, setConfiguratorNodeCommand] = useState(null)
  const [resultsDashboardFocus, setResultsDashboardFocus] = useState(null)
  const bpmCommandConsumedRef = useRef(null)
  const [thinkingSteps, setThinkingSteps] = useState([])
  const [thinkingCurrentMessage, setThinkingCurrentMessage] = useState('')
  const [thinkingPaused, setThinkingPaused] = useState(false)
  const [thinkingPanelOpen, setThinkingPanelOpen] = useState(false)
  useEffect(() => {
    if (typeof document === 'undefined') return
    const prev = document.body.style.overflow
    if (thinkingPanelOpen) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [thinkingPanelOpen])
  const addThinkingStep = useCallback((label) => {
    setThinkingSteps((s) => {
      if (s.length && s[s.length - 1]?.label === label) return s
      return [...s, { id: `step-${Date.now()}-${s.length}-${Math.random().toString(36).slice(2)}`, label, status: 'done' }]
    })
    setThinkingCurrentMessage(label)
  }, [])
  const [thinkingGraphNodes, setThinkingGraphNodes] = useState([])
  const thinkingChainRevealedRef = useRef(false)
  const [brainPanelOpenKey, setBrainPanelOpenKey] = useState(0)
  const prevThinkingPanelOpenRef = useRef(thinkingPanelOpen)
  useEffect(() => {
    if (thinkingPanelOpen && !prevThinkingPanelOpenRef.current) {
      setBrainPanelOpenKey((k) => k + 1)
      thinkingChainRevealedRef.current = false
    }
    prevThinkingPanelOpenRef.current = thinkingPanelOpen
  }, [thinkingPanelOpen])
  const resetThinkingChain = useCallback(() => { thinkingChainRevealedRef.current = false }, [])
  const [thinkingAwaitingConfirm, setThinkingAwaitingConfirm] = useState(false)
  const [thinkingConfirmPhase, setThinkingConfirmPhase] = useState(null)
  const thinkingConfirmPhaseRef = useRef(null)
  thinkingConfirmPhaseRef.current = thinkingConfirmPhase
  const setThinkingPhase = useCallback((phase) => setThinkingConfirmPhase(phase), [])
  const thinkingConfirmResolverRef = useRef(null)
  const requestUserConfirm = useCallback((label, options) => {
    setThinkingPanelOpen(true)
    thinkingChainRevealedRef.current = false
    setThinkingPaused(false)
    setThinkingAwaitingConfirm(true)
    const phase = options?.phase ?? 'planning'
    const refreshScenarioPanel = !!options?.refreshScenarioPanel
    setThinkingConfirmPhase(phase)
    setThinkingCurrentMessage(label)
    return new Promise((resolve) => {
      thinkingConfirmResolverRef.current = () => {
        setThinkingAwaitingConfirm(false)
        if (refreshScenarioPanel) {
          setScenarioComparisonRevision((n) => n + 1)
        }
        if (thinkingConfirmPhaseRef.current !== 'brain') setThinkingConfirmPhase(null)
        thinkingConfirmResolverRef.current = null
        resolve()
      }
    })
  }, [])
  const handleThinkingConfirm = useCallback(() => {
    const wasBrain = thinkingConfirmPhaseRef.current === 'brain'
    if (selectedDecisionPathIdRef.current) {
      setAppliedDecisionPathId(selectedDecisionPathIdRef.current)
    }
    if (thinkingConfirmResolverRef.current) {
      thinkingConfirmResolverRef.current()
    }
    if (wasBrain && selectedAssetId) {
      const title = faceSelectedScenarioTitleRef.current || `Вариант ${OPTIMAL_SCENARIO_VARIANT}`
      setAgreedInfluenceLine(`Влияние предложенного «${title}» на актив`)
      setScenarioComparisonRevision((n) => n + 1)
    }
    setThinkingPanelOpen(false)
    setThinkingCurrentMessage('')
    setThinkingPaused(false)
    setThinkingConfirmPhase(null)
  }, [selectedAssetId])
  const [bpmStages, setBpmStages] = useState(null)
  const [bpmTasks, setBpmTasks] = useState(null)
  const handleBoardChange = useCallback((stages, tasks) => {
    setFlowCode(bpmToMermaid(stages, tasks))
    setBpmStages(stages)
    setBpmTasks(tasks)
  }, [])
  const [openConfiguratorFromPlanning, setOpenConfiguratorFromPlanning] = useState(false)
  const [configuratorInitialNodes, setConfiguratorInitialNodes] = useState(null)
  const [configuratorInitialEdges, setConfiguratorInitialEdges] = useState(null)
  const configuratorSchemaRef = useRef(null)
  const [hypercubeCaseIntro, setHypercubeCaseIntro] = useState(false)

  const [selectedDecisionPathId, setSelectedDecisionPathId] = useState(null)
  const [appliedDecisionPathId, setAppliedDecisionPathId] = useState(null)
  const selectedDecisionPathIdRef = useRef(null)
  selectedDecisionPathIdRef.current = selectedDecisionPathId
  const onBpmCommandConsumed = useCallback((opts) => {
    setBpmCommand(null)
    if (opts?.flowCode) setFlowCode(opts.flowCode)
    if (opts?.switchToOntology !== false) {
      const codeForSchema = opts?.flowCode ?? flowCode
      requestUserConfirm('Проверьте сквозной бизнес-сценарий на доске планирования и нажмите «Согласовать», чтобы построить схему в Конфигураторе систем.', { phase: 'brain' })
        .then(() => {
          const schema = getSchemaFromFlowCode(codeForSchema)
          configuratorSchemaRef.current = schema?.nodes?.length
            ? { nodes: schema.nodes, edges: schema.edges || [] }
            : { flowCode: codeForSchema }
          if (schema?.nodes?.length) {
            setConfiguratorInitialNodes(schema.nodes)
            setConfiguratorInitialEdges(schema.edges || [])
          }
          setShowBpm(false)
          setActiveTab('ontology')
          setOpenConfiguratorFromPlanning(true)
        })
    }
    bpmCommandConsumedRef.current?.()
  }, [requestUserConfirm, flowCode])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const cd = params.get('cd')
    if (cd) setCdPageNode(decodeURIComponent(cd))
    if (params.get('bpm') === '1') {
      setShowBpm(true)
      setBpmHighlight(params.get('highlight') || null)
      return
    }
  }, [])

  useEffect(() => {
    if (activeTab !== 'ontology') {
      setOpenConfiguratorFromPlanning(false)
    }
  }, [activeTab])

  const graphNodesForThinking = useMemo(() => {
    if (bpmStages?.length && bpmTasks) {
      const fromBoard = getScenarioGraphNodesFromBoard(bpmStages, bpmTasks)
      if (fromBoard.length) return fromBoard
    }
    return thinkingGraphNodes
  }, [bpmStages, bpmTasks, thinkingGraphNodes])
  const isThinkingDrawerCollapsed = activeTab === 'planning' || activeTab === 'ontology'
  const showCollapsedBrainMinimal = isThinkingDrawerCollapsed && thinkingConfirmPhase === 'brain'

  const handleRecalculateDecision = useCallback(() => {
    if (!selectedDecisionPathIdRef.current) return
    setBpmCommand({ scenarioId: 'createPlanningCase', params: { topic: selectedDecisionPathIdRef.current } })
  }, [setBpmCommand])


  useEffect(() => {
    if (showBpm) return
    if (typeof window !== 'undefined' && /^\/?service\//.test(window.location.hash.replace(/^#/, ''))) return
    const hash = activeTab === 'admin' ? `#admin-${adminSubTab}` : `#${activeTab}`
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', hash)
    }
  }, [activeTab, adminSubTab, showBpm])

  useEffect(() => {
    const onHashChange = () => {
      if (window.location.search.includes('bpm=1')) return
      const { tab, adminSub, servicePageName: svc } = parseTabFromHash()
      // Если пользователь уже находится в конфигураторе систем,
      // не даём внешним изменениям hash самопроизвольно переключать вкладку.
      setActiveTab((prev) => (prev === 'ontology' ? prev : tab))
      setAdminSubTab(adminSub)
      setServicePageName(svc ?? null)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const faceSeed = useMemo(() => {
    if (!selectedAssetId) return 0
    return Math.abs(selectedAssetId.split('').reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0) | 0, 0))
  }, [selectedAssetId])

  const rightRoseData = useMemo(() => {
    let base = selectedLeftStageIndex != null
      ? (OBJECTS_BY_STAGE[PRODUCTION_STAGES[selectedLeftStageIndex].name] || DEFAULT_OBJECTS)
      : DEFAULT_OBJECTS
    if (faceSeed === 0) return base
    const r = (i, j) => ((faceSeed * (i + 1) * 7 + (j + 1) * 11) % 17) - 8
    return base.map((item, i) => ({
      ...item,
      value: Math.max(50, Math.min(99, item.value + r(i, 0))),
      coverage: Math.max(50, Math.min(99, (item.coverage || item.value) + r(i, 1))),
    }))
  }, [selectedLeftStageIndex, faceSeed])

  const leftRoseData = useMemo(() => {
    if (faceSeed === 0) return PRODUCTION_STAGES
    const r = (i, j) => ((faceSeed * (i + 1) * 7 + (j + 1) * 13) % 17) - 8
    return PRODUCTION_STAGES.map((item, i) => ({
      ...item,
      value: Math.max(50, Math.min(99, item.value + r(i, 0))),
      coverage: Math.max(50, Math.min(99, (item.coverage || item.value) + r(i, 1))),
    }))
  }, [faceSeed])

  const handleLeftSegmentClick = (index) => {
    setSelectedLeftStageIndex((prev) => (prev === index ? null : index))
    setSelectedRightObjectIndex(null)
  }

  const handleRightSegmentClick = (index) => {
    const name = rightRoseData[index]?.name
    if (name === 'Пласт' || (name && name.startsWith('Пласт'))) {
      setCdPageNode('ЦД пласта')
      setSelectedRightObjectIndex(null)
      return
    }
    setSelectedRightObjectIndex((prev) => (prev === index ? null : index))
  }

  const handleMapAssetSelect = (pointId) => {
    setSelectedAssetId(pointId || null)
    setActiveTab('face')
    setScenarioComparisonRevision(0)
    setFaceSelectedScenarioTitle(null)
    setAgreedInfluenceLine(null)
  }

  const handleThinkingPanelSoftClose = useCallback(() => {
    setThinkingPanelOpen(false)
    setThinkingCurrentMessage('')
    setThinkingPaused(false)
  }, [])

  const showThinkingHologram = demoMode && activeTab === 'face'

  const handleLifecycleStageClick = (stageName) => {
    setScenarioStageFilters(SCENARIO_STAGE_FILTERS.reduce((acc, name) => ({ ...acc, [name]: name === stageName }), {}))
    setScenariosStageFilter(stageName)
    setActiveTab('scenarios')
  }

  const selectedAssetPoint = selectedAssetId ? mapPointsData.find((p) => p.id === selectedAssetId) : null
  const assetStatus = selectedAssetId ? getAssetStatus(selectedAssetId) : null
  const assetStatusLabel = assetStatus ? getAssetStatusLabel(assetStatus) : null
  const assetStatusIcon = assetStatus ? getAssetStatusIcon(assetStatus) : null

  if (cdPageNode) {
    return (
      <div className="app">
        <CDPage nodeName={cdPageNode} onBack={() => { setCdPageNode(null); if (window.history.length > 1) window.history.back(); else window.close(); }} />
      </div>
    )
  }

  if (showConfiguratorDoc) {
    return (
      <div className="app">
        <ConfiguratorDocPage onClose={() => setShowConfiguratorDoc(false)} />
      </div>
    )
  }

  if (showBpm) {
    return (
      <div className="app">
        <Suspense fallback={<div className="bpm-loading">Загрузка…</div>}>
          <BPMBoard
            highlightCardName={bpmHighlight}
            onClose={() => { setShowBpm(false); setBpmHighlight(null) }}
            aiMode={aiMode}
            setAiMode={setAiMode}
            bpmCommand={bpmCommand}
            onBpmCommandConsumed={onBpmCommandConsumed}
          />
        </Suspense>
        <AIAssistantWidget
          visible={aiMode}
          setActiveTab={setActiveTab}
          setBpmCommand={setBpmCommand}
          setResultsDashboardFocus={setResultsDashboardFocus}
          setHypercubeCaseIntro={setHypercubeCaseIntro}
          setShowBpm={setShowBpm}
          setThinkingPhase={setThinkingPhase}
          setThinkingGraphNodes={setThinkingGraphNodes}
          resetThinkingChain={resetThinkingChain}
          requestUserConfirm={requestUserConfirm}
          onBpmCommandConsumedRef={bpmCommandConsumedRef}
          onThinkingPanelOpen={setThinkingPanelOpen}
          isThinkingPanelOpen={thinkingPanelOpen}
          thinkingSteps={thinkingSteps}
          currentMessage={thinkingCurrentMessage}
          isPaused={thinkingPaused}
          addThinkingStep={addThinkingStep}
          setThinkingSteps={setThinkingSteps}
          setCurrentMessage={setThinkingCurrentMessage}
          setIsPaused={setThinkingPaused}
        />
        {thinkingPanelOpen && (
          <>
            <div className="app-thinking-overlay" onClick={() => setThinkingPanelOpen(false)} aria-hidden />
            <div className={`app-thinking-drawer ${isThinkingDrawerCollapsed ? 'app-thinking-drawer--collapsed' : ''}`}>
              <div className="app-thinking-drawer-head">
                <h3 className="app-thinking-drawer-title">Режим мышления</h3>
                <button type="button" className="app-thinking-drawer-close" onClick={() => setThinkingPanelOpen(false)} aria-label="Закрыть">×</button>
              </div>
              <div className="app-thinking-drawer-body">
                <ThinkingPanelBody
                  showCollapsedBrainMinimal={showCollapsedBrainMinimal}
                  thinkingConfirmPhase={thinkingConfirmPhase}
                  thinkingSteps={thinkingSteps}
                  graphNodesForThinking={graphNodesForThinking}
                  thinkingChainRevealedRef={thinkingChainRevealedRef}
                  brainPanelOpenKey={brainPanelOpenKey}
                  selectedDecisionPathId={selectedDecisionPathId}
                  appliedDecisionPathId={appliedDecisionPathId}
                  setSelectedDecisionPathId={setSelectedDecisionPathId}
                  handleRecalculateDecision={handleRecalculateDecision}
                  thinkingAwaitingConfirm={thinkingAwaitingConfirm}
                  handleThinkingConfirm={handleThinkingConfirm}
                  thinkingCurrentMessage={thinkingCurrentMessage}
                  thinkingPaused={thinkingPaused}
                  setThinkingPaused={setThinkingPaused}
                  onClosePanel={handleThinkingPanelSoftClose}
                />
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  const staticBase = `${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}`
  const standFaceHeader = demoStand && activeTab === 'face'

  return (
    <div
      className={`app app-with-sidebar${demoMode ? ' app--demo' : ''}${demoStand ? ' app--demo-stand-4k' : ''}${standFaceHeader ? ' app--demo-stand-face' : ''}`}
    >
      {demoMode && activeTab === 'face' && (
        <div className="app-demo-globe-fixed">
          <div className="app-demo-globe-transform">
            <RussiaGlobe
              immersiveBackground
              demoLarge
              standLayout={demoStand}
              onAssetSelect={handleMapAssetSelect}
            />
          </div>
        </div>
      )}
      <header className="app-header">
        <img
          src={standFaceHeader ? `${staticBase}/gazprom-neft-logo.png` : `${staticBase}/emblem.png`}
          alt={standFaceHeader ? 'Цифровой двойник актива' : 'Оркестратор актива'}
          className={`app-header-emblem${standFaceHeader ? ' app-header-emblem--stand-gpn' : ''}`}
        />
        <div className="app-header-text">
          <h1>{standFaceHeader ? 'Цифровой двойник актива' : 'Оркестратор актива'}</h1>
        </div>
        <div className="app-header-actions">
          <button
            type="button"
            className={`app-header-ai-toggle ${aiMode ? 'app-header-ai-toggle-on' : ''}`}
            onClick={() => setAiMode(!aiMode)}
            title={aiMode ? 'Выключить ИИ-режим' : 'Включить ИИ-режим'}
          >
            {aiMode && <span className="app-header-ai-spinner" aria-hidden />}
            <span className="app-header-ai-toggle-text">ИИ-режим</span>
          </button>
          <div className="app-header-user">
            <span className="app-header-user-name">Сюндюков А.В. · Ведущий эксперт</span>
            <img src={`${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/sanya-bodibilder.png`} alt="" className="app-header-user-avatar" />
          </div>
        </div>
      </header>

      {selectedAssetId && selectedAssetPoint && assetStatus && !(demoMode && activeTab === 'face') && (
        <div className={`app-asset-sticky${demoMode ? ' app-asset-sticky--demo' : ''}`}>
          <span className="app-asset-sticky-name">{selectedAssetPoint.name}</span>
          {agreedInfluenceLine && (
            <span className="app-asset-sticky-influence" title={agreedInfluenceLine}>
              {agreedInfluenceLine}
            </span>
          )}
          <span className="app-asset-sticky-status">{assetStatusLabel}</span>
          {assetStatusIcon && (
            <span className={`app-asset-sticky-icon app-asset-sticky-icon-${assetStatusIcon.color}`} title={assetStatusLabel}>
              {assetStatusIcon.type === 'check' && '✓'}
              {assetStatusIcon.type === 'exclamation' && '!'}
              {assetStatusIcon.type === 'question' && '?'}
            </span>
          )}
          <button
            type="button"
            className="app-asset-sticky-close"
            onClick={() => {
              setSelectedAssetId(null)
              setAgreedInfluenceLine(null)
              setFaceSelectedScenarioTitle(null)
            }}
            aria-label="Сбросить"
          >
            ×
          </button>
        </div>
      )}

      {demoMode && activeTab === 'face' && selectedAssetId && selectedAssetPoint && assetStatus && (
        <div className="demo-float-asset-bar glass-panel demo-glass--light" role="status" aria-live="polite">
          <span className="app-asset-sticky-name">{selectedAssetPoint.name}</span>
          {agreedInfluenceLine && (
            <>
              <span className="demo-float-asset-sep" aria-hidden>|</span>
              <span className="app-asset-sticky-influence demo-float-asset-influence" title={agreedInfluenceLine}>
                {agreedInfluenceLine}
              </span>
            </>
          )}
          <span className="app-asset-sticky-status">{assetStatusLabel}</span>
          {assetStatusIcon && (
            <span className={`app-asset-sticky-icon app-asset-sticky-icon-${assetStatusIcon.color}`} title={assetStatusLabel}>
              {assetStatusIcon.type === 'check' && '✓'}
              {assetStatusIcon.type === 'exclamation' && '!'}
              {assetStatusIcon.type === 'question' && '?'}
            </span>
          )}
          <button
            type="button"
            className="app-asset-sticky-close"
            onClick={() => {
              setSelectedAssetId(null)
              setAgreedInfluenceLine(null)
              setFaceSelectedScenarioTitle(null)
            }}
            aria-label="Сбросить"
          >
            ×
          </button>
        </div>
      )}

      <div className={`app-body${demoMode && activeTab === 'face' ? ' app-body--immersive-face' : ''}`}>
        <nav className={`app-sidebar${demoMode ? ' app-sidebar--icons' : ''}`}>
          {TABS.map((t) => (
            <React.Fragment key={t.id}>
              {t.separatorBefore && <hr className="app-sidebar-divider" />}
              <button
                type="button"
                className={`app-sidebar-tab ${activeTab === t.id ? 'app-sidebar-tab-active' : ''}`}
                onClick={() => setActiveTab(t.id)}
                title={t.label}
                aria-label={t.label}
              >
                {demoMode ? <NavTabIcon name={t.icon} /> : t.label}
              </button>
            </React.Fragment>
          ))}
        </nav>

        {activeTab === 'scenarios' && (
          <nav className={`app-sidebar app-sidebar-secondary${demoMode ? ' app-sidebar-secondary--demo' : ''}`}>
            {SCENARIO_STAGE_FILTERS.map((name) => (
              <button
                key={name}
                type="button"
                className={`app-sidebar-tab ${scenarioStageFilters[name] ? 'app-sidebar-tab-active' : ''}`}
                onClick={() => {
                setScenarioStageFilters((prev) => ({ ...prev, [name]: !prev[name] }))
                setScenariosStageFilter(null)
              }}
              >
                {name}
              </button>
            ))}
          </nav>
        )}

        {activeTab === 'admin' && (
          <nav className={`app-sidebar app-sidebar-secondary${demoMode ? ' app-sidebar-secondary--demo' : ''}`}>
            {ADMIN_SUB_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`app-sidebar-tab ${adminSubTab === t.id ? 'app-sidebar-tab-active' : ''}`}
                onClick={() => setAdminSubTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        )}

        <main className={`app-main${demoMode ? ' app-main--demo' : ''}${demoMode && activeTab === 'face' ? ' app-main--demo-immersive' : ''}`}>
          {activeTab === 'scenarios' && (
            <ScenariosList
              activeStageFilter={scenariosStageFilter}
              stageFilters={scenarioStageFilters}
              onStageFilterToggle={(name) => setScenarioStageFilters((prev) => ({ ...prev, [name]: !prev[name] }))}
              onScenarioClick={(row) => {
                if (row?.name) {
                  const displayName = row.name.replace(/\s*\(раздел\s*"[^"]*"\)\s*$/i, '').trim() || row.name
                  setSelectedScenarioName(displayName)
                  setActiveTab('planning')
                }
              }}
            />
          )}

          {activeTab === 'face' && !demoMode && (
            <div className="app-content app-content-face">
              <section className="section map-section">
                <h2>Карта объектов Оркестратора актива</h2>
                <RussiaGlobe onAssetSelect={handleMapAssetSelect} />
              </section>

              <section className="section wind-rose-section">
                <h2 className="wind-rose-section-title">Карта здоровья цифровых двойников</h2>
                <div className="wind-rose-container">
                  <div className="wind-rose-item">
                    <h3>ЦД производственных этапов</h3>
                    <WindRose
                      type="left"
                      data={leftRoseData}
                      centerTitle="ЦД этапов"
                      selectedIndex={selectedLeftStageIndex}
                      onSegmentClick={handleLeftSegmentClick}
                    />
                  </div>
                  <div className="wind-rose-item">
                    <h3>ЦД объектов</h3>
                    <WindRose
                      type="right"
                      data={rightRoseData}
                      centerTitle={selectedLeftStageIndex != null ? PRODUCTION_STAGES[selectedLeftStageIndex].name : 'ЦД объектов'}
                      selectedIndex={selectedRightObjectIndex}
                      onSegmentClick={handleRightSegmentClick}
                    />
                  </div>
                </div>
              </section>

              <section className={`section hypercube-section ${hypercubeCaseIntro ? 'hypercube-case-intro' : ''}`}>
                <h2>Гиперкуб рычагов влияния</h2>
                <Hypercube3D
                  highlightCaseTree={hypercubeCaseIntro}
                  onOpenBpm={(highlight) => {
                    setBpmHighlight(highlight || null)
                    setActiveTab('planning')
                  }}
                />
              </section>

              <section className="section lifecycle-section">
                <h2>Этап выбранного жизненного цикла актива</h2>
                <LifecycleChart onStageClick={handleLifecycleStageClick} faceSeed={faceSeed} />
              </section>
            </div>
          )}

          {activeTab === 'face' && demoMode && (
            <div className="app-content app-content-face app-face-demo app-face-demo--immersive">
              <div className="app-demo-scene">
                <div className={`app-demo-float-top app-demo-float-hud${selectedAssetId && selectedAssetPoint && assetStatus ? ' app-demo-float-top--with-asset' : ''}`}>
                  <div ref={demoHudPanelsRowRef} className="demo-hud-panels-row">
                    <div
                      className={`demo-hud-panel demo-hud-panel--roses${hudPanelExpanded === 'roses' ? ' demo-hud-panel--expanded' : ''}`}
                    >
                      <button
                        type="button"
                        className="demo-hud-panel-expand"
                        onClick={() => setHudPanelExpanded((e) => (e === 'roses' ? null : 'roses'))}
                        aria-expanded={hudPanelExpanded === 'roses'}
                        aria-label={hudPanelExpanded === 'roses' ? 'Свернуть карту здоровья' : 'Развернуть карту здоровья'}
                      >
                        <svg
                          className={`demo-hud-panel-expand-icon${hudPanelExpanded === 'roses' ? ' demo-hud-panel-expand-icon--open' : ''}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden
                        >
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <div className="demo-wind-rose-stack">
                        <div className="wind-rose-item demo-wind-rose-item">
                          <WindRose
                            type="left"
                            data={leftRoseData}
                            centerTitle="ЦД этапов"
                            selectedIndex={selectedLeftStageIndex}
                            onSegmentClick={handleLeftSegmentClick}
                          />
                        </div>
                        <div className="wind-rose-item demo-wind-rose-item demo-wind-rose-item--second">
                          <WindRose
                            type="right"
                            data={rightRoseData}
                            centerTitle={selectedLeftStageIndex != null ? PRODUCTION_STAGES[selectedLeftStageIndex].name : 'ЦД объектов'}
                            selectedIndex={selectedRightObjectIndex}
                            onSegmentClick={handleRightSegmentClick}
                          />
                        </div>
                      </div>
                    </div>
                    <div
                      className={`demo-hud-panel demo-hud-panel--lifecycle${hudPanelExpanded === 'lifecycle' ? ' demo-hud-panel--expanded' : ''}`}
                    >
                      <button
                        type="button"
                        className="demo-hud-panel-expand"
                        onClick={() => setHudPanelExpanded((e) => (e === 'lifecycle' ? null : 'lifecycle'))}
                        aria-expanded={hudPanelExpanded === 'lifecycle'}
                        aria-label={hudPanelExpanded === 'lifecycle' ? 'Свернуть жизненный цикл' : 'Развернуть жизненный цикл'}
                      >
                        <svg
                          className={`demo-hud-panel-expand-icon${hudPanelExpanded === 'lifecycle' ? ' demo-hud-panel-expand-icon--open' : ''}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden
                        >
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <div className="demo-lifecycle-wrap">
                        <LifecycleChart
                          compactOverlay
                          hudExpanded={hudPanelExpanded === 'lifecycle'}
                          onStageClick={handleLifecycleStageClick}
                          faceSeed={faceSeed}
                        />
                      </div>
                    </div>
                    <div
                      className={`demo-hud-panel demo-hud-panel--hyper${hypercubeCaseIntro ? ' hypercube-case-intro' : ''}${hudPanelExpanded === 'hyper' ? ' demo-hud-panel--expanded' : ''}`}
                    >
                      <button
                        type="button"
                        className="demo-hud-panel-expand"
                        onClick={() => setHudPanelExpanded((e) => (e === 'hyper' ? null : 'hyper'))}
                        aria-expanded={hudPanelExpanded === 'hyper'}
                        aria-label={hudPanelExpanded === 'hyper' ? 'Свернуть гипер-куб' : 'Развернуть гипер-куб'}
                      >
                        <svg
                          className={`demo-hud-panel-expand-icon${hudPanelExpanded === 'hyper' ? ' demo-hud-panel-expand-icon--open' : ''}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden
                        >
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <div className="demo-hypercube-wrap">
                        <Hypercube3D
                          highlightCaseTree={hypercubeCaseIntro}
                          demoHudExpanded={hudPanelExpanded === 'hyper'}
                          onOpenBpm={(highlight) => {
                            setBpmHighlight(highlight || null)
                            setActiveTab('planning')
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  {hudPanelExpanded ? (
                    <button
                      type="button"
                      className="demo-hud-expand-backdrop"
                      aria-label="Закрыть увеличенную панель"
                      onClick={() => setHudPanelExpanded(null)}
                    />
                  ) : null}
                </div>
                {selectedAssetId && (
                  <div className="app-demo-scenario-dock">
                    <FaceScenarioOverlay
                      assetId={selectedAssetId}
                      scenarioComparisonRevision={scenarioComparisonRevision}
                      selectedScenarioTitle={faceSelectedScenarioTitle}
                      onSelectScenario={setFaceSelectedScenarioTitle}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'planning' && servicePageName && (
            <div className="app-content app-content-service">
              <div className="service-page">
                <button type="button" className="service-page-back" onClick={() => { setServicePageName(null); window.location.hash = 'planning'; }}><span className="service-page-back-arrow" aria-hidden /> Назад</button>
                <h1 className="service-page-title">{servicePageName}</h1>
              </div>
            </div>
          )}
          {activeTab === 'planning' && !servicePageName && (
            <div className="app-content app-content-bpm">
              <Suspense fallback={<div className="bpm-loading">Загрузка Планирования…</div>}>
                <BPMBoard
                  scenarioName={selectedScenarioName}
                  initialBoardId={
                    selectedScenarioName && selectedScenarioName.includes('Управление добычей с учетом ближайшего бурения')
                      ? 'do-burenie'
                      : selectedScenarioName && selectedScenarioName.includes('Проактивное управление ремонтами')
                        ? 'hantos'
                        : (selectedAssetId ? getBoardIdForAsset(selectedAssetId) : 'hantos')
                  }
                  initialStages={bpmCommand?.scenarioId === 'createPlanningCase' ? undefined : bpmStages}
                  initialTasks={bpmCommand?.scenarioId === 'createPlanningCase' ? undefined : bpmTasks}
                  selectedAssetName={selectedAssetPoint?.name}
                  highlightCardName={bpmHighlight}
                  onClose={() => setActiveTab('scenarios')}
                  onBoardChange={handleBoardChange}
                  aiMode={aiMode}
                  setAiMode={setAiMode}
                  onOpenPlanningWithScenario={(name) => { setSelectedScenarioName(name || 'Проактивное управление ремонтами и приоритетами'); setActiveTab('planning'); }}
                  bpmCommand={bpmCommand}
                  onBpmCommandConsumed={onBpmCommandConsumed}
                />
              </Suspense>
            </div>
          )}

          {/* Конфигуратор систем: всегда смонтирован при основном layout, видимость по activeTab — избегаем unmount/remount и исчезновения схемы */}
          <div className="app-content app-content-ontology" style={{ display: activeTab === 'ontology' ? 'flex' : 'none' }}>
            <OntologyTab
              isVisible={activeTab === 'ontology'}
              onOpenDoc={() => setShowConfiguratorDoc(true)}
              flowCode={flowCode}
              onFlowCodeChange={setFlowCode}
              openFromPlanning={openConfiguratorFromPlanning}
              onOpenFromPlanningConsumed={() => setOpenConfiguratorFromPlanning(false)}
              configuratorNodeCommand={configuratorNodeCommand}
              onConfiguratorNodeConsumed={() => setConfiguratorNodeCommand(null)}
              initialSchemaNodes={configuratorInitialNodes}
              initialSchemaEdges={configuratorInitialEdges}
              schemaFromPlanningRef={configuratorSchemaRef}
            />
          </div>
          {activeTab === 'results' && (
            <ResultsTab
              dashboardFocus={resultsDashboardFocus?.metric ?? null}
              dashboardFocusExplanation={resultsDashboardFocus?.explanation ?? null}
            />
          )}
          {activeTab === 'admin' && <AdminTab activeSub={adminSubTab} />}
        </main>

        {activeTab === 'face' && selectedAssetId && (
          <aside className={`app-right-panel${demoMode ? ' app-right-panel--demo-float' : ''}`}>
            <RightPanel
              assetId={selectedAssetId}
              scenarioComparisonRevision={scenarioComparisonRevision}
            />
          </aside>
        )}
      </div>
      <AIAssistantWidget
        visible={aiMode}
        setActiveTab={setActiveTab}
        setBpmCommand={setBpmCommand}
        setConfiguratorNodeCommand={setConfiguratorNodeCommand}
        setResultsDashboardFocus={setResultsDashboardFocus}
        setHypercubeCaseIntro={setHypercubeCaseIntro}
        setShowBpm={setShowBpm}
        setThinkingPhase={setThinkingPhase}
        setThinkingGraphNodes={setThinkingGraphNodes}
        resetThinkingChain={resetThinkingChain}
        requestUserConfirm={requestUserConfirm}
        onBpmCommandConsumedRef={bpmCommandConsumedRef}
        onThinkingPanelOpen={setThinkingPanelOpen}
        isThinkingPanelOpen={thinkingPanelOpen}
        thinkingSteps={thinkingSteps}
        currentMessage={thinkingCurrentMessage}
        isPaused={thinkingPaused}
        addThinkingStep={addThinkingStep}
        setThinkingSteps={setThinkingSteps}
        setCurrentMessage={setThinkingCurrentMessage}
        setIsPaused={setThinkingPaused}
      />
      {thinkingPanelOpen && (showThinkingHologram ? (
        <div className="app-thinking-scene">
          <div className="app-thinking-overlay app-thinking-overlay--holo" onClick={() => setThinkingPanelOpen(false)} aria-hidden />
          <div
            className="app-thinking-hologram glass-panel app-thinking-hologram--scene"
            role="dialog"
            aria-modal="true"
            aria-labelledby="thinking-holo-title"
          >
            <div className="app-thinking-hologram-head">
              <h3 id="thinking-holo-title" className="app-thinking-drawer-title">Режим мышления</h3>
              <button type="button" className="app-thinking-drawer-close" onClick={() => setThinkingPanelOpen(false)} aria-label="Закрыть">×</button>
            </div>
            <div className="app-thinking-hologram-body app-thinking-drawer-body">
              <ThinkingPanelBody
                showCollapsedBrainMinimal={showCollapsedBrainMinimal}
                thinkingConfirmPhase={thinkingConfirmPhase}
                thinkingSteps={thinkingSteps}
                graphNodesForThinking={graphNodesForThinking}
                thinkingChainRevealedRef={thinkingChainRevealedRef}
                brainPanelOpenKey={brainPanelOpenKey}
                selectedDecisionPathId={selectedDecisionPathId}
                appliedDecisionPathId={appliedDecisionPathId}
                setSelectedDecisionPathId={setSelectedDecisionPathId}
                handleRecalculateDecision={handleRecalculateDecision}
                thinkingAwaitingConfirm={thinkingAwaitingConfirm}
                handleThinkingConfirm={handleThinkingConfirm}
                thinkingCurrentMessage={thinkingCurrentMessage}
                thinkingPaused={thinkingPaused}
                setThinkingPaused={setThinkingPaused}
                onClosePanel={handleThinkingPanelSoftClose}
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="app-thinking-overlay" onClick={() => setThinkingPanelOpen(false)} aria-hidden />
          <div className={`app-thinking-drawer ${isThinkingDrawerCollapsed ? 'app-thinking-drawer--collapsed' : ''}`}>
            <div className="app-thinking-drawer-head">
              <h3 className="app-thinking-drawer-title">Режим мышления</h3>
              <button type="button" className="app-thinking-drawer-close" onClick={() => setThinkingPanelOpen(false)} aria-label="Закрыть">×</button>
            </div>
            <div className="app-thinking-drawer-body">
              <ThinkingPanelBody
                showCollapsedBrainMinimal={showCollapsedBrainMinimal}
                thinkingConfirmPhase={thinkingConfirmPhase}
                thinkingSteps={thinkingSteps}
                graphNodesForThinking={graphNodesForThinking}
                thinkingChainRevealedRef={thinkingChainRevealedRef}
                brainPanelOpenKey={brainPanelOpenKey}
                selectedDecisionPathId={selectedDecisionPathId}
                appliedDecisionPathId={appliedDecisionPathId}
                setSelectedDecisionPathId={setSelectedDecisionPathId}
                handleRecalculateDecision={handleRecalculateDecision}
                thinkingAwaitingConfirm={thinkingAwaitingConfirm}
                handleThinkingConfirm={handleThinkingConfirm}
                thinkingCurrentMessage={thinkingCurrentMessage}
                thinkingPaused={thinkingPaused}
                setThinkingPaused={setThinkingPaused}
                onClosePanel={handleThinkingPanelSoftClose}
              />
            </div>
          </div>
        </>
      ))}
    </div>
  )
}

export default App
