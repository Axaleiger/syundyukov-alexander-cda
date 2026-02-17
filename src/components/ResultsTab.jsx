import React, { useState, useMemo, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line, AreaChart, Area, ComposedChart,
} from 'recharts'
import './ResultsTab.css'

const BAR_DATA_FULL = [
  { name: 'Янв', value: 420 },
  { name: 'Фев', value: 380 },
  { name: 'Мар', value: 510 },
  { name: 'Апр', value: 470 },
  { name: 'Май', value: 590 },
  { name: 'Июн', value: 550 },
]

const PIE_DATA_BASE = [
  { name: 'Добыча', value: 45, color: '#2d5a87' },
  { name: 'CAPEX', value: 25, color: '#22c55e' },
  { name: 'OPEX', value: 20, color: '#eab308' },
  { name: 'Резервы', value: 10, color: '#8b5cf6' },
]

const LINE_DATA_FULL = [
  { year: '2022', npv: 320, cf: 180 },
  { year: '2023', npv: 380, cf: 210 },
  { year: '2024', npv: 410, cf: 240 },
  { year: '2025', npv: 450, cf: 270 },
  { year: '2026', npv: 490, cf: 300 },
]

const COMBO_DATA_FULL = [
  { month: 'Янв', fact: 420, plan: 400 },
  { month: 'Фев', fact: 380, plan: 410 },
  { month: 'Мар', fact: 510, plan: 480 },
  { month: 'Апр', fact: 470, plan: 460 },
  { month: 'Май', fact: 590, plan: 520 },
  { month: 'Июн', fact: 550, plan: 540 },
]

const MATRIX_DATA_FULL = [
  { asset: 'Зимнее', do: 'Хантос', extraction: 5.2, capex: 120, status: '✓' },
  { asset: 'Новогоднее', do: 'ННГ', extraction: 4.1, capex: 95, status: '✓' },
  { asset: 'Аганское', do: 'Мегион', extraction: 3.2, capex: 88, status: '◐' },
  { asset: 'Приразломное', do: 'Шельф', extraction: 2.8, capex: 210, status: '✓' },
]

const ASSETS_BY_DO = {
  'Все': ['Все', 'Зимнее', 'Новогоднее', 'Аганское', 'Приразломное'],
  'Хантос': ['Все', 'Зимнее'],
  'ННГ': ['Все', 'Новогоднее'],
  'Мегион': ['Все', 'Аганское'],
  'Шельф': ['Все', 'Приразломное'],
}

const SPARK_NPV_FULL = [320, 350, 380, 410, 450, 490]
const SPARK_DOBYCHA_FULL = [10, 10.5, 11, 11.8, 12, 12.5]

function reseed(seed) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
}

function buildFilteredData(period, doFilter, assetFilter) {
  const isAll = doFilter === 'Все' && assetFilter === 'Все'
  const rnd = reseed(Number(period) + (doFilter + assetFilter).length * 7)
  const k = isAll ? 1 : 0.15 + rnd() * 0.2
  const barData = BAR_DATA_FULL.map((d) => ({ ...d, value: Math.round(d.value * k) }))
  const lineData = LINE_DATA_FULL.map((d) => ({
    ...d,
    npv: Math.round(d.npv * k),
    cf: Math.round(d.cf * k),
  }))
  const comboData = COMBO_DATA_FULL.map((d) => ({
    ...d,
    fact: Math.round(d.fact * k),
    plan: Math.round(d.plan * k),
  }))
  const pieSum = PIE_DATA_BASE.reduce((s, x) => s + x.value, 0)
  const pieData = PIE_DATA_BASE.map((d) => ({
    ...d,
    value: Math.round((d.value / pieSum) * 100 * (isAll ? 1 : 0.2 + rnd() * 0.25)),
  }))
  const pieTotal = pieData.reduce((s, x) => s + x.value, 0) || 1
  const pieDataNorm = pieData.map((d) => ({ ...d, value: Math.round((d.value / pieTotal) * 100) }))
  let matrixData = MATRIX_DATA_FULL.filter(
    (r) => (doFilter === 'Все' || r.do === doFilter) && (assetFilter === 'Все' || r.asset === assetFilter)
  )
  if (matrixData.length === 0) matrixData = MATRIX_DATA_FULL
  if (!isAll) {
    matrixData = matrixData.map((r) => ({
      ...r,
      extraction: Number((r.extraction * k).toFixed(1)),
      capex: Math.round(r.capex * k),
    }))
  }
  const sparkNpv = SPARK_NPV_FULL.map((v) => Math.round(v * k))
  const sparkDobycha = SPARK_DOBYCHA_FULL.map((v) => Number((v * k).toFixed(1)))
  const cumulativeData = barData.map((d, i) => ({
    ...d,
    cumulative: barData.slice(0, i + 1).reduce((s, x) => s + x.value, 0),
  }))
  return {
    barData,
    lineData,
    comboData,
    pieData: pieDataNorm,
    matrixData: matrixData.length ? matrixData : MATRIX_DATA_FULL,
    cumulativeData,
    sparkNpv,
    sparkDobycha,
    kpiDobycha: (12.5 * k).toFixed(1),
    kpiNpv: (3.2 * k).toFixed(1),
    kpiCapex: (2.1 * k).toFixed(1),
    lastNpv: Math.round(490 * k),
    lastDobycha: (12.5 * k).toFixed(1),
  }
}

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

function Sparkline({ data, color = '#2d5a87', width = 240, height = 44 }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="results-sparkline-svg">
      <polyline fill="none" stroke={color} strokeWidth={2} points={points} />
    </svg>
  )
}

function ResultsTab() {
  const [period, setPeriod] = useState('2025')
  const [doFilter, setDoFilter] = useState('Все')
  const [assetFilter, setAssetFilter] = useState('Все')

  const assetOptions = ASSETS_BY_DO[doFilter] || ASSETS_BY_DO['Все']
  const safeAssetFilter = assetOptions.includes(assetFilter) ? assetFilter : 'Все'

  const data = useMemo(
    () => buildFilteredData(period, doFilter, safeAssetFilter),
    [period, doFilter, safeAssetFilter]
  )

  useEffect(() => {
    if (doFilter && ASSETS_BY_DO[doFilter] && !ASSETS_BY_DO[doFilter].includes(assetFilter)) setAssetFilter('Все')
  }, [doFilter])

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
          <select className="results-filter-select" value={safeAssetFilter} onChange={(e) => setAssetFilter(e.target.value)}>
            {assetOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="results-dashboard">
        <div className="results-widget results-widget-span-2 results-widget-bar">
          <h3>Накопительная гистограмма</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#2d5a87" radius={[4, 4, 0, 0]} name="Объём" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="results-widget results-widget-pie results-widget-pie-fixed">
          <h3>Структура показателей</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart margin={{ top: 8, right: 4, bottom: 32, left: 4 }}>
              <Pie
                data={data.pieData}
                cx="45%"
                cy="45%"
                innerRadius={38}
                outerRadius={72}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                label={false}
              >
                {data.pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [`${value}%`, name]} />
              <Legend layout="horizontal" align="center" verticalAlign="bottom" formatter={(value, entry) => `${value} ${entry.payload?.value ?? ''}%`} wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="results-widget results-widget-gauge results-widget-gauges">
          <h3>Выполнение плана</h3>
          <GaugeWidget value={98} label="план года" />
          <GaugeWidget value={92} label="план квартала" />
          <GaugeWidget value={88} max={120} label="план месяца" />
        </div>
        <div className="results-widget results-widget-span-2 results-widget-line">
          <h3>Динамика NPV и Cash flow</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.lineData}>
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
            <ComposedChart data={data.comboData}>
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
            <AreaChart data={data.cumulativeData}>
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
              <span className="results-kpi-value">{data.kpiDobycha}</span>
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
              <span className="results-kpi-value">{data.kpiCapex}</span>
              <span className="results-kpi-label">млрд CAPEX</span>
            </div>
            <div className="results-kpi-item">
              <span className="results-kpi-value">18</span>
              <span className="results-kpi-label">новых скважин</span>
            </div>
            <div className="results-kpi-item">
              <span className="results-kpi-value">{data.kpiNpv}</span>
              <span className="results-kpi-label">млрд NPV</span>
            </div>
          </div>
        </div>
        <div className="results-widget results-widget-spark">
          <h3>NPV тренд</h3>
          <div className="results-spark-axis-label">NPV, млн руб</div>
          <div className="results-spark-value">{data.lastNpv}</div>
          <div className="results-sparkline-wrap">
            <Sparkline data={data.sparkNpv} />
          </div>
          <div className="results-spark-axis-label results-spark-axis-x">период →</div>
        </div>
        <div className="results-widget results-widget-spark">
          <h3>Добыча тренд</h3>
          <div className="results-spark-axis-label">Добыча, млн т</div>
          <div className="results-spark-value">{data.lastDobycha}</div>
          <div className="results-sparkline-wrap">
            <Sparkline data={data.sparkDobycha} color="#22c55e" />
          </div>
          <div className="results-spark-axis-label results-spark-axis-x">период →</div>
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
                {data.matrixData.map((row, i) => (
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
