import React, { useState, useMemo, useEffect } from 'react'
import './App.css'
import RussiaMap from './components/RussiaMap'
import WindRose from './components/WindRose'
import { PRODUCTION_STAGES, OBJECTS_BY_STAGE, DEFAULT_OBJECTS } from './data/rosesData'
import Hypercube3D from './components/Hypercube3D'
import LifecycleChart from './components/LifecycleChart'
import CashFlowChart from './components/CashFlowChart'
import CDPage from './components/CDPage'
import BPMBoard from './components/BPMBoard'
import RightPanel from './components/RightPanel'
import ScenariosList from './components/ScenariosList'
import OntologyTab from './components/OntologyTab'
import ResultsTab from './components/ResultsTab'
import { getAssetStatus, getAssetStatusLabel, getAssetStatusIcon } from './data/assetStatus'
import mapPointsData from './data/mapPoints.json'

const TABS = [
  { id: 'face', label: 'Главная страница' },
  { id: 'scenarios', label: 'Список сценариев' },
  { id: 'planning', label: 'Планирование' },
  { id: 'ontology', label: 'Онтология' },
  { id: 'results', label: 'Результаты' },
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

function App() {
  const [activeTab, setActiveTab] = useState('face')
  const [selectedLeftStageIndex, setSelectedLeftStageIndex] = useState(null)
  const [selectedRightObjectIndex, setSelectedRightObjectIndex] = useState(null)
  const [cdPageNode, setCdPageNode] = useState(null)
  const [showBpm, setShowBpm] = useState(false)
  const [bpmHighlight, setBpmHighlight] = useState(null)
  const [selectedAssetId, setSelectedAssetId] = useState(null)
  const [scenariosStageFilter, setScenariosStageFilter] = useState(null)
  const [rightPanelCardColors, setRightPanelCardColors] = useState([null, null, null])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const cd = params.get('cd')
    if (cd) setCdPageNode(decodeURIComponent(cd))
    if (params.get('bpm') === '1') {
      setShowBpm(true)
      setBpmHighlight(params.get('highlight') || null)
    }
  }, [])

  const rightRoseData = useMemo(() => {
    if (selectedLeftStageIndex != null) {
      const stageName = PRODUCTION_STAGES[selectedLeftStageIndex].name
      return OBJECTS_BY_STAGE[stageName] || DEFAULT_OBJECTS
    }
    return DEFAULT_OBJECTS
  }, [selectedLeftStageIndex])

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
        <BPMBoard
          highlightCardName={bpmHighlight}
          onClose={() => { setShowBpm(false); setBpmHighlight(null) }}
        />
      </div>
    )
  }

  return (
    <div className="app app-with-sidebar">
      <header className="app-header">
        <img src={`${import.meta.env.BASE_URL}emblem.png`} alt="ЦДА" className="app-header-emblem" />
        <div className="app-header-text">
          <h1>ЦДА</h1>
          <p>(Цифровой Двойник Актива)</p>
        </div>
        <div className="app-header-zones-legend">
          <span className="app-header-zone app-header-zone-red" title="Критическое состояние">🔴 ! Критическое состояние</span>
          <span className="app-header-zone app-header-zone-yellow" title="Требует внимания">🟡 ? Требует внимания</span>
          <span className="app-header-zone app-header-zone-green" title="Устойчивое развитие">🟢 ✓ Устойчивое развитие</span>
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
            <button
              key={t.id}
              type="button"
              className={`app-sidebar-tab ${activeTab === t.id ? 'app-sidebar-tab-active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <main className="app-main">
          {activeTab === 'scenarios' && (
            <ScenariosList
              activeStageFilter={scenariosStageFilter}
              onScenarioClick={() => {}}
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
                      data={PRODUCTION_STAGES}
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
                <h2>Динамика Cash flow и добычи: текущая и прогнозная</h2>
                <CashFlowChart />
              </section>

              <section className="section lifecycle-section">
                <h2>Этап выбранного жизненного цикла актива</h2>
                <LifecycleChart onStageClick={handleLifecycleStageClick} />
              </section>
            </div>
          )}

          {activeTab === 'planning' && (
            <div className="app-content app-content-bpm">
              <BPMBoard
                initialBoardId={selectedAssetId ? getBoardIdForAsset(selectedAssetId) : 'hantos'}
                selectedAssetName={selectedAssetPoint?.name}
                highlightCardName={bpmHighlight}
                onClose={() => setActiveTab('face')}
              />
            </div>
          )}

          {activeTab === 'ontology' && <OntologyTab />}
          {activeTab === 'results' && <ResultsTab />}
        </main>

        {activeTab === 'face' && selectedAssetId && (
          <aside className="app-right-panel">
            <RightPanel scenarioCardColors={rightPanelCardColors} />
          </aside>
        )}
      </div>
    </div>
  )
}

export default App
