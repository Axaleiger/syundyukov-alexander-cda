import React from 'react'
import { INDICATOR_BASKETS, VARIANT_COLORS } from './hypercube3DLegendData'
import styles from './HypercubeInfoPanel.module.css'

/**
 * Левая колонка: метрики, легенды вариантов и индикаторов, переключатель карты рисков.
 */
export function HypercubeInfoPanel({
  npvMillions,
  reservesMillions,
  extractionMillions,
  filterVariantType,
  setFilterVariantType,
  showRisks,
  setShowRisks,
}) {
  return (
    <div className={styles.panel}>
      <h3>Гиперкуб рычагов влияния (параметры в млн)</h3>
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel} title="NPV — оперативный рычаг, деньги за год (млн руб)">NPV, млн руб</span>
          <span className={styles.metricValue}>{npvMillions}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel} title="Запасы — стратегический рычаг, суммарная добыча нефти/КИН за 30 лет (млн т)">Запасы, млн т</span>
          <span className={styles.metricValue}>{reservesMillions}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel} title="Добыча (Q) — оперативный рычаг добычи нефти за год (млн т)">Добыча Q, млн т</span>
          <span className={styles.metricValue}>{extractionMillions}</span>
        </div>
      </div>
      <div className={styles.pointsLegend}>
        <span className={styles.legendTitle}>Пространство вариантов внутри гипер-куба</span>
        <div className={`${styles.legendItems} ${styles.legendItemsRows}`}>
          <button
            type="button"
            className={`${styles.legendItem} ${filterVariantType === 'inapplicable' ? styles.legendItemOn : ''}`}
            style={{ color: VARIANT_COLORS.inapplicable }}
            onClick={() => setFilterVariantType((prev) => (prev === 'inapplicable' ? null : 'inapplicable'))}
          >
            ● Вариант неприменим для текущего положения рычагов
          </button>
          <button
            type="button"
            className={`${styles.legendItem} ${filterVariantType === 'applicable' ? styles.legendItemOn : ''}`}
            style={{ color: VARIANT_COLORS.applicable }}
            onClick={() => setFilterVariantType((prev) => (prev === 'applicable' ? null : 'applicable'))}
          >
            ● Вариант применим для текущего положения рычагов
          </button>
          <button
            type="button"
            className={`${styles.legendItem} ${filterVariantType === 'legitimate' ? styles.legendItemOn : ''}`}
            style={{ color: VARIANT_COLORS.legitimate }}
            onClick={() => setFilterVariantType((prev) => (prev === 'legitimate' ? null : 'legitimate'))}
          >
            ● Вариант легитимен для текущего положения рычагов
          </button>
        </div>
      </div>
      <div className={`${styles.planeLegend} ${styles.indicators}`}>
        <span className={styles.legendTitle}>Индикаторы состояния</span>
        {Object.entries(INDICATOR_BASKETS).map(([groupName, items]) => (
          <div key={groupName} className={styles.indicatorBasket}>
            <span className={styles.indicatorBasketName}>{groupName}</span>
            <div className={`${styles.legendItems} ${styles.legendItemsRows}`}>
              {items.map(({ key, label, color }) => (
                <span key={key} className={`${styles.legendItem} ${styles.legendItemStatic}`} style={{ color }}>
                  ● {label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className={styles.paletteHint}>Области рисков</p>
      <div className={styles.paletteLegend}>
        <span className={styles.legendCold}>Низкие</span>
        <div className={styles.legendGradient} />
        <span className={styles.legendHot}>Высокие</span>
      </div>
      <label className={styles.risksToggle}>
        <input
          type="checkbox"
          checked={showRisks}
          onChange={(e) => setShowRisks(e.target.checked)}
        />
        <span>Карта рисков (зоны и плоскости)</span>
      </label>
    </div>
  )
}
