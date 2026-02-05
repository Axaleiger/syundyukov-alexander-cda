import React, { useState, useMemo } from 'react'
import { ComposableMap, Geographies, Geography, Annotation, ZoomableGroup, useMapContext, Line } from 'react-simple-maps'
import mapPointsData from '../data/mapPoints.json'
import chainsData from '../data/chains.json'
import { BUDGET_BY_ASSET, budgetToColor, getAssetRegionKey } from '../data/mapBudgetData'
import './RussiaMap.css'

const worldAtlasUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json'
const russiaRegionsUrl = 'https://raw.githubusercontent.com/Hubbitus/RussiaRegions.geojson/master/RussiaRegions.geojson'

const CF_POINTS = [
  { id: 'do-orenburg', coords: [55.1, 51.77], name: 'ДО Оренбург' },
  { id: 'do-yamal', coords: [64.8, 57.8], name: 'ДО Ямал' },
  { id: 'do-zapolyarye', coords: [66.2, 56.6], name: 'ДО Заполярье' },
  { id: 'do-messoyakha', coords: [67, 57.2], name: 'ДО Мессояха' },
  { id: 'do-meretoyakha', coords: [76.63, 66.08], name: 'ДО Меретояха' },
  { id: 'do-noyabrsk', coords: [75.45, 63.2], name: 'ДО Ноябрьск' },
  { id: 'do-megion', coords: [68.2, 60.8], name: 'ДО Мегион' },
  { id: 'do-tomsk', coords: [84.97, 56.5], name: 'ДО Томск' },
  { id: 'prirazlomnoe', coords: [51.33, 69.25], name: 'Приразломное' },
  { id: 'novy-port', coords: [72.7, 70], name: 'Новый Порт' },
  { id: 'messoyakha-m', coords: [79.5, 71], name: 'Мессояха (м.)' },
  { id: 'chayandinskoe', coords: [118, 62], name: 'Чаяндинское' },
]
const CF_ARROWS = [
  { from: 'do-megion', to: 'do-noyabrsk', cf: 185 },
  { from: 'do-yamal', to: 'do-zapolyarye', cf: 142 },
  { from: 'do-orenburg', to: 'do-tomsk', cf: 98 },
  { from: 'do-messoyakha', to: 'do-meretoyakha', cf: 167 },
  { from: 'do-noyabrsk', to: 'do-meretoyakha', cf: 124 },
  { from: 'do-zapolyarye', to: 'do-messoyakha', cf: 89 },
  { from: 'do-tomsk', to: 'do-megion', cf: 76 },
  { from: 'do-megion', to: 'do-zapolyarye', cf: 112 },
  { from: 'do-noyabrsk', to: 'do-yamal', cf: 156 },
  { from: 'do-meretoyakha', to: 'do-yamal', cf: 203 },
  { from: 'do-meretoyakha', to: 'novy-port', cf: 118 },
  { from: 'do-yamal', to: 'messoyakha-m', cf: 95 },
  { from: 'do-noyabrsk', to: 'do-megion', cf: 134 },
  { from: 'prirazlomnoe', to: 'do-orenburg', cf: 88 },
  { from: 'novy-port', to: 'do-meretoyakha', cf: 156 },
  { from: 'do-megion', to: 'do-tomsk', cf: 67 },
  { from: 'chayandinskoe', to: 'do-tomsk', cf: 142 },
  { from: 'do-zapolyarye', to: 'do-noyabrsk', cf: 178 },
  { from: 'do-messoyakha', to: 'do-yamal', cf: 92 },
  { from: 'do-orenburg', to: 'do-megion', cf: 76 },
]
function getCFArrowCoords(arr) {
  const fromP = CF_POINTS.find((p) => p.id === arr.from)
  const toP = CF_POINTS.find((p) => p.id === arr.to)
  return fromP && toP ? { from: fromP.coords, to: toP.coords, label: `${fromP.name} → ${toP.name}`, cf: arr.cf } : null
}
function cfLabelOffset(i, from, to) {
  const angle = Math.atan2(to[1] - from[1], (to[0] - from[0]) * Math.cos((from[1] * Math.PI) / 180))
  const perp = angle + Math.PI / 2
  const sign = i % 2 === 0 ? 1 : -1
  const dx = Math.cos(perp) * (12 + (i % 4) * 3) * sign
  const dy = -Math.sin(perp) * (12 + (i % 4) * 3) * sign
  return { dx: Math.round(dx * 10) / 10, dy: Math.round(dy * 10) / 10 }
}
const cfArrowsResolved = CF_ARROWS.map(getCFArrowCoords).filter(Boolean)
const cfArrowsMidpoints = cfArrowsResolved.map((a) => [
  (a.from[0] + a.to[0]) / 2,
  (a.from[1] + a.to[1]) / 2,
])
const LABEL_OVERLAP_DEG = 1.8
const cfLabelOverlaps = cfArrowsMidpoints.map((mid, i) =>
  cfArrowsMidpoints.some(
    (other, j) => i !== j && Math.hypot(mid[0] - other[0], mid[1] - other[1]) < LABEL_OVERLAP_DEG
  )
)
function CFArrowsLayer({ show, arrows, hoveredIndex, setHoveredIndex }) {
  if (!show) return null
  return (
    <>
      <defs>
        <marker
          id="cf-arrow"
          markerWidth="12"
          markerHeight="10"
          refX="12"
          refY="5"
          orient="auto"
        >
          <path d="M0,0 L12,5 L0,10 Z" fill="#2d5a87" />
        </marker>
        <marker
          id="cf-arrow-hover"
          markerWidth="12"
          markerHeight="10"
          refX="12"
          refY="5"
          orient="auto"
        >
          <path d="M0,0 L12,5 L0,10 Z" fill="#1e3a5f" />
        </marker>
      </defs>
      {arrows.map((arr, i) => (
        <Line
          key={i}
          from={arr.from}
          to={arr.to}
          stroke={hoveredIndex === i ? '#1e3a5f' : '#2d5a87'}
          strokeWidth={hoveredIndex === i ? 1.8 : 1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          markerEnd={hoveredIndex === i ? 'url(#cf-arrow-hover)' : 'url(#cf-arrow)'}
          style={{ cursor: 'pointer' }}
          onMouseEnter={() => setHoveredIndex(i)}
          onMouseLeave={() => setHoveredIndex(null)}
        />
      ))}
    </>
  )
}

function RussiaMap() {
  const [selectedId, setSelectedId] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)
  const [showBudgetFill, setShowBudgetFill] = useState(false)
  const [showCFArrows, setShowCFArrows] = useState(false)
  const [hoveredArrowIndex, setHoveredArrowIndex] = useState(null)

  const chain = selectedId ? chainsData[selectedId] : null
  const point = selectedId ? mapPointsData.find((p) => p.id === selectedId) : null

  const projectionConfig = useMemo(
    () => ({ center: [100, 62], scale: 520 }),
    []
  )

  const getRegionFill = (geo) => {
    if (!showBudgetFill) return '#e8eef4'
    const name = geo.properties?.name ?? geo.properties?.NAME ?? geo.properties?.region
    const key = getAssetRegionKey(name)
    if (!key) return '#e8eef4'
    const v = BUDGET_BY_ASSET[key]
    if (v == null) return '#e8eef4'
    return budgetToColor(v)
  }

  return (
    <div className="russia-map-container">
      <div className="map-controls-row">
        <label className="map-toggle">
          <input
            type="checkbox"
            checked={showBudgetFill}
            onChange={(e) => setShowBudgetFill(e.target.checked)}
          />
          <span>Бюджет по активам (недостаток / избыток)</span>
        </label>
        <button
          type="button"
          className={`map-cf-btn ${showCFArrows ? 'map-cf-btn-active' : ''}`}
          onClick={() => setShowCFArrows((v) => !v)}
        >
          Перераспределение CF (млн руб) ДО → активы
        </button>
      </div>
      {showBudgetFill && (
        <div className="map-budget-legend">
          <span className="map-legend-label">Недостаток бюджета</span>
          <div className="map-legend-gradient" />
          <span className="map-legend-label">Избыток бюджета</span>
        </div>
      )}
      <div className="map-wrapper">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={projectionConfig}
          style={{ width: '100%', height: '620px', position: 'relative' }}
        >
          <ZoomableGroup center={[100, 62]} minZoom={0.4} maxZoom={10}>
            <Geographies geography={russiaRegionsUrl}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getRegionFill(geo)}
                    stroke="#5b8dc9"
                    strokeWidth={0.4}
                    style={{
                      default: { outline: 'none' },
                      hover: { outline: 'none', fill: showBudgetFill ? getRegionFill(geo) : '#dce4ee' },
                      pressed: { outline: 'none' },
                    }}
                  />
                ))
              }
            </Geographies>
            <CFArrowsLayer
              show={showCFArrows}
              arrows={cfArrowsResolved}
              hoveredIndex={hoveredArrowIndex}
              setHoveredIndex={setHoveredArrowIndex}
            />
            {showCFArrows && cfArrowsResolved.map((arr, i) => {
              const mid = cfArrowsMidpoints[i]
              const showLabel = !cfLabelOverlaps[i] || hoveredArrowIndex === i
              return (
                <Annotation key={`cf-label-${i}`} subject={mid} dx={0} dy={0}>
                  <g
                    className="map-cf-label-always"
                    style={{ visibility: showLabel ? 'visible' : 'hidden', pointerEvents: 'none' }}
                  >
                    <rect x={-24} y={-8} width={48} height={16} rx={4} fill="rgba(255,255,255,0.96)" stroke="#2d5a87" strokeWidth={1} />
                    <text x={0} y={0} textAnchor="middle" dominantBaseline="middle" fill="#2d5a87" fontSize={9} fontWeight="700">
                      {arr.cf} млн
                    </text>
                  </g>
                </Annotation>
              )
            })}
            <Geographies geography={worldAtlasUrl}>
              {({ geographies }) =>
                geographies
                  .filter((g) => g.properties?.name === 'Russia')
                  .map((geo) => (
                    <Geography
                      key={`outline-${geo.rsmKey}`}
                      geography={geo}
                      fill="none"
                      stroke="#5b8dc9"
                      strokeWidth={0.6}
                      style={{ default: { outline: 'none' }, hover: { outline: 'none' }, pressed: { outline: 'none' } }}
                    />
                  ))
              }
            </Geographies>
            {mapPointsData.map((p) => (
              <Annotation key={p.id} subject={[p.lon, p.lat]} dx={0} dy={0}>
                <g
                  className="map-marker"
                  onClick={() => setSelectedId(selectedId === p.id ? null : p.id)}
                  onMouseEnter={() => setHoveredId(p.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <circle
                    r={selectedId === p.id ? 10 : hoveredId === p.id ? 9 : 7}
                    fill={selectedId === p.id ? '#2d5a87' : hoveredId === p.id ? '#3d6a97' : '#5b8dc9'}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                  {(hoveredId === p.id || selectedId === p.id) && (
                    <text textAnchor="middle" y={-18} fill="#2c3e50" fontSize={14} fontWeight="600" className="map-point-label">
                      {p.name}
                    </text>
                  )}
                </g>
              </Annotation>
            ))}

            {selectedId && point && chain && (
              <Annotation subject={[point.lon, point.lat]} dx={24} dy={16}>
                <g className="map-chain-vertical">
                  {chain.nodes.map((name, i) => (
                    <g key={i} transform={`translate(0, ${i * 36})`}>
                      {i > 0 && (
                        <line
                          x1={0}
                          y1={-26}
                          x2={0}
                          y2={-10}
                          stroke="#2d5a87"
                          strokeWidth={1.5}
                          strokeOpacity={0.9}
                        />
                      )}
                      <circle r={10} fill="#2d5a87" stroke="#fff" strokeWidth={1.5} />
                      <text
                        textAnchor="middle"
                        y={5}
                        fill="#fff"
                        fontSize={11}
                        fontWeight="700"
                        className="map-chain-node-num"
                      >
                        {i + 1}
                      </text>
                      <text
                        textAnchor="start"
                        x={16}
                        y={4}
                        fill="#2d5a87"
                        fontSize={12}
                        fontWeight="600"
                        className="map-chain-node-label"
                      >
                        {name}
                      </text>
                    </g>
                  ))}
                </g>
              </Annotation>
            )}
          </ZoomableGroup>
        </ComposableMap>
        <p className="map-hint">Перетаскивание — перемещение карты, колёсико мыши — масштаб. Название точки — при наведении.</p>
      </div>
    </div>
  )
}

export default RussiaMap
