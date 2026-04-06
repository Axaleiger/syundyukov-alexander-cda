import React from "react"
import { STRATEGY_DECISIONS } from "../data/strategyDecisions"
import styles from "./StrategyContextSection.module.css"

/**
 * Блок «Контекст текущей стратегии» (как в правой панели, компактно для dock).
 * @param {{ compact?: boolean }} props
 */
export function StrategyContextSection({ compact = false }) {
	return (
		<section className={styles.root}>
			<h3 className={styles.heading}>Контекст текущей стратегии</h3>
			<p className={styles.note}>
				Текущая стратегия сформирована последовательностью управленческих
				решений
			</p>
			<h4 className={styles.subheading}>
				Управленческие решения, определившие текущую стратегию
			</h4>
			<div
				className={`${styles.decisions} ${compact ? styles.decisionsCompact : ""}`}
			>
				{STRATEGY_DECISIONS.map((d, i) => (
					<div key={i} className={styles.decision}>
						<h5 className={styles.decisionTitle}>{d.title}</h5>
						<div className={styles.row}>
							<span className={styles.label}>Выбранный</span>
							<span>{d.chosen}</span>
						</div>
						{d.alternative && (
							<div className={`${styles.row} ${styles.alternative}`}>
								<span className={styles.label}>Альтернатива</span>
								<span>{d.alternative}</span>
							</div>
						)}
						{d.detail && !compact && (
							<p className={styles.detail}>{d.detail}</p>
						)}
						<div className={styles.outcome}>
							{d.outcomeIcon === "check" && (
								<span className={styles.outcomeOk} aria-hidden>
									✓
								</span>
							)}
							{d.outcomeIcon === "partial" && (
								<span className={styles.outcomePartial} aria-hidden>
									◐
								</span>
							)}
							<span>{d.outcome}</span>
						</div>
					</div>
				))}
			</div>
		</section>
	)
}
