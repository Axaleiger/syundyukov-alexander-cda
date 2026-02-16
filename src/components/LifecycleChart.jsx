import React, { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { loadLifecycleFromExcel } from '../data/loadLifecycleExcel'
import { getLifecycleStreamData } from '../data/lifecycleData'
import './LifecycleChart.css'

const CURRENT_YEAR = 2026

const stages = [
  { key: 'geologorazvedka', name: 'Геологоразведка и работа с ресурсной базой', color: '#5b8dc9' },
  { key: 'razrabotka', name: 'Разработка', color: '#6b7fd7' },
  { key: 'planirovanie', name: 'Планирование и обустройство', color: '#8b7fd4' },
  { key: 'burenie', name: 'Бурение и ВСР', color: '#7eb8e8' },
  { key: 'dobycha', name: 'Добыча', color: '#6bc4a0' },
]

function LifecycleChart({ onStageClick }) {
  const [selectedStage, setSelectedStage] = useState(null)
  const [streamData, setStreamData] = useState(null)

  useEffect(() => {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') + '/'
    loadLifecycleFromExcel(base)
      .then(setStreamData)
      .catch(() => setStreamData(getLifecycleStreamData()))
  }, [])

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

  return (
    <div className="lifecycle-container">
      <div className="lifecycle-chart lifecycle-streamgraph">
        <ResponsiveContainer width="100%" height={380}>
          <AreaChart data={streamData} margin={{ top: 20, right: 24, left: 32, bottom: 8 }} stackOffset="wiggle">
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
              tick={{ fill: '#5a6c7d', fontSize: 11 }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={32}
            />
            <YAxis
              domain={[0, 'auto']}
              allowDataOverflow
              tick={{ fontSize: 10 }}
              label={{ value: 'Объём затрат, млрд руб.', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(45, 90, 135, 0.12)',
              }}
              labelStyle={{ color: '#2d5a87', fontWeight: 600 }}
              formatter={(value, name) => [value.toFixed(1), stages.find((s) => s.key === name)?.name ?? name]}
              labelFormatter={(label) => `Год ${label}`}
            />
            <Legend
              verticalAlign="top"
              height={40}
              formatter={(value) => stages.find((s) => s.name === value)?.name ?? value}
              iconType="circle"
              iconSize={10}
              wrapperStyle={{ paddingBottom: 12 }}
            />
            {stages.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stackId="1"
                stroke={s.color}
                strokeWidth={1.5}
                fill={`url(#grad-${s.key})`}
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
