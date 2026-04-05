import React, { useState, useMemo } from 'react'
import { useLifecycleData } from '../../model/useLifecycleData'
import { stages } from './lifecycleChartConstants'
import { buildCumulative, smoothSeries } from './lifecycleChartData'
import { LifecycleStreamGraphPanel } from './LifecycleStreamGraphPanel'
import { LifecycleStagesPanel } from './LifecycleStagesPanel'
import styles from './LifecycleChart.module.css'

function LifecycleChart({ onStageClick, faceSeed = 0 }) {
  const { streamData } = useLifecycleData()
  const [selectedStage, setSelectedStage] = useState(null)
  const [viewMode, setViewMode] = useState('sum')
  const [legendOnly, setLegendOnly] = useState(null)

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
    if (viewMode === 'cumulative') {
      data = buildCumulative(data)
    } else {
      keys.forEach((key) => { data = smoothSeries(data, key) })
    }
    return data
  }, [streamData, viewMode, faceSeed])

  const visibleStages = useMemo(() => {
    if (legendOnly == null) return stages
    return stages.filter((s) => s.key === legendOnly)
  }, [legendOnly])

  if (streamData == null || streamData.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Загрузка графика…</span>
        </div>
      </div>
    )
  }

  const handleLegendClick = (key) => {
    setLegendOnly((prev) => (prev === key ? null : key))
  }

  return (
    <div className={styles.container}>
      <LifecycleStreamGraphPanel
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        legendOnly={legendOnly}
        onLegendClick={handleLegendClick}
        chartData={chartData}
        visibleStages={visibleStages}
        onStageClick={onStageClick}
      />
      <LifecycleStagesPanel
        selectedStage={selectedStage}
        setSelectedStage={setSelectedStage}
        onStageClick={onStageClick}
      />
    </div>
  )
}

export default LifecycleChart
