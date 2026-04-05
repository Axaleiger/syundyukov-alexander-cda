import React from 'react'
import styles from './HypercubeLeverControls.module.css'

/**
 * Верхние слайдеры рычагов NPV / запасы / добыча (вне Canvas).
 */
export function HypercubeLeverControls({
  npv,
  setNpv,
  reserves,
  setReserves,
  extraction,
  setExtraction,
  npvMillions,
  reservesMillions,
  extractionMillions,
}) {
  return (
    <div className={styles.controls}>
      <div className={styles.controlRow}>
        <label className={styles.label} title="NPV — оперативный рычаг, деньги за год (млн руб)">
          NPV (оперативный рычаг — деньги за год): {npv}% ({npvMillions} млн руб)
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={npv}
          onChange={(e) => setNpv(Number(e.target.value))}
          className={styles.slider}
        />
      </div>
      <div className={styles.controlRow}>
        <label className={styles.label} title="Запасы — стратегический рычаг, суммарная добыча нефти/КИН за 30 лет (млн т)">
          Запасы (стратегический рычаг — суммарная добыча нефти/КИН за 30 лет): {reserves}% ({reservesMillions} млн т)
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={reserves}
          onChange={(e) => setReserves(Number(e.target.value))}
          className={styles.slider}
        />
      </div>
      <div className={styles.controlRow}>
        <label className={styles.label} title="Добыча (Q) — оперативный рычаг добычи нефти за год (млн т)">
          Добыча (Q, млн т) — оперативный рычаг добычи нефти за год: {extraction}% ({extractionMillions} млн т)
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={extraction}
          onChange={(e) => setExtraction(Number(e.target.value))}
          className={styles.slider}
        />
      </div>
    </div>
  )
}
