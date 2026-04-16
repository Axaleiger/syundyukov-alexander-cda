import React, { useEffect, useRef, useState } from 'react'

function formatVal(v, decimals) {
  if (!Number.isFinite(v)) return '—'
  return Number(v).toFixed(decimals)
}

function deltaMagnitudeDecimals(metricKey, absAmt, rowDecimals) {
  if (!Number.isFinite(absAmt) || absAmt === 0) return null
  const maxD = metricKey === 'irrPct' ? 2 : 4
  const start = metricKey === 'irrPct' ? 1 : Math.max(1, rowDecimals)
  for (let d = start; d <= maxD; d += 1) {
    if (Number.parseFloat(absAmt.toFixed(d)) !== 0) return d
  }
  return null
}

function deltaIsGoodForMetric(metricKey, amount) {
  if (!Number.isFinite(amount) || amount === 0) return true
  if (metricKey === 'capexB' || metricKey === 'opexB') return amount < 0
  return amount > 0
}

export function ScenarioMetricRow({
  metricDef,
  base,
  delta,
  showAiDeltas,
  rowIndex,
  scenarioStaggerMs,
  revision,
}) {
  const { label, unit, decimals, key } = metricDef
  const final = base + (delta && showAiDeltas ? delta.amount : 0)
  const [display, setDisplay] = useState(base)
  const rafRef = useRef(null)
  const [chipVisible, setChipVisible] = useState(false)

  useEffect(() => {
    if (!showAiDeltas) setDisplay(base)
  }, [base, showAiDeltas])

  useEffect(() => {
    if (!showAiDeltas || !delta) {
      setDisplay(base)
      setChipVisible(false)
      return undefined
    }
    const from = base
    const to = final
    const dur = 680
    const t0 = performance.now()
    const startDelay = scenarioStaggerMs + rowIndex * 78

    const run = () => {
      const tick = (now) => {
        const elapsed = now - t0
        const u = Math.min(1, elapsed / dur)
        const e = 1 - (1 - u) ** 2
        setDisplay(from + (to - from) * e)
        if (u < 1) rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    const id = window.setTimeout(run, startDelay)
    return () => {
      clearTimeout(id)
      cancelAnimationFrame(rafRef.current)
    }
  }, [base, final, showAiDeltas, delta, rowIndex, scenarioStaggerMs, revision, key])

  useEffect(() => {
    if (!showAiDeltas || !delta) {
      setChipVisible(false)
      return undefined
    }
    const t = window.setTimeout(
      () => setChipVisible(true),
      scenarioStaggerMs + rowIndex * 78 + 420
    )
    return () => clearTimeout(t)
  }, [showAiDeltas, delta, rowIndex, scenarioStaggerMs, revision])

  const showChip = showAiDeltas && delta && chipVisible
  const good = delta ? deltaIsGoodForMetric(key, delta.amount) : true
  const rawAmt = delta?.amount ?? 0
  const absAmt = Math.abs(rawAmt)
  const deltaMagDecimals = deltaMagnitudeDecimals(key, absAmt, decimals)
  const showDeltaChip = showChip && deltaMagDecimals != null
  const arrow = rawAmt >= 0 ? '↑' : '↓'
  const signStr = rawAmt >= 0 ? '+' : '−'
  const deltaSuffix = key === 'irrPct' ? ' п.п.' : ` ${unit}`

  return (
    <div className="rp-metric-row">
      <span className="rp-metric-label">{label}</span>
      <div className="rp-metric-value-wrap">
        <span className="rp-metric-value">
          {formatVal(display, decimals)}
          <span className="rp-metric-unit"> {unit}</span>
        </span>
        {showDeltaChip && (
          <span
            className={`rp-metric-delta ${good ? 'rp-metric-delta--good' : 'rp-metric-delta--bad'} rp-metric-delta--visible`}
          >
            {signStr}
            {formatVal(absAmt, deltaMagDecimals)}
            {deltaSuffix} {arrow}
          </span>
        )}
      </div>
    </div>
  )
}
