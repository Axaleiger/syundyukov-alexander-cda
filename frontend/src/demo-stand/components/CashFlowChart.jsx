import React, { useState, useMemo, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea, Customized } from 'recharts'
import './CashFlowChart.css'

const CURRENT_YEAR = 2026
const START_YEAR = 2020
const END_YEAR = 2065
const MAX_PROGNOSIS_YEARS = 39
const CHART_YEAR_TICKS = [
  2020, 2022, 2024, 2026, 2028, 2030, 2032, 2034, 2036, 2038, 2040, 2042, 2044, 2046, 2050, 2054, 2058, 2063, 2065,
]
const HISTORY_COLOR = '#3b82f6'
const FORECAST_COLOR = '#22c55e'

function XAxisTickWithLine({ x, y, payload }) {
  if (payload.value === END_YEAR) return null
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={14} textAnchor="middle" fill="#a0aec0" fontSize={10}>{payload.value}</text>
    </g>
  )
}

/** Рисует цветные линии между точками на оси X поверх графика (цвет = цвет конечной точки). */
function XAxisSegmentLines(props) {
  const { xAxisMap, yAxisMap, offset } = props
  const xAxis = xAxisMap && Object.values(xAxisMap)[0]
  const yAxis = yAxisMap && Object.values(yAxisMap)[0]
  if (!xAxis || !yAxis || !offset) return null
  const xScale = xAxis.scale
  const yScale = yAxis.scale
  const y0 = yScale(0)
  if (typeof y0 !== 'number') return null
  const lines = []
  for (let i = 0; i < CHART_YEAR_TICKS.length - 1; i++) {
    const x1 = CHART_YEAR_TICKS[i]
    const x2 = CHART_YEAR_TICKS[i + 1]
    const endColor = x2 <= CURRENT_YEAR ? HISTORY_COLOR : FORECAST_COLOR
    const px1 = xScale(x1)
    const px2 = xScale(x2)
    if (typeof px1 !== 'number' || typeof px2 !== 'number') continue
    lines.push({ key: `${x1}-${x2}`, x1: px1, x2: px2, y: y0, color: endColor })
  }
  const points = CHART_YEAR_TICKS.map((tick) => {
    const px = xScale(tick)
    if (typeof px !== 'number') return null
    const color = tick <= CURRENT_YEAR ? HISTORY_COLOR : FORECAST_COLOR
    return { key: tick, x: px, y: y0, color }
  }).filter(Boolean)
  return (
    <g className="recharts-reference-line">
      {lines.map(({ key, x1, x2, y, color }) => (
        <line key={key} x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth={3} strokeLinecap="round" />
      ))}
      {points.map(({ key, x, y: py, color }) => (
        <g key={key}>
          <circle cx={x} cy={py} r={5} fill={color} />
          <circle cx={x} cy={py} r={2} fill="#fff" />
        </g>
      ))}
      {(() => {
        const p2065 = points.find((p) => p.key === END_YEAR)
        if (!p2065) return null
        return (
          <text x={p2065.x} y={y0 + 22} textAnchor="middle" fill="#a0aec0" fontSize={10}>{END_YEAR}</text>
        )
      })()}
    </g>
  )
}

function XAxisBands() {
  return (
    <>
      {CHART_YEAR_TICKS.slice(0, -1).map((t, i) => {
        const next = CHART_YEAR_TICKS[i + 1]
        const isHist = next <= CURRENT_YEAR
        return <ReferenceArea key={t} x1={t} x2={next} fill={isHist ? HISTORY_COLOR : FORECAST_COLOR} fillOpacity={0.25} />
      })}
    </>
  )
}

const generateData = (startYear, endYear, baseCashFlow, declineRate) => {
  const years = endYear - startYear + 1
  return Array.from({ length: years }, (_, i) => {
    const y = startYear + i
    const iFromStart = y - startYear
    const cashFlow = baseCashFlow * Math.pow(1 - declineRate, iFromStart)
    const production = 100 * Math.pow(1 - declineRate * 0.8, iFromStart)
    return {
      year: y,
      cashFlow,
      production,
      cashFlowHistory: y <= CURRENT_YEAR ? cashFlow : null,
      cashFlowForecast: y >= CURRENT_YEAR ? cashFlow : null,
      productionHistory: y <= CURRENT_YEAR ? production : null,
      productionForecast: y >= CURRENT_YEAR ? production : null,
      npv: baseCashFlow * Math.pow(1 - declineRate, iFromStart) * (endYear - y) * 0.1,
      isHistory: y <= CURRENT_YEAR,
    }
  })
}

function CashFlowChart({ faceSeed = 0 }) {
  const [baseCashFlow, setBaseCashFlow] = useState(1000)
  const [declineRate, setDeclineRate] = useState(0.1)
  const [years, setYears] = useState(Math.min(MAX_PROGNOSIS_YEARS, 39))

  useEffect(() => {
    if (faceSeed === 0) return
    setBaseCashFlow(800 + (faceSeed % 4200))
    setDeclineRate(0.05 + (faceSeed % 250) / 10000)
  }, [faceSeed])

  const chartData = useMemo(() => {
    const endY = Math.min(CURRENT_YEAR + years, END_YEAR)
    return generateData(START_YEAR, endY, baseCashFlow, declineRate)
  }, [baseCashFlow, declineRate, years])

  // Вычисляем точку выхода за рамки профиля
  const breakEvenPoint = useMemo(() => {
    const point = chartData.findIndex(d => d.cashFlow < baseCashFlow * 0.5)
    return point !== -1 ? chartData[point].year : null
  }, [chartData, baseCashFlow])

  return (
    <div className="cashflow-container">
      <div className="cashflow-controls cashflow-controls-full">
        <div className="cashflow-control-group cashflow-control-group-flex">
          <label className="cashflow-slider-label">Базовый Cash Flow (млн руб/год): {baseCashFlow}</label>
          <input
            type="range"
            min="100"
            max="5000"
            step="100"
            value={baseCashFlow}
            onChange={(e) => setBaseCashFlow(Number(e.target.value))}
            className="slider"
          />
        </div>
        <div className="cashflow-control-group cashflow-control-group-flex">
          <label className="cashflow-slider-label">Темп снижения (%/год): {(declineRate * 100).toFixed(1)}</label>
          <input
            type="range"
            min="0"
            max="30"
            step="0.5"
            value={declineRate * 100}
            onChange={(e) => setDeclineRate(Number(e.target.value) / 100)}
            className="slider"
          />
        </div>
        <div className="cashflow-control-group cashflow-control-group-flex">
          <label className="cashflow-slider-label">Период прогноза (лет): {years}</label>
          <input
            type="range"
            min="5"
            max={MAX_PROGNOSIS_YEARS}
            step="1"
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            className="slider"
          />
        </div>
      </div>

      <div className="cashflow-charts">
        <div className="chart-container">
          <h3>Cash flow</h3>
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={chartData} isAnimationActive={false} margin={{ top: 10, right: 32, left: 10, bottom: 28 }}>
              <defs>
                <linearGradient id="colorCashFlowHist" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={HISTORY_COLOR} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={HISTORY_COLOR} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorCashFlowFcast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={FORECAST_COLOR} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={FORECAST_COLOR} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
              <XAxisBands />
              <XAxis 
                dataKey="year" 
                type="number"
                domain={[START_YEAR, END_YEAR]}
                padding={{ right: 24, left: 0 }}
                stroke="#a0aec0"
                ticks={CHART_YEAR_TICKS}
                tickLine={false}
                tick={<XAxisTickWithLine />}
              />
              <ReferenceLine x={CURRENT_YEAR} stroke="#fca5a5" strokeWidth={2} strokeOpacity={0.9} />
              <YAxis domain={[0, 'auto']} stroke="#a0aec0" tick={{ fill: '#a0aec0' }} label={{ value: 'млн руб', angle: -90, position: 'insideLeft', fill: '#a0aec0' }} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', border: '1px solid #667eea', borderRadius: '8px', color: '#e2e8f0' }} />
              <Area type="monotone" dataKey="cashFlowHistory" stroke={HISTORY_COLOR} fill="url(#colorCashFlowHist)" fillOpacity={1} connectNulls name="Cash Flow (история)" dot={{ fill: HISTORY_COLOR, r: 3 }} isAnimationActive={false} />
              <Area type="monotone" dataKey="cashFlowForecast" stroke={FORECAST_COLOR} fill="url(#colorCashFlowFcast)" fillOpacity={1} connectNulls name="Cash Flow (прогноз)" dot={{ fill: FORECAST_COLOR, r: 3 }} isAnimationActive={false} />
              <Customized component={XAxisSegmentLines} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h3>Динамика добычи</h3>
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={chartData} isAnimationActive={false} margin={{ top: 10, right: 32, left: 10, bottom: 28 }}>
              <defs>
                <linearGradient id="colorProdHist" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={HISTORY_COLOR} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={HISTORY_COLOR} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorProdFcast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={FORECAST_COLOR} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={FORECAST_COLOR} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
              <XAxisBands />
              <XAxis
                dataKey="year"
                type="number"
                domain={[START_YEAR, END_YEAR]}
                padding={{ right: 24, left: 0 }}
                stroke="#a0aec0"
                ticks={CHART_YEAR_TICKS}
                tickLine={false}
                tick={<XAxisTickWithLine />}
              />
              <ReferenceLine x={CURRENT_YEAR} stroke="#fca5a5" strokeWidth={2} strokeOpacity={0.9} />
              <YAxis domain={[0, 'auto']} stroke="#a0aec0" tick={{ fill: '#a0aec0' }} label={{ value: '% от начальной', angle: -90, position: 'insideLeft', fill: '#a0aec0' }} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', border: '1px solid #48bb78', borderRadius: '8px', color: '#e2e8f0' }} />
              <Area type="monotone" dataKey="productionHistory" stroke={HISTORY_COLOR} fill="url(#colorProdHist)" fillOpacity={1} connectNulls name="Добыча (история)" dot={{ fill: HISTORY_COLOR, r: 3 }} isAnimationActive={false} />
              <Area type="monotone" dataKey="productionForecast" stroke={FORECAST_COLOR} fill="url(#colorProdFcast)" fillOpacity={1} connectNulls name="Добыча (прогноз)" dot={{ fill: FORECAST_COLOR, r: 3 }} isAnimationActive={false} />
              <Customized component={XAxisSegmentLines} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="cashflow-period-legend">
        <span className="cashflow-legend-item cashflow-legend-history" style={{ color: HISTORY_COLOR }}>● История (до {CURRENT_YEAR})</span>
        <span className="cashflow-legend-item cashflow-legend-forecast" style={{ color: FORECAST_COLOR }}>● Прогнозный период (после {CURRENT_YEAR})</span>
      </div>
      <p className="cashflow-prognoz-hint">Красная линия — текущий срез {CURRENT_YEAR} г.</p>

      {breakEvenPoint && (
        <div className="break-even-alert">
          <h4>Выход за рамки профиля</h4>
          <p>При текущих параметрах Cash Flow упадет ниже 50% от базового значения к <strong>{breakEvenPoint}</strong> году.</p>
          <p>Рекомендуется пересмотреть стратегию разработки месторождения.</p>
        </div>
      )}

      <div className="cashflow-summary">
        <div className="summary-item">
          <span className="summary-label">Суммарный Cash Flow:</span>
          <span className="summary-value">
            {chartData.reduce((sum, d) => sum + d.cashFlow, 0).toLocaleString('ru-RU')} млн руб
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Средний Cash Flow:</span>
          <span className="summary-value">
            {(chartData.reduce((sum, d) => sum + d.cashFlow, 0) / (chartData.length || 1)).toLocaleString('ru-RU')} млн руб/год
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">NPV (приведенная стоимость):</span>
          <span className="summary-value">
            {chartData.reduce((sum, d) => sum + d.npv, 0).toLocaleString('ru-RU')} млн руб
          </span>
        </div>
      </div>
    </div>
  )
}

export default CashFlowChart
