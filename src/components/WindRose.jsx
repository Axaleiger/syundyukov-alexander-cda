import React, { useMemo } from 'react'
import { PRODUCTION_STAGES, OBJECTS_BY_STAGE, DEFAULT_OBJECTS, petalColorFromCoverage } from '../data/rosesData'
import './WindRose.css'

const RADIUS = 100
const CENTER_X = 160
const CENTER_Y = 160
const SVG_VIEW_SIZE = 200
const WRAPPER_SIZE = 380
const SVG_VIEW_MIN = CENTER_X - RADIUS
const LABEL_RADIUS = 138
const LABEL_W = 88
const LABEL_H = 26

function WindRose({
  data,
  centerTitle,
  selectedIndex,
  onSegmentClick,
  type = 'left',
}) {
  const numItems = data.length
  const angleStep = (2 * Math.PI) / numItems

  const segments = useMemo(() => {
    const baseline = data.map((d) => Math.max(0, (d.value / 100) * RADIUS * 0.55))
    return data.map((item, index) => {
      const angle = index * angleStep - Math.PI / 2
      const midAngle = angle + angleStep / 2
      const length = (item.value / 100) * RADIUS
      const xEnd = CENTER_X + Math.cos(midAngle) * length
      const yEnd = CENTER_Y + Math.sin(midAngle) * length
      const baseLen = baseline[index]
      const xBase = CENTER_X + Math.cos(midAngle) * baseLen
      const yBase = CENTER_Y + Math.sin(midAngle) * baseLen
      const petalColor = petalColorFromCoverage(item.coverage)
      return {
        ...item,
        midAngle,
        xEnd,
        yEnd,
        xBase,
        yBase,
        petalColor,
      }
    })
  }, [data, angleStep])

  const contourPath = useMemo(() => {
    if (segments.length === 0) return ''
    const pts = segments.map((s) => `${s.xEnd},${s.yEnd}`).join(' L ')
    return `M ${pts} Z`
  }, [segments])

  const isLeft = type === 'left'

  const labelCenter = WRAPPER_SIZE / 2

  return (
    <div className="wind-rose">
      <div className="wind-rose-diagram" style={{ width: WRAPPER_SIZE, height: WRAPPER_SIZE }}>
        <svg
          width={SVG_VIEW_SIZE}
          height={SVG_VIEW_SIZE}
          viewBox={`${SVG_VIEW_MIN} ${SVG_VIEW_MIN} ${SVG_VIEW_SIZE} ${SVG_VIEW_SIZE}`}
          className="wind-rose-svg"
        >
          {/* Сетка: концентрические окружности */}
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <circle
            key={scale}
            cx={CENTER_X}
            cy={CENTER_Y}
            r={RADIUS * scale}
            fill="none"
            stroke="rgba(45, 90, 135, 0.12)"
            strokeWidth="0.8"
          />
        ))}
        {/* Оси от центра к границе */}
        {data.map((_, i) => {
          const a = i * angleStep - Math.PI / 2
          const x = CENTER_X + Math.cos(a) * RADIUS
          const y = CENTER_Y + Math.sin(a) * RADIUS
          return (
            <line
              key={i}
              x1={CENTER_X}
              y1={CENTER_Y}
              x2={x}
              y2={y}
              stroke="rgba(45, 90, 135, 0.15)"
              strokeWidth="0.5"
            />
          )
        })}
        {/* Базовая серия — только для левой розы */}
        {isLeft &&
          segments.map((s, i) => (
            <line
              key={`base-${i}`}
              x1={CENTER_X}
              y1={CENTER_Y}
              x2={s.xBase}
              y2={s.yBase}
              stroke="#b85a4a"
              strokeWidth={1.8}
              strokeOpacity={0.7}
            />
          ))}
        {/* Лепестки (линии значений) */}
        {segments.map((seg, index) => {
          const isSelected = selectedIndex === index
          const opacity = selectedIndex == null ? 1 : isSelected ? 1 : 0.28
          return (
            <line
              key={index}
              x1={CENTER_X}
              y1={CENTER_Y}
              x2={seg.xEnd}
              y2={seg.yEnd}
              stroke={seg.petalColor}
              strokeWidth={isSelected ? 3.2 : 2.2}
              strokeOpacity={opacity}
              strokeLinecap="round"
              className="wind-rose-petal"
              style={{ pointerEvents: 'none' }}
            />
          )
        })}
        {/* Контур розы */}
        <path
          d={contourPath}
          fill="none"
          stroke="rgba(45, 90, 135, 0.38)"
          strokeWidth={1.4}
          strokeLinejoin="round"
          className="wind-rose-contour"
        />
        {/* Центр */}
        <circle cx={CENTER_X} cy={CENTER_Y} r="10" fill="#fff" stroke="#2d5a87" strokeWidth={1.4} opacity={0.98} />
        </svg>
        {/* Подписи за пределами SVG */}
        <div className="wind-rose-labels-outside">
          {segments.map((seg, index) => {
            const isSelected = selectedIndex === index
            const name = seg.name.length > 14 ? seg.name.slice(0, 12) + '…' : seg.name
            const left = labelCenter + LABEL_RADIUS * Math.cos(seg.midAngle) - LABEL_W / 2
            const top = labelCenter + LABEL_RADIUS * Math.sin(seg.midAngle) - LABEL_H / 2
            return (
              <button
                key={index}
                type="button"
                className={`wind-rose-outside-label ${isSelected ? 'wind-rose-outside-label-selected' : ''}`}
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: LABEL_W,
                  height: LABEL_H,
                }}
                onClick={() => onSegmentClick(index)}
                aria-label={seg.name}
              >
                <span className="wind-rose-outside-name">{name}</span>
                <span className="wind-rose-outside-value">{seg.value}%</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="wind-rose-legend">
        <div className="wind-rose-legend-items">
          {data.map((item, index) => {
            const isSelected = selectedIndex === index
            return (
              <button
                key={index}
                type="button"
                className={`legend-item ${isSelected ? 'legend-item-selected' : ''}`}
                onClick={() => onSegmentClick(index)}
                aria-label={`${item.name}, ${item.value}%`}
              >
                <span
                  className="legend-dot"
                  style={{ background: petalColorFromCoverage(item.coverage) }}
                />
                <span className="legend-name">{item.name}</span>
                <span className="legend-value">{item.value}%</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default WindRose

export { PRODUCTION_STAGES, OBJECTS_BY_STAGE, DEFAULT_OBJECTS }
