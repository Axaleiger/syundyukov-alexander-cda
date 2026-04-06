import React, { useId, useMemo } from 'react'
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
const LABEL_RADIUS_STAND = 140
const LABEL_W_STAND = 102
const LABEL_H_STAND = 30

function polygonVertices(cx, cy, n, r, angleStep) {
  const verts = []
  for (let i = 0; i < n; i++) {
    const midAngle = i * angleStep + angleStep / 2 - Math.PI / 2
    verts.push([cx + Math.cos(midAngle) * r, cy + Math.sin(midAngle) * r])
  }
  return verts
}

function polygonPath(vertices) {
  if (vertices.length === 0) return ''
  const [x0, y0] = vertices[0]
  return `M ${x0},${y0}${vertices
    .slice(1)
    .map(([x, y]) => ` L ${x},${y}`)
    .join('')} Z`
}

function WindRose({
  data,
  centerTitle,
  selectedIndex,
  onSegmentClick,
  type = 'left',
  standVisual = false,
  showDiagram = true,
  showLegend = true,
}) {
  const gradUid = useId().replace(/:/g, '')
  const numItems = data.length
  const angleStep = numItems > 0 ? (2 * Math.PI) / numItems : 0

  const segments = useMemo(() => {
    if (numItems === 0) return []
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
      const petalColor = petalColorFromCoverage(item.coverage, index)
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
  }, [data, angleStep, numItems])

  const contourPath = useMemo(() => {
    if (segments.length === 0) return ''
    const pts = segments.map((s) => `${s.xEnd},${s.yEnd}`).join(' L ')
    return `M ${pts} Z`
  }, [segments])

  const isLeft = type === 'left'
  const labelCenter = WRAPPER_SIZE / 2
  const lr = standVisual ? LABEL_RADIUS_STAND : LABEL_RADIUS
  const lw = standVisual ? LABEL_W_STAND : LABEL_W
  const lh = standVisual ? LABEL_H_STAND : LABEL_H

  const gridScales = standVisual ? [0.2, 0.4, 0.6, 0.8, 1] : [0.25, 0.5, 0.75, 1]

  const standWedgePaths = useMemo(() => {
    if (!standVisual || segments.length === 0) return []
    return segments.map((_, i) => {
      const a = segments[i]
      const b = segments[(i + 1) % segments.length]
      return `M ${CENTER_X} ${CENTER_Y} L ${a.xEnd} ${a.yEnd} L ${b.xEnd} ${b.yEnd} Z`
    })
  }, [standVisual, segments])

  return (
    <div
      className={`wind-rose${standVisual ? ' wind-rose--stand-visual' : ''}${!showDiagram ? ' wind-rose--legend-only' : ''}`}
    >
      {showDiagram && (
        <div
          className="wind-rose-diagram"
          style={{ width: WRAPPER_SIZE, height: WRAPPER_SIZE }}
          aria-label={centerTitle || undefined}
        >
          <svg
            width={SVG_VIEW_SIZE}
            height={SVG_VIEW_SIZE}
            viewBox={`${SVG_VIEW_MIN} ${SVG_VIEW_MIN} ${SVG_VIEW_SIZE} ${SVG_VIEW_SIZE}`}
            className="wind-rose-svg"
          >
            {standVisual && (
              <defs>
                {segments.map((_, i) => (
                  <radialGradient
                    key={`g-${i}`}
                    id={`stand-wedge-grad-${gradUid}-${i}`}
                    cx="50%"
                    cy="50%"
                    r="70%"
                    fx="50%"
                    fy="50%"
                  >
                    <stop
                      offset="0%"
                      stopColor={i % 2 === 0 ? 'rgba(0, 48, 96, 0.55)' : 'rgba(0, 32, 70, 0.5)'}
                    />
                    <stop
                      offset="100%"
                      stopColor={i % 2 === 0 ? 'rgba(47, 180, 233, 0.42)' : 'rgba(0, 112, 186, 0.28)'}
                    />
                  </radialGradient>
                ))}
              </defs>
            )}

            {!standVisual &&
              gridScales.map((scale) => (
                <circle
                  key={scale}
                  cx={CENTER_X}
                  cy={CENTER_Y}
                  r={RADIUS * scale}
                  fill="none"
                  stroke="rgba(0, 64, 119, 0.18)"
                  strokeWidth="0.8"
                />
              ))}

            {standVisual &&
              numItems > 0 &&
              gridScales.map((scale) => {
                const verts = polygonVertices(CENTER_X, CENTER_Y, numItems, RADIUS * scale, angleStep)
                return (
                  <path
                    key={scale}
                    d={polygonPath(verts)}
                    fill="none"
                    stroke="rgba(47, 180, 233, 0.35)"
                    strokeWidth="0.65"
                  />
                )
              })}

            {data.map((_, i) => {
              const midAngle = i * angleStep + angleStep / 2 - Math.PI / 2
              const x = CENTER_X + Math.cos(midAngle) * RADIUS
              const y = CENTER_Y + Math.sin(midAngle) * RADIUS
              return (
                <line
                  key={i}
                  x1={CENTER_X}
                  y1={CENTER_Y}
                  x2={x}
                  y2={y}
                  stroke={standVisual ? 'rgba(47, 180, 233, 0.28)' : 'rgba(45, 90, 135, 0.15)'}
                  strokeWidth={standVisual ? 0.55 : 0.5}
                />
              )
            })}

            {standVisual &&
              standWedgePaths.map((d, i) => {
                const isSelected = selectedIndex === i
                const dim = selectedIndex != null && !isSelected
                return (
                  <path
                    key={`wedge-${i}`}
                    d={d}
                    fill={`url(#stand-wedge-grad-${gradUid}-${i})`}
                    fillOpacity={dim ? 0.22 : 1}
                    stroke="none"
                  />
                )
              })}

            {isLeft &&
              segments.map((s, i) =>
                selectedIndex == null || selectedIndex === i ? (
                  <line
                    key={`base-${i}`}
                    x1={CENTER_X}
                    y1={CENTER_Y}
                    x2={s.xBase}
                    y2={s.yBase}
                    stroke="#E65907"
                    strokeWidth={standVisual ? 2 : 1.8}
                    strokeOpacity={standVisual ? 0.85 : 0.7}
                  />
                ) : null
              )}

            {!standVisual &&
              segments.map((seg, index) => {
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

            {standVisual && contourPath && (
              <>
                <path
                  d={contourPath}
                  fill="none"
                  stroke="#E65907"
                  strokeWidth={2.6}
                  strokeLinejoin="round"
                  className="wind-rose-contour wind-rose-contour--stand"
                />
                {segments.map((s, index) => {
                  const isSelected = selectedIndex === index
                  const dim = selectedIndex != null && !isSelected
                  return (
                    <circle
                      key={`vx-${index}`}
                      cx={s.xEnd}
                      cy={s.yEnd}
                      r={dim ? 3.2 : 4.2}
                      fill="#E65907"
                      stroke="rgba(5, 22, 38, 0.4)"
                      strokeWidth="0.35"
                    />
                  )
                })}
              </>
            )}

            {!standVisual && (
              <path
                d={contourPath}
                fill="none"
                stroke="rgba(0, 64, 119, 0.45)"
                strokeWidth={1.4}
                strokeLinejoin="round"
                className="wind-rose-contour"
              />
            )}

            <circle
              cx={CENTER_X}
              cy={CENTER_Y}
              r={standVisual ? 8 : 10}
              fill={standVisual ? 'rgba(5, 22, 38, 0.92)' : '#fff'}
              stroke={standVisual ? 'rgba(47, 180, 233, 0.5)' : '#2d5a87'}
              strokeWidth={standVisual ? 1.1 : 1.4}
              opacity={0.98}
            />
          </svg>
          <div className="wind-rose-labels-outside">
            {segments.map((seg, index) => {
              const isSelected = selectedIndex === index
              const name = seg.name.length > 14 ? `${seg.name.slice(0, 12)}…` : seg.name
              const left = labelCenter + lr * Math.cos(seg.midAngle) - lw / 2
              const top = labelCenter + lr * Math.sin(seg.midAngle) - lh / 2
              return (
                <button
                  key={index}
                  type="button"
                  className={`wind-rose-outside-label ${isSelected ? 'wind-rose-outside-label-selected' : ''}${standVisual ? ' wind-rose-outside-label--stand' : ''}`}
                  style={{
                    left: `${left}px`,
                    top: `${top}px`,
                    width: lw,
                    height: lh,
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
      )}
      {showLegend && (
        <div className={`wind-rose-legend${standVisual ? ' wind-rose-legend--stand' : ''}`}>
          <div className="wind-rose-legend-items">
            {data.map((item, index) => {
              const isSelected = selectedIndex === index
              return (
                <button
                  key={index}
                  type="button"
                  className={`legend-item ${isSelected ? 'legend-item-selected' : ''}${standVisual ? ' legend-item--stand' : ''}`}
                  onClick={() => onSegmentClick(index)}
                  aria-label={`${item.name}, ${item.value}%`}
                >
                  <span
                    className="legend-dot"
                    style={
                      standVisual
                        ? undefined
                        : { background: petalColorFromCoverage(item.coverage, index) }
                    }
                  />
                  <span className="legend-name">{item.name}</span>
                  <span className="legend-value">{item.value}%</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default WindRose

export { PRODUCTION_STAGES, OBJECTS_BY_STAGE, DEFAULT_OBJECTS }
