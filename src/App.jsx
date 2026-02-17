import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react'
import './App.css'
import RussiaMap from './components/RussiaMap'
import WindRose from './components/WindRose'
import { PRODUCTION_STAGES, OBJECTS_BY_STAGE, DEFAULT_OBJECTS } from './data/rosesData'
import Hypercube3D from './components/Hypercube3D'
import LifecycleChart from './components/LifecycleChart'
import CashFlowChart from './components/CashFlowChart'
import CDPage from './components/CDPage'
import RightPanel from './components/RightPanel'

const BPMBoard = lazy(() => import('./components/BPMBoard'))
import ScenariosList from './components/ScenariosList'
import OntologyTab from './components/OntologyTab'
import ResultsTab from './components/ResultsTab'
import AdminTab from './components/AdminTab'
import { getAssetStatus, getAssetStatusLabel, getAssetStatusIcon } from './data/assetStatus'
import { SCENARIO_STAGE_FILTERS } from './data/scenariosData'
import mapPointsData from './data/mapPoints.json'

const ADMIN_SUB_TABS = [
  { id: 'roles', label: 'Ролевая модель' },
  { id: 'catalog', label: 'Каталог сервисов' },
  { id: 'integration', label: 'Заявки на интеграцию' },
  { id: 'changes', label: 'Заявки на доработку сервисов' },
]

const TABS = [
  { id: 'face', label: 'Главная страница' },
  { id: 'scenarios', label: 'Список сценариев' },
  { id: 'planning', label: 'Планирование' },
  { id: 'ontology', label: 'Конфигуратор систем' },
  { id: 'results', label: 'Результаты' },
  { id: 'admin', label: 'Администрирование', separatorBefore: true },
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
  if (hash.startsWith('admin-')) {
    const sub = hash.slice(6)
    const valid = ADMIN_SUB_TABS.some((t) => t.id === sub)
    return { tab: 'admin', adminSub: valid ? sub : 'roles' }
  }
  const valid = TABS.some((t) => t.id === hash)
  return { tab: valid ? hash : 'face', adminSub: 'roles' }
}

function App() {
  const [activeTab, setActiveTab] = useState('face')
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
  const [rightPanelCardColors, setRightPanelCardColors] = useState([null, null, null])
  const [adminSubTab, setAdminSubTab] = useState('roles')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const cd = params.get('cd')
    if (cd) setCdPageNode(decodeURIComponent(cd))
    if (params.get('bpm') === '1') {
      setShowBpm(true)
      setBpmHighlight(params.get('highlight') || null)
      return
    }
    const { tab, adminSub } = parseTabFromHash()
    setActiveTab(tab)
    setAdminSubTab(adminSub)
  }, [])

  useEffect(() => {
    if (showBpm) return
    const hash = activeTab === 'admin' ? `#admin-${adminSubTab}` : `#${activeTab}`
    if (typeof window !== 'undefined' && window.location.hash !== hash) {
      window.history.replaceState(null, '', hash)
    }
  }, [activeTab, adminSubTab, showBpm])

  useEffect(() => {
    const onHashChange = () => {
      if (window.location.search.includes('bpm=1')) return
      const { tab, adminSub } = parseTabFromHash()
      setActiveTab(tab)
      setAdminSubTab(adminSub)
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
    setSelectedRightObjectIndex((prev) => (prev === index ? null : index))
  }

  const handleMapAssetSelect = (pointId) => {
    setSelectedAssetId(pointId || null)
    setActiveTab('face')
    if (pointId) {
      const palette = ['green', 'yellow', 'orange', 'blue', 'teal']
      setRightPanelCardColors([palette[Math.floor(Math.random() * palette.length)], palette[Math.floor(Math.random() * palette.length)], palette[Math.floor(Math.random() * palette.length)]])
    }
  }

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

  if (showBpm) {
    return (
      <div className="app">
        <Suspense fallback={<div className="bpm-loading">Загрузка…</div>}>
          <BPMBoard
            highlightCardName={bpmHighlight}
            onClose={() => { setShowBpm(false); setBpmHighlight(null) }}
          />
        </Suspense>
      </div>
    )
  }

  return (
    <div className="app app-with-sidebar">
      <header className="app-header">
        <img src={`${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/emblem.png`} alt="ЦДА" className="app-header-emblem" />
        <div className="app-header-text">
          <h1>ЦДА</h1>
          <p>(Цифровой Двойник Актива)</p>
        </div>
      </header>

      {selectedAssetId && selectedAssetPoint && assetStatus && (
        <div className="app-asset-sticky">
          <span className="app-asset-sticky-name">{selectedAssetPoint.name}</span>
          <span className="app-asset-sticky-status">{assetStatusLabel}</span>
          {assetStatusIcon && (
            <span className={`app-asset-sticky-icon app-asset-sticky-icon-${assetStatusIcon.color}`} title={assetStatusLabel}>
              {assetStatusIcon.type === 'check' && '✓'}
              {assetStatusIcon.type === 'exclamation' && '!'}
              {assetStatusIcon.type === 'question' && '?'}
            </span>
          )}
          <button type="button" className="app-asset-sticky-close" onClick={() => setSelectedAssetId(null)} aria-label="Сбросить">×</button>
        </div>
      )}

      <div className="app-body">
        <nav className="app-sidebar">
          {TABS.map((t) => (
            <React.Fragment key={t.id}>
              {t.separatorBefore && <hr className="app-sidebar-divider" />}
              <button
                type="button"
                className={`app-sidebar-tab ${activeTab === t.id ? 'app-sidebar-tab-active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            </React.Fragment>
          ))}
        </nav>

        {activeTab === 'scenarios' && (
          <nav className="app-sidebar app-sidebar-secondary">
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
          <nav className="app-sidebar app-sidebar-secondary">
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

        <main className="app-main">
          {activeTab === 'scenarios' && (
            <ScenariosList
              activeStageFilter={scenariosStageFilter}
              stageFilters={scenarioStageFilters}
              onStageFilterToggle={(name) => setScenarioStageFilters((prev) => ({ ...prev, [name]: !prev[name] }))}
              onScenarioClick={(row) => {
              if (row?.name && row.name.includes('Управление добычей с учетом ближайшего бурения')) {
                setActiveTab('planning')
              }
            }}
            />
          )}

          {activeTab === 'face' && (
            <div className="app-content app-content-face">
              <section className="section map-section">
                <h2>Карта объектов ЦДА</h2>
                <RussiaMap onAssetSelect={handleMapAssetSelect} />
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

              <section className="section hypercube-section">
                <h2>Гиперкуб рычагов влияния</h2>
                <Hypercube3D
                  onOpenBpm={(highlight) => {
                    setBpmHighlight(highlight || null)
                    setActiveTab('planning')
                  }}
                />
              </section>

              <section className="section cashflow-section">
                <h2>Динамика Cash flow и добычи</h2>
                <CashFlowChart faceSeed={faceSeed} />
              </section>

              <section className="section lifecycle-section">
                <h2>Этап выбранного жизненного цикла актива</h2>
                <LifecycleChart onStageClick={handleLifecycleStageClick} faceSeed={faceSeed} />
              </section>
            </div>
          )}

          {activeTab === 'planning' && (
            <div className="app-content app-content-bpm">
              <Suspense fallback={<div className="bpm-loading">Загрузка Планирования…</div>}>
                <BPMBoard
                  initialBoardId={selectedAssetId ? getBoardIdForAsset(selectedAssetId) : 'hantos'}
                  selectedAssetName={selectedAssetPoint?.name}
                  highlightCardName={bpmHighlight}
                  onClose={() => setActiveTab('face')}
                />
              </Suspense>
            </div>
          )}

          {activeTab === 'ontology' && <OntologyTab />}
          {activeTab === 'results' && <ResultsTab />}
          {activeTab === 'admin' && <AdminTab activeSub={adminSubTab} />}
        </main>

        {activeTab === 'face' && selectedAssetId && (
          <aside className="app-right-panel">
            <RightPanel scenarioCardColors={rightPanelCardColors} assetId={selectedAssetId} />
          </aside>
        )}
      </div>
    </div>
  )
}

export default App
