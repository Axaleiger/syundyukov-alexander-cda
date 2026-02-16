import React, { useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import './LifecycleChart.css'

const CURRENT_YEAR = 2026

const stages = [
  { key: 'geologorazvedka', name: 'Геологоразведка и работа с ресурсной базой', color: '#5b8dc9' },
  { key: 'razrabotka', name: 'Разработка', color: '#6b7fd7' },
  { key: 'planirovanie', name: 'Планирование и обустройство', color: '#8b7fd4' },
  { key: 'burenie', name: 'Бурение и ВСР', color: '#7eb8e8' },
  { key: 'dobycha', name: 'Добыча', color: '#6bc4a0' },
]

const END_YEAR = 2065

function generateStreamData() {
  const years = []
  const startYear = 1965
  const endYear = END_YEAR
  for (let y = startYear; y <= endYear; y++) {
    const t = (y - startYear) / (endYear - startYear)
    const norm = (x) => Math.max(0, x)
    const geologorazvedka = norm(
      18 * Math.exp(-Math.pow((y - 1982) / 18, 2)) +
      4 * Math.exp(-Math.pow((y - 2025) / 6, 2)) +
      2 * (1 + 0.3 * Math.sin((y - 1965) * 0.25))
    )
    const razrabotka = norm(
      8 + 14 * (1 - Math.pow(t - 0.35, 2) * 2) +
      3 * Math.sin((y - 1970) * 0.15) +
      2 * Math.sin((y - 2010) * 0.2)
    )
    const burenie = norm(
      5 + 20 * Math.exp(-Math.pow((y - 1975) / 12, 2)) +
      8 * Math.exp(-Math.pow((y - 1992) / 8, 2)) +
      6 * Math.exp(-Math.pow((y - 2008) / 6, 2)) +
      4 * Math.exp(-Math.pow((y - 2022) / 5, 2)) +
      2 * Math.sin((y - 1965) * 0.2)
    )
    /* Классическая кривая разработки месторождения: рост — полка — спад не до конца — небольшой плавный рост */
    const tD = (y - startYear) / (endYear - startYear)
    const phase1 = tD < 0.15 ? tD / 0.15 : 1
    const phase2 = tD >= 0.15 && tD < 0.35 ? 1 : tD >= 0.35 && tD < 0.65 ? 1 - (tD - 0.35) / 0.5 * 0.7 : 0.3
    const phase3 = tD >= 0.65 ? 0.3 + 0.15 * (1 - Math.cos((tD - 0.65) / 0.35 * Math.PI)) : 0
    const dobycha = norm(
      3 + 22 * (phase1 * 0.4 + phase2 * 0.5 + phase3) +
      2 * Math.sin((y - 1985) * 0.1) +
      1 * Math.sin((y - 2015) * 0.12)
    )
    const planirovanie = norm(
      4 + 10 * Math.exp(-Math.pow((y - 1990) / 12, 2)) +
      6 * Math.exp(-Math.pow((y - 2015) / 8, 2)) +
      2 * Math.sin((y - 1980) * 0.12)
    )
    years.push({
      year: String(y),
      geologorazvedka: Math.round(geologorazvedka * 10) / 10,
      razrabotka: Math.round(razrabotka * 10) / 10,
      planirovanie: Math.round(planirovanie * 10) / 10,
      burenie: Math.round(burenie * 10) / 10,
      dobycha: Math.round(dobycha * 10) / 10,
    })
  }
  return years
}

function LifecycleChart({ onStageClick }) {
  const [selectedStage, setSelectedStage] = useState(null)
  const streamData = useMemo(() => generateStreamData(), [])

  return (
    <div className="lifecycle-container">
      <p className="lifecycle-cost-caption">Объём затрат, млрд руб.</p>
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
            <ReferenceLine x={String(CURRENT_YEAR)} stroke="#fca5a5" strokeWidth={2} strokeOpacity={0.9} />
            <XAxis
              dataKey="year"
              axisLine={{ stroke: '#e2e8f0' }}
              tick={{ fill: '#5a6c7d', fontSize: 11 }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={32}
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
