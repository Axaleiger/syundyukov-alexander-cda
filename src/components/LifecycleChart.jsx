import React, { useState, useEffect, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { loadLifecycleFromExcel } from '../data/loadLifecycleExcel'
import { getLifecycleStreamData } from '../data/lifecycleData'
import './LifecycleChart.css'

const CURRENT_YEAR = 2026
const LIFECYCLE_HISTORY_COLOR = '#3b82f6'
const LIFECYCLE_FORECAST_COLOR = '#22c55e'
const VIEW_MODES = [
  { id: 'default', label: 'По умолчанию' },
  { id: 'sum', label: 'Суммарно' },
  { id: 'cumulative', label: 'Накопление' },
]

const stages = [
  { key: 'geologorazvedka', name: 'Геологоразведка и работа с ресурсной базой', color: '#5b8dc9' },
  { key: 'razrabotka', name: 'Разработка', color: '#6b7fd7' },
  { key: 'planirovanie', name: 'Планирование и обустройство', color: '#8b7fd4' },
  { key: 'burenie', name: 'Бурение и ВСР', color: '#7eb8e8' },
  { key: 'dobycha', name: 'Добыча', color: '#6bc4a0' },
]

function buildCumulative(data) {
  const keys = stages.map((s) => s.key)
  return data.map((row, i) => {
    const out = { year: row.year }
    keys.forEach((key) => {
      let sum = 0
      for (let j = 0; j <= i; j++) sum += data[j][key] ?? 0
      out[key] = sum
    })
    return out
  })
}

function LifecycleChart({ onStageClick, faceSeed = 0 }) {
  const [selectedStage, setSelectedStage] = useState(null)
  const [streamData, setStreamData] = useState(null)
  const [viewMode, setViewMode] = useState('default')
  const [legendOnly, setLegendOnly] = useState(null)

  useEffect(() => {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') + '/'
    loadLifecycleFromExcel(base)
      .then(setStreamData)
      .catch(() => setStreamData(getLifecycleStreamData()))
  }, [])

  const chartData = useMemo(() => {
    if (!streamData || streamData.length === 0) return []
    const factor = faceSeed ? 0.9 + (faceSeed % 20) / 100 : 1
    const keys = stages.map((s) => s.key)
    const scale = (row) => {
      const out = { year: row.year }
      keys.forEach((k) => { out[k] = (row[k] ?? 0) * factor })
      return out
    }
    let data = streamData.map(scale)
    if (viewMode === 'cumulative') data = buildCumulative(data)
    return data
  }, [streamData, viewMode, faceSeed])

  const visibleStages = useMemo(() => {
    if (legendOnly == null) return stages
    return stages.filter((s) => s.key === legendOnly)
  }, [legendOnly])

  if (streamData == null || streamData.length === 0) {
    return (
      <div className="lifecycle-container">
        <div className="lifecycle-loading">
          <div className="lifecycle-spinner" />
          <span>Загрузка графика…</span>
        </div>
      </div>
    )
  }

  const handleLegendClick = (key) => {
    setLegendOnly((prev) => (prev === key ? null : key))
  }

  const handleAreaClick = (dataKey) => {
    const stage = stages.find((s) => s.key === dataKey)
    if (stage) onStageClick?.(stage.name)
  }

  return (
    <div className="lifecycle-container">
      <div className="lifecycle-view-toggle">
        {VIEW_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`lifecycle-toggle-btn ${viewMode === m.id ? 'active' : ''}`}
            onClick={() => setViewMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="lifecycle-chart lifecycle-streamgraph">
        <div className="lifecycle-legend-underline">
          {stages.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`lifecycle-legend-item ${legendOnly === s.key ? 'solo' : ''}`}
              onClick={() => handleLegendClick(s.key)}
            >
              <span className="lifecycle-legend-dot" style={{ background: s.color }} />
              <span className="lifecycle-legend-label">{s.name}</span>
            </button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={380}>
          <AreaChart data={chartData} margin={{ top: 20, right: 24, left: 32, bottom: 8 }} stackOffset={viewMode === 'sum' ? undefined : undefined}>
            <defs>
              {stages.map((s) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.5} />
                </linearGradient>
              ))}
            </defs>
            <ReferenceLine x={String(CURRENT_YEAR)} stroke="#fca5a5" strokeWidth={2} strokeOpacity={0.9} />
            <XAxis
              dataKey="year"
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={32}
              tick={({ x, y, payload }) => {
                const yNum = parseInt(String(payload.value), 10)
                const isHist = !Number.isNaN(yNum) && yNum <= CURRENT_YEAR
                const fill = isHist ? LIFECYCLE_HISTORY_COLOR : LIFECYCLE_FORECAST_COLOR
                return (
                  <g transform={`translate(${x},${y})`}>
                    <circle r={4} fill={fill} />
                    <text x={0} y={14} textAnchor="middle" fill="#5a6c7d" fontSize={10}>{payload.value}</text>
                  </g>
                )
              }}
            />
            <YAxis
              domain={[0, 'auto']}
              allowDataOverflow
              tick={{ fontSize: 10 }}
              label={{ value: viewMode === 'cumulative' ? 'Накопленный объём затрат, млрд руб.' : 'Объём затрат, млрд руб.', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(45, 90, 135, 0.12)',
              }}
              labelStyle={{ color: '#2d5a87', fontWeight: 600 }}
              formatter={(value, name) => [typeof value === 'number' ? value.toFixed(1) : value, stages.find((s) => s.key === name)?.name ?? name]}
              labelFormatter={(label) => `Год ${label}`}
            />
            {(viewMode === 'sum' && legendOnly == null
              ? stages
              : visibleStages
            ).map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stackId={viewMode === 'sum' && legendOnly == null ? '1' : undefined}
                stroke={s.color}
                strokeWidth={1.5}
                fill={`url(#grad-${s.key})`}
                onClick={() => handleAreaClick(s.key)}
                style={{ cursor: onStageClick ? 'pointer' : undefined }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="lifecycle-period-legend">
        <span className="lifecycle-legend-history">● История (до {CURRENT_YEAR})</span>
        <span className="lifecycle-legend-forecast">● Прогнозный период (после {CURRENT_YEAR})</span>
      </div>
      <p className="lifecycle-redline-hint">Красная линия — текущий срез {CURRENT_YEAR} г.</p>

      <div className="lifecycle-stages">
        <h4>Детализация этапов</h4>
        <div className="stages-grid">
          {stages.map((stage, index) => (
            <div
              key={stage.key}
              className={`stage-card ${selectedStage === stage.name ? 'selected' : ''}`}
              onClick={() => {
                const next = selectedStage === stage.name ? null : stage.name
                setSelectedStage(next)
                if (next) onStageClick?.(next)
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && (selectedStage === stage.name ? setSelectedStage(null) : (setSelectedStage(stage.name), onStageClick?.(stage.name)))}
              style={{ borderLeftColor: stage.color }}
            >
              <div className="stage-header">
                <span className="stage-number">{index + 1}</span>
                <h5 className="stage-name">{stage.name}</h5>
              </div>
              <div className="stage-accumulated">Выберите этап для деталей</div>
            </div>
          ))}
        </div>
      </div>

      {selectedStage && (
        <div className="stage-details">
          <h4>Детали этапа: {selectedStage}</h4>
          <div className="details-content">
            <p>
              Этап «{selectedStage}» отражает поток работ в рамках жизненного цикла актива. График выше показывает
              вклад этапов во времени в стиле streamgraph (слоистые потоки).
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default LifecycleChart
