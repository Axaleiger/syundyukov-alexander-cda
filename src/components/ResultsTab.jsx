import React, { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line, AreaChart, Area, ComposedChart,
} from 'recharts'
import './ResultsTab.css'

const BAR_DATA = [
  { name: 'Янв', value: 420 },
  { name: 'Фев', value: 380 },
  { name: 'Мар', value: 510 },
  { name: 'Апр', value: 470 },
  { name: 'Май', value: 590 },
  { name: 'Июн', value: 550 },
]

const PIE_DATA = [
  { name: 'Добыча', value: 45, color: '#2d5a87' },
  { name: 'CAPEX', value: 25, color: '#22c55e' },
  { name: 'OPEX', value: 20, color: '#eab308' },
  { name: 'Резервы', value: 10, color: '#8b5cf6' },
]

const LINE_DATA = [
  { year: '2022', npv: 320, cf: 180 },
  { year: '2023', npv: 380, cf: 210 },
  { year: '2024', npv: 410, cf: 240 },
  { year: '2025', npv: 450, cf: 270 },
  { year: '2026', npv: 490, cf: 300 },
]

const CUMULATIVE_DATA = BAR_DATA.map((d, i) => ({
  ...d,
  cumulative: BAR_DATA.slice(0, i + 1).reduce((s, x) => s + x.value, 0),
}))

const COMBO_DATA = [
  { month: 'Янв', fact: 420, plan: 400 },
  { month: 'Фев', fact: 380, plan: 410 },
  { month: 'Мар', fact: 510, plan: 480 },
  { month: 'Апр', fact: 470, plan: 460 },
  { month: 'Май', fact: 590, plan: 520 },
  { month: 'Июн', fact: 550, plan: 540 },
]

const MATRIX_DATA = [
  { asset: 'Зимнее', do: 'Хантос', extraction: 5.2, capex: 120, status: '✓' },
  { asset: 'Новогоднее', do: 'ННГ', extraction: 4.1, capex: 95, status: '✓' },
  { asset: 'Аганское', do: 'Мегион', extraction: 3.2, capex: 88, status: '◐' },
  { asset: 'Приразломное', do: 'Шельф', extraction: 2.8, capex: 210, status: '✓' },
]

const SPARK_DATA = [320, 350, 380, 410, 450, 490]

function GaugeWidget({ value, max = 100, label }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="results-gauge-wrap">
      <div className="results-gauge-bg">
        <div className="results-gauge-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="results-gauge-value">{value}%</div>
      <div className="results-gauge-label">{label}</div>
    </div>
  )
}

function Sparkline({ data, color = '#2d5a87' }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 120
  const h = 32
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="results-sparkline-svg">
      <polyline fill="none" stroke={color} strokeWidth={2} points={points} />
    </svg>
  )
}

function ResultsTab() {
  const [period, setPeriod] = useState('2025')
  const [doFilter, setDoFilter] = useState('Все')
  const [assetFilter, setAssetFilter] = useState('Все')

  return (
    <div className="results-tab">
      <h2 className="results-tab-title">Результаты и аналитика</h2>

      <div className="results-filters">
        <div className="results-filter-group">
          <span className="results-filter-label">Период:</span>
          <select className="results-filter-select" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
        </div>
        <div className="results-filter-group">
          <span className="results-filter-label">ДО:</span>
          <select className="results-filter-select" value={doFilter} onChange={(e) => setDoFilter(e.target.value)}>
            <option value="Все">Все</option>
            <option value="Хантос">Хантос</option>
            <option value="ННГ">ННГ</option>
            <option value="Мегион">Мегион</option>
          </select>
        </div>
        <div className="results-filter-group">
          <span className="results-filter-label">Месторождение:</span>
          <select className="results-filter-select" value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)}>
            <option value="Все">Все</option>
            <option value="Зимнее">Зимнее</option>
            <option value="Новогоднее">Новогоднее</option>
            <option value="Аганское">Аганское</option>
          </select>
        </div>
        <button type="button" className="results-filter-apply">Применить</button>
      </div>

      <div className="results-dashboard">
        <div className="results-widget results-widget-span-2 results-widget-bar">
          <h3>Накопительная гистограмма</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={BAR_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#2d5a87" radius={[4, 4, 0, 0]} name="Объём" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="results-widget results-widget-pie">
          <h3>Структура показателей</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={PIE_DATA}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {PIE_DATA.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [v, '']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="results-widget results-widget-gauge">
          <h3>Выполнение плана</h3>
          <GaugeWidget value={98} label="план года" />
        </div>
        <div className="results-widget results-widget-span-2 results-widget-line">
          <h3>Динамика NPV и Cash flow</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={LINE_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11, angle: -90, textAnchor: 'end' }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="npv" stroke="#2d5a87" strokeWidth={2} name="NPV" dot={{ r: 4 }} />
              <Line type="monotone" dataKey="cf" stroke="#22c55e" strokeWidth={2} name="CF" dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="results-widget results-widget-combo">
          <h3>Добыча: факт vs план</h3>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={COMBO_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="fact" fill="#2d5a87" radius={[4, 4, 0, 0]} name="Факт" />
              <Line type="monotone" dataKey="plan" stroke="#eab308" strokeWidth={2} name="План" dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="results-widget results-widget-area">
          <h3>Накопительный тренд</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={CUMULATIVE_DATA}>
              <defs>
                <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2d5a87" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#2d5a87" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="cumulative" fill="url(#cumGrad)" stroke="#2d5a87" strokeWidth={2} name="Накопит." />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="results-widget results-widget-kpi results-widget-span-2">
          <h3>Ключевые показатели</h3>
          <div className="results-kpi-grid">
            <div className="results-kpi-item">
              <span className="results-kpi-value">12.5</span>
              <span className="results-kpi-label">млн т добыча</span>
            </div>
            <div className="results-kpi-item">
              <span className="results-kpi-value">98%</span>
              <span className="results-kpi-label">выполнение плана</span>
            </div>
            <div className="results-kpi-item">
              <span className="results-kpi-value">45</span>
              <span className="results-kpi-label">скважин в работе</span>
            </div>
            <div className="results-kpi-item">
              <span className="results-kpi-value">2.1</span>
              <span className="results-kpi-label">млрд CAPEX</span>
            </div>
            <div className="results-kpi-item">
              <span className="results-kpi-value">18</span>
              <span className="results-kpi-label">новых скважин</span>
            </div>
            <div className="results-kpi-item">
              <span className="results-kpi-value">3.2</span>
              <span className="results-kpi-label">млрд NPV</span>
            </div>
          </div>
        </div>
        <div className="results-widget results-widget-spark">
          <h3>NPV тренд</h3>
          <div className="results-spark-value">490</div>
          <Sparkline data={SPARK_DATA} />
        </div>
        <div className="results-widget results-widget-spark">
          <h3>Добыча тренд</h3>
          <div className="results-spark-value">12.5</div>
          <Sparkline data={[10, 10.5, 11, 11.8, 12, 12.5]} color="#22c55e" />
        </div>
        <div className="results-widget results-widget-table results-widget-span-2">
          <h3>Сводка по активам (матрица)</h3>
          <div className="results-matrix-table-wrap">
            <table className="results-matrix-table">
              <thead>
                <tr>
                  <th>Актив</th>
                  <th>ДО</th>
                  <th>Добыча, млн т</th>
                  <th>CAPEX, млрд</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {MATRIX_DATA.map((row, i) => (
                  <tr key={i}>
                    <td>{row.asset}</td>
                    <td>{row.do}</td>
                    <td>{row.extraction}</td>
                    <td>{row.capex}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResultsTab
