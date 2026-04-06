import React, { useEffect, useRef, useState } from 'react'
import styles from './RightPanel.module.css'

function formatVal(v, decimals) {
  if (!Number.isFinite(v)) return '—'
  return Number(v).toFixed(decimals)
}

function deltaIsGood(favorable, amount) {
  if (amount === 0) return true
  return favorable ? amount > 0 : amount < 0
}

export function ScenarioMetricRow({
  metricDef,
  base,
  delta,
  showAiDeltas,
  rowIndex,
  scenarioStaggerMs,
  revision,
  /** Тёмный фон карточки (демо-dock) */
  dockOnDark = false,
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
  const good = delta ? deltaIsGood(delta.favorable, delta.amount) : true
  const rawAmt = delta?.amount ?? 0
  const arrow = rawAmt >= 0 ? '↑' : '↓'
  const signStr = rawAmt >= 0 ? '+' : '−'
  const deltaDecimals = key === 'irrPct' ? 1 : decimals
  const deltaSuffix = key === 'irrPct' ? ' п.п.' : ` ${unit}`

  return (
    <div
      className={`${styles['rp-metric-row']} ${dockOnDark ? styles.rpDock : ''}`}
    >
      <span className={styles['rp-metric-label']}>{label}</span>
      <div className={styles['rp-metric-value-wrap']}>
        <span className={styles['rp-metric-value']}>
          {formatVal(display, decimals)}
          <span className={styles['rp-metric-unit']}> {unit}</span>
        </span>
        {showChip && (
          <span
            className={`${styles['rp-metric-delta']} ${good ? styles['rp-metric-delta--good'] : styles['rp-metric-delta--bad']} ${styles['rp-metric-delta--visible']}`}
          >
            {signStr}
            {formatVal(Math.abs(rawAmt), deltaDecimals)}
            {deltaSuffix} {arrow}
          </span>
        )}
      </div>
    </div>
  )
}
