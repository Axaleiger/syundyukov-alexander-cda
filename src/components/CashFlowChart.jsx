import React, { useState, useMemo } from 'react'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './CashFlowChart.css'

// Генерируем данные для графика
const generateData = (years, baseCashFlow, declineRate) => {
  return Array.from({ length: years }, (_, i) => ({
    year: 2024 + i,
    cashFlow: baseCashFlow * Math.pow(1 - declineRate, i),
    production: 100 * Math.pow(1 - declineRate * 0.8, i), // Добыча снижается медленнее
    npv: baseCashFlow * Math.pow(1 - declineRate, i) * (years - i) * 0.1
  }))
}

function CashFlowChart() {
  const [baseCashFlow, setBaseCashFlow] = useState(1000)
  const [declineRate, setDeclineRate] = useState(0.1)
  const [years, setYears] = useState(20)

  const chartData = useMemo(() => {
    return generateData(years, baseCashFlow, declineRate)
  }, [baseCashFlow, declineRate, years])

  // Вычисляем точку выхода за рамки профиля
  const breakEvenPoint = useMemo(() => {
    const point = chartData.findIndex(d => d.cashFlow < baseCashFlow * 0.5)
    return point !== -1 ? chartData[point].year : null
  }, [chartData, baseCashFlow])

  return (
    <div className="cashflow-container">
      <div className="cashflow-controls">
        <div className="control-group">
          <label>
            Базовый Cash Flow (млн руб/год): {baseCashFlow}
            <input
              type="range"
              min="100"
              max="5000"
              step="100"
              value={baseCashFlow}
              onChange={(e) => setBaseCashFlow(Number(e.target.value))}
              className="slider"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Темп снижения (%/год): {(declineRate * 100).toFixed(1)}
            <input
              type="range"
              min="0"
              max="30"
              step="0.5"
              value={declineRate * 100}
              onChange={(e) => setDeclineRate(Number(e.target.value) / 100)}
              className="slider"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Период прогноза (лет): {years}
            <input
              type="range"
              min="5"
              max="30"
              step="1"
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="slider"
            />
          </label>
        </div>
      </div>

      <div className="cashflow-charts">
        <div className="chart-container">
          <h3>Cash Flow</h3>
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
                tick={{ fill: '#a0aec0' }}
              />
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
          <h3>График добычи</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
              <XAxis 
                dataKey="year" 
                stroke="#a0aec0"
                tick={{ fill: '#a0aec0' }}
              />
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
