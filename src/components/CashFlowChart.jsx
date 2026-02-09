import React, { useState, useMemo } from 'react'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import './CashFlowChart.css'

const CURRENT_YEAR = 2026
const END_YEAR = 2065

const generateData = (startYear, endYear, baseCashFlow, declineRate) => {
  const years = endYear - startYear + 1
  return Array.from({ length: years }, (_, i) => {
    const y = startYear + i
    const iFromStart = y - startYear
    return {
      year: y,
      cashFlow: baseCashFlow * Math.pow(1 - declineRate, iFromStart),
      production: 100 * Math.pow(1 - declineRate * 0.8, iFromStart),
      npv: baseCashFlow * Math.pow(1 - declineRate, iFromStart) * (endYear - y) * 0.1,
      isHistory: y <= CURRENT_YEAR,
    }
  })
}

function CashFlowChart() {
  const [baseCashFlow, setBaseCashFlow] = useState(1000)
  const [declineRate, setDeclineRate] = useState(0.1)
  const [years, setYears] = useState(Math.min(40, END_YEAR - 2024))

  const chartData = useMemo(() => {
    const endY = Math.min(2024 + years, END_YEAR)
    return generateData(2024, endY, baseCashFlow, declineRate)
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
            max={END_YEAR - 2024}
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
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorCashFlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#667eea" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#667eea" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
              <XAxis 
                dataKey="year" 
                stroke="#a0aec0"
                tick={{ fill: '#a0aec0', angle: -90, textAnchor: 'end', fontSize: 11 }}
                ticks={[2024, 2025, 2026, END_YEAR]}
                tickFormatter={(v) => (v === END_YEAR && chartData[chartData.length - 1]?.year < END_YEAR - 1 ? `… ${v}` : String(v))}
              />
              <ReferenceLine x={CURRENT_YEAR} stroke="#fca5a5" strokeWidth={2} strokeOpacity={0.9} />
              <YAxis 
                stroke="#a0aec0"
                tick={{ fill: '#a0aec0' }}
                label={{ value: 'млн руб', angle: -90, position: 'insideLeft', fill: '#a0aec0' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                  border: '1px solid #667eea',
                  borderRadius: '8px',
                  color: '#e2e8f0'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="cashFlow" 
                stroke="#667eea" 
                fillOpacity={1} 
                fill="url(#colorCashFlow)"
                name="Cash Flow"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h3>Добыча: текущая и прогнозная</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
              <XAxis 
                dataKey="year" 
                stroke="#a0aec0"
                tick={{ fill: '#a0aec0', angle: -90, textAnchor: 'end', fontSize: 11 }}
                ticks={[2024, 2025, 2026, END_YEAR]}
                tickFormatter={(v) => (v === END_YEAR && chartData[chartData.length - 1]?.year < END_YEAR - 1 ? `… ${v}` : String(v))}
              />
              <ReferenceLine x={CURRENT_YEAR} stroke="#fca5a5" strokeWidth={2} strokeOpacity={0.9} />
              <YAxis 
                stroke="#a0aec0"
                tick={{ fill: '#a0aec0' }}
                label={{ value: '% от начальной', angle: -90, position: 'insideLeft', fill: '#a0aec0' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                  border: '1px solid #48bb78',
                  borderRadius: '8px',
                  color: '#e2e8f0'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="production" 
                stroke="#48bb78" 
                strokeWidth={3}
                dot={{ fill: '#48bb78', r: 4 }}
                name="Добыча"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="cashflow-period-legend">
        <span className="cashflow-legend-item cashflow-legend-history">● История (до {CURRENT_YEAR})</span>
        <span className="cashflow-legend-item cashflow-legend-forecast">● Прогнозный период (после {CURRENT_YEAR})</span>
      </div>
      <p className="cashflow-prognoz-hint">Красная линия — текущий срез {CURRENT_YEAR} г.</p>

      {breakEvenPoint && (
        <div className="break-even-alert">
          <h4>⚠️ Выход за рамки профиля</h4>
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
            {(chartData.reduce((sum, d) => sum + d.cashFlow, 0) / years).toLocaleString('ru-RU')} млн руб/год
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
