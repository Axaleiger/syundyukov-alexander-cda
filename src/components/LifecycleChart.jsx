import React, { useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './LifecycleChart.css'

const stages = [
  { key: 'razvedka', name: 'Разведка', color: '#5b8dc9' },
  { key: 'razrabotka', name: 'Разработка', color: '#6b7fd7' },
  { key: 'burenie', name: 'Бурение', color: '#8b7fd4' },
  { key: 'dobycha', name: 'Добыча', color: '#7eb8e8' },
  { key: 'zavershenie', name: 'Завершение', color: '#6bc4a0' },
]

function generateStreamData() {
  const years = []
  for (let y = 2020; y <= 2030; y++) {
    const t = (y - 2020) / 10
    years.push({
      year: String(y),
      razvedka: 12 + 8 * Math.sin(t * Math.PI) + 3 * Math.sin(t * 4),
      razrabotka: 18 + 12 * Math.sin(t * Math.PI + 0.3) + 4 * Math.sin(t * 3),
      burenie: 22 + 18 * Math.sin(t * Math.PI + 0.5) + 5 * Math.sin(t * 2.5),
      dobycha: 20 + 15 * Math.sin(t * Math.PI + 0.7) + 4 * Math.sin(t * 2),
      zavershenie: 10 + 10 * Math.sin(t * Math.PI + 0.9) + 2 * Math.sin(t * 3),
    })
  }
  return years
}

function LifecycleChart() {
  const [selectedStage, setSelectedStage] = useState(null)
  const streamData = useMemo(() => generateStreamData(), [])

  return (
    <div className="lifecycle-container">
      <div className="lifecycle-header">
        <h3>Этапы жизненного цикла актива</h3>
        <p>Поток по этапам во времени (стиль streamgraph)</p>
      </div>

      <div className="lifecycle-chart lifecycle-streamgraph">
        <ResponsiveContainer width="100%" height={380}>
          <AreaChart data={streamData} margin={{ top: 20, right: 24, left: 8, bottom: 8 }} stackOffset="wiggle">
            <defs>
              {stages.map((s) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.5} />
                </linearGradient>
              ))}
            </defs>
            <XAxis
              dataKey="year"
              axisLine={{ stroke: '#e2e8f0' }}
              tick={{ fill: '#5a6c7d', fontSize: 12 }}
              tickLine={false}
            />
            <YAxis hide domain={['auto', 'auto']} />
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

      <div className="lifecycle-stages">
        <h4>Детализация этапов</h4>
        <div className="stages-grid">
          {stages.map((stage, index) => (
            <div
              key={stage.key}
              className={`stage-card ${selectedStage === stage.name ? 'selected' : ''}`}
              onClick={() => setSelectedStage(selectedStage === stage.name ? null : stage.name)}
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
