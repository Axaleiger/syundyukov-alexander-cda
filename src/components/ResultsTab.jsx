import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area } from 'recharts'
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

function ResultsTab() {
  return (
    <div className="results-tab">
      <h2 className="results-tab-title">Результаты и аналитика</h2>
      <div className="results-dashboard">
        <div className="results-widget results-widget-bar">
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
        <div className="results-widget results-widget-line">
          <h3>Динамика NPV и CF</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={LINE_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="npv" stroke="#2d5a87" strokeWidth={2} name="NPV" dot={{ r: 4 }} />
              <Line type="monotone" dataKey="cf" stroke="#22c55e" strokeWidth={2} name="CF" dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="results-widget results-widget-area">
          <h3>Накопительный тренд</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={CUMULATIVE_DATA}>
              <defs>
                <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2d5a87" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#2d5a87" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="cumulative" fill="url(#cumGrad)" stroke="#2d5a87" strokeWidth={2} name="Накопит." />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="results-widget results-widget-kpi">
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
          </div>
        </div>
        <div className="results-widget results-widget-table">
          <h3>Сводка по активам</h3>
          <div className="results-mini-table">
            <table>
              <thead>
                <tr><th>Актив</th><th>Добыча</th><th>Статус</th></tr>
              </thead>
              <tbody>
                <tr><td>Зимнее</td><td>5.2</td><td>✓</td></tr>
                <tr><td>Новогоднее</td><td>4.1</td><td>✓</td></tr>
                <tr><td>Аганское</td><td>3.2</td><td>◐</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResultsTab
