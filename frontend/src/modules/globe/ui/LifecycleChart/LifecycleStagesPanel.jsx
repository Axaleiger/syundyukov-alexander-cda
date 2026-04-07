import React from 'react'
import { stages } from './lifecycleChartConstants'
import styles from './LifecycleStagesPanel.module.css'

/**
 * Сетка карточек этапов + блок деталей (нижняя визуальная зона LifecycleChart).
 */
export function LifecycleStagesPanel({ selectedStage, setSelectedStage, onStageClick }) {
  return (
    <>
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Детализация этапов</h4>
        <div className={styles.grid}>
          {stages.map((stage, index) => (
            <div
              key={stage.key}
              className={`${styles.card} ${selectedStage === stage.name ? styles.cardSelected : ''}`}
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
              <div className={styles.cardHeader}>
                <span className={styles.cardIndex}>{index + 1}</span>
                <h5 className={styles.cardName}>{stage.name}</h5>
              </div>
              <div className={styles.cardHint}>Выберите этап для деталей</div>
            </div>
          ))}
        </div>
      </div>

      {selectedStage && (
        <div className={styles.details}>
          <h4 className={styles.detailsTitle}>Детали этапа: {selectedStage}</h4>
          <div>
            <p className={styles.detailsBody}>
              Этап «{selectedStage}» отражает поток работ в рамках жизненного цикла актива. График выше показывает
              вклад этапов во времени в стиле streamgraph (слоистые потоки).
            </p>
          </div>
        </div>
      )}
    </>
  )
}
