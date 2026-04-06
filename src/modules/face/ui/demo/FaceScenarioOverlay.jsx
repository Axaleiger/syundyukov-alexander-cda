import React, { useMemo } from "react"
import { useAssetScenarioComparison } from "../../../../widgets/right-panel/RightPanel/model/useAssetScenarioComparison"
import { ScenarioMetricRow } from "../../../../widgets/right-panel/RightPanel/ScenarioMetricRow"
import { StrategyContextSection } from "../StrategyContextSection"
import styles from "./FaceScenarioOverlay.module.css"

const PREVIEW_METRIC_KEYS = ["productionMt", "npvB", "irrPct"]

const ROLE_CARD_CLASS = {
	aggressive: styles.cardAggressive,
	risky: styles.cardRisky,
	consensus: styles.cardConsensus,
}

/**
 * Dock сценариев на главной демо-face: три карточки + контекст стратегии.
 */
export function FaceScenarioOverlay({
	assetId,
	scenarioComparisonRevision = 0,
	selectedScenarioTitle,
	onSelectScenario,
}) {
	const { metricDefs: allDefs, comparison } = useAssetScenarioComparison(assetId)
	const showAiDeltas = scenarioComparisonRevision > 0
	const previewDefs = useMemo(
		() => allDefs.filter((d) => PREVIEW_METRIC_KEYS.includes(d.key)),
		[allDefs],
	)

	return (
		<div
			className={styles.overlay}
			role="region"
			aria-label="Сценарии и стратегия"
		>
			<div className={`${styles.inner} face-scenario-overlay-inner`}>
				<div className={styles.cards}>
					{comparison.scenarios.map((sc, si) => {
						const selected = selectedScenarioTitle === sc.title
						return (
							<button
								key={sc.id}
								type="button"
								className={`${styles.card} ${ROLE_CARD_CLASS[sc.role] || ""} ${selected ? styles.cardSelected : ""}`}
								onClick={() => onSelectScenario?.(sc.title)}
							>
								{sc.isBest && (
									<span className={styles.badge}>Рекомендуемый</span>
								)}
								<h4 className={styles.cardTitle}>{sc.title}</h4>
								<div className={styles.metrics}>
									{previewDefs.map((def, ri) => (
										<ScenarioMetricRow
											key={def.key}
											metricDef={def}
											base={sc.metrics[def.key]}
											delta={sc.deltas[def.key]}
											showAiDeltas={showAiDeltas}
											rowIndex={ri}
											scenarioStaggerMs={si * 80}
											revision={scenarioComparisonRevision}
											dockOnDark
										/>
									))}
								</div>
							</button>
						)
					})}
				</div>
				<div className={styles.strategyGlass}>
					<StrategyContextSection compact />
				</div>
			</div>
		</div>
	)
}
