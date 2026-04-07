import React from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Customized } from 'recharts'
import styles from './LifecycleStreamGraphPanel.module.css'
import {
  CURRENT_YEAR,
  LIFECYCLE_FORECAST_COLOR,
  LIFECYCLE_HISTORY_COLOR,
  LIFECYCLE_YEAR_TICKS,
  VIEW_MODES,
  stages,
} from './lifecycleChartConstants'

function LifecycleSegmentLines(props) {
  const { xAxisMap, yAxisMap } = props
  const xAxis = xAxisMap && Object.values(xAxisMap)[0]
  const yAxis = yAxisMap && Object.values(yAxisMap)[0]
  if (!xAxis || !yAxis) return null
  const xScale = xAxis.scale
  const yScale = yAxis.scale
  const y0 = yScale(0)
  if (typeof y0 !== 'number') return null
  const bandwidth = xScale.bandwidth ? xScale.bandwidth() : 0
  const lines = []
  for (let i = 0; i < LIFECYCLE_YEAR_TICKS.length - 1; i++) {
    const x1 = LIFECYCLE_YEAR_TICKS[i]
    const x2 = LIFECYCLE_YEAR_TICKS[i + 1]
    const y2Num = parseInt(x2, 10)
    const endColor = !Number.isNaN(y2Num) && y2Num <= CURRENT_YEAR ? LIFECYCLE_HISTORY_COLOR : LIFECYCLE_FORECAST_COLOR
    let px1 = xScale(x1)
    let px2 = xScale(x2)
    if (typeof bandwidth === 'number' && bandwidth > 0) {
      px1 = typeof px1 === 'number' ? px1 + bandwidth / 2 : px1
      px2 = typeof px2 === 'number' ? px2 + bandwidth / 2 : px2
    }
    if (typeof px1 !== 'number' || typeof px2 !== 'number') continue
    lines.push({ key: `${x1}-${x2}`, x1: px1, x2: px2, y: y0, color: endColor })
  }
  const points = LIFECYCLE_YEAR_TICKS.map((yearStr) => {
    let px = xScale(yearStr)
    if (typeof bandwidth === 'number' && bandwidth > 0 && typeof px === 'number') px = px + bandwidth / 2
    if (typeof px !== 'number') return null
    const yNum = parseInt(yearStr, 10)
    const color = !Number.isNaN(yNum) && yNum <= CURRENT_YEAR ? LIFECYCLE_HISTORY_COLOR : LIFECYCLE_FORECAST_COLOR
    return { key: yearStr, x: px, y: y0, color }
  }).filter(Boolean)
  return (
    <g className={styles.segmentLinesRoot}>
      {lines.map(({ key, x1, x2, y, color }) => (
        <line key={key} x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth={3} strokeLinecap="round" />
      ))}
      {points.map(({ key, x, y: py, color }) => (
        <g key={key}>
          <circle cx={x} cy={py} r={5} fill={color} />
          <circle cx={x} cy={py} r={2} fill="#fff" />
        </g>
      ))}
    </g>
  )
}

/**
 * Режимы просмотра + streamgraph + легенда периодов (верхняя визуальная зона LifecycleChart).
 * compactOverlay / hudExpanded — как demo-stand LifecycleChart в HUD (?demo=stand#face).
 */
export function LifecycleStreamGraphPanel({
  viewMode,
  onViewModeChange,
  legendOnly,
  onLegendClick,
  chartData,
  visibleStages,
  onStageClick,
  compactOverlay = false,
  hudExpanded = false,
}) {
  const handleAreaClick = (dataKey) => {
    const stage = stages.find((s) => s.key === dataKey)
    if (stage) onStageClick?.(stage.name)
  }

  const chartHeight = compactOverlay ? (hudExpanded ? 220 : 200) : 380
  const chartMargin = compactOverlay
    ? { top: 4, right: 4, left: 4, bottom: 0 }
    : { top: 20, right: 24, left: 32, bottom: 8 }
  const axisTickFill = compactOverlay ? 'rgba(255,255,255,0.72)' : '#5a6c7d'

  const tooltipContentStyle = compactOverlay
    ? {
        backgroundColor: 'rgba(255,255,255,0.95)',
        border: '1px solid #004077',
        borderRadius: 12,
        boxShadow: '0 8px 24px rgba(0, 64, 119, 0.2)',
      }
    : {
        backgroundColor: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        boxShadow: '0 8px 24px rgba(45, 90, 135, 0.12)',
      }

  const tooltipLabelStyle = compactOverlay
    ? { color: '#004077', fontWeight: 600 }
    : { color: '#2d5a87', fontWeight: 600 }

  return (
    <>
      {!compactOverlay ? (
        <div className={styles.viewToggle}>
          {VIEW_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`${styles.toggleBtn} ${viewMode === m.id ? styles.toggleBtnActive : ''}`}
              onClick={() => onViewModeChange(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className={[styles.chartWrap, compactOverlay && styles.chartWrapCompact].filter(Boolean).join(' ')}>
        {!compactOverlay ? (
          <div className={styles.legendRow}>
            {stages.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`${styles.legendItem} ${legendOnly === s.key ? styles.legendItemSolo : ''}`}
                onClick={() => onLegendClick(s.key)}
              >
                <span className={styles.legendSwatch} style={{ background: s.color }} />
                <span className={styles.legendCaption}>{s.name}</span>
              </button>
            ))}
          </div>
        ) : null}
        <ResponsiveContainer width="100%" height={chartHeight}>
          <AreaChart
            data={chartData}
            margin={chartMargin}
            isAnimationActive={false}
            stackOffset={viewMode === 'sum' ? undefined : undefined}
          >
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
              axisLine={{ stroke: compactOverlay ? 'rgba(255,255,255,0.2)' : '#e2e8f0' }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={compactOverlay ? 18 : 32}
              tick={({ x, y, payload }) => (
                  <g transform={`translate(${x},${y})`}>
                    <text x={0} y={14} textAnchor="middle" fill={axisTickFill} fontSize={compactOverlay ? 9 : 10}>
                      {payload.value}
                    </text>
                  </g>
                )}
            />
            <YAxis
              domain={[0, 'auto']}
              allowDataOverflow
              tick={{ fontSize: compactOverlay ? 9 : 10, fill: axisTickFill }}
              label={
                compactOverlay
                  ? undefined
                  : {
                      value:
                        viewMode === 'cumulative'
                          ? 'Накопленный объём затрат, млрд руб.'
                          : 'Объём затрат, млрд руб.',
                      angle: -90,
                      position: 'insideLeft',
                      style: { textAnchor: 'middle' },
                    }
              }
            />
            <Tooltip
              contentStyle={tooltipContentStyle}
              labelStyle={tooltipLabelStyle}
              formatter={(value, name) => [
                typeof value === 'number' ? value.toFixed(1) : value,
                stages.find((s) => s.key === name)?.name ?? name,
              ]}
              labelFormatter={(label) => `Год ${label}`}
            />
            {(viewMode === 'sum' && legendOnly == null ? stages : visibleStages).map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stackId={viewMode === 'sum' && legendOnly == null ? '1' : undefined}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#grad-${s.key})`}
                connectNulls
                onClick={() => handleAreaClick(s.key)}
                style={{ cursor: onStageClick ? 'pointer' : undefined }}
                isAnimationActive={false}
              />
            ))}
            <Customized component={LifecycleSegmentLines} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {!compactOverlay ? (
        <>
          <div className={styles.periodLegend}>
            <span className={styles.periodHistory} style={{ color: LIFECYCLE_HISTORY_COLOR }}>
              ● История (до {CURRENT_YEAR})
            </span>
            <span className={styles.periodForecast} style={{ color: LIFECYCLE_FORECAST_COLOR }}>
              ● Прогнозный период (после {CURRENT_YEAR})
            </span>
          </div>
          <p className={styles.redlineHint}>Красная линия — текущий срез {CURRENT_YEAR} г.</p>
        </>
      ) : null}
      {compactOverlay && hudExpanded ? (
        <div className={styles.hudExpandedDesc}>
          <p>
            Жизненный цикл актива охватывает этапы от геологоразведки до добычи. На графике — динамика затрат по
            этапам; синяя ось времени отделяет историю и прогноз. На вкладке «Главная» доступны переключение вида и
            детализация по этапам.
          </p>
        </div>
      ) : null}
    </>
  )
}
