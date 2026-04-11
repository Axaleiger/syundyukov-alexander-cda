import { useMemo } from "react"
import { useRepositories } from "../../../../../app/providers/DataRepositoriesProvider"
import { useMergedAssetScenarioComparison } from "../../../../../widgets/right-panel/RightPanel/model/useMergedAssetScenarioComparison"
import { ScenarioMetricRow } from "../../../../../widgets/right-panel/RightPanel/ScenarioMetricRow"
import { STRATEGY_DECISIONS } from "../../../data/strategyDecisions"
import styles from "./NewDemoSelectedAssetExpandedPanel.module.css"

export function NewDemoSelectedAssetExpandedPanel({
	assetId,
	selectedAsset,
	assetStatusLabel,
	assetStatusIcon,
	scenarioComparisonRevision = 0,
	onClose,
	onClearSelection,
}) {
	const { mapGlobe } = useRepositories()
	const { metricDefs: scenarioMetricDefs, comparison } = useMergedAssetScenarioComparison(assetId)
	const showAiDeltas = scenarioComparisonRevision > 0
	const twinsChain = useMemo(() => {
		const chains = mapGlobe.getChains()
		return chains?.[assetId] || null
	}, [mapGlobe, assetId])

	const statusMark =
		assetStatusIcon?.type === "check"
			? "✓"
			: assetStatusIcon?.type === "exclamation"
				? "!"
				: assetStatusIcon?.type === "question"
					? "?"
					: "•"

	return (
		<div className={styles.expandedRoot}>
			<section className={styles.panel} aria-label="Панель выбранного актива">
				<header className={styles.header}>
					<div className={styles.titleWrap}>
						<p className={styles.title}>Выбранный актив</p>
						<p className={styles.assetName}>{selectedAsset?.name || assetId}</p>
					</div>
					<div className={styles.headerActions}>
						<button
							type="button"
							className={styles.resetBtn}
							onClick={onClearSelection}
							aria-label="Сбросить выбранный актив"
						>
							Сбросить
						</button>
						<button
							type="button"
							className={styles.closeBtn}
							onClick={onClose}
							aria-label="Закрыть панель выбранного актива"
						>
							×
						</button>
					</div>
				</header>

				<div className={styles.statusRow}>
					<span className={styles.statusLabel}>{assetStatusLabel || "Статус уточняется"}</span>
					<span className={styles.statusIcon} aria-hidden>
						{statusMark}
					</span>
					<span className={styles.revisionLabel}>Ревизия: {scenarioComparisonRevision}</span>
				</div>

				<div className={styles.rows}>
					<section className={styles.sectionRow}>
						<h3 className={styles.sectionTitle}>Сравнение сценариев развития актива</h3>
						<p className={styles.sectionNote}>
							Альтернативные управленческие логики при единых допущениях
						</p>
						<div className={styles.scenariosGrid}>
							{comparison.scenarios.map((scenario, scenarioIndex) => (
								<article
									key={scenario.id}
									className={`${styles.scenarioCard} ${styles[`scenarioCardRole${scenario.role}`] || ""} ${scenario.isBest ? styles.scenarioCardBest : ""}`}
								>
									{scenario.isBest ? (
										<span className={styles.scenarioBadge}>Рекомендуемый</span>
									) : null}
									<h4 className={styles.scenarioName}>{scenario.title}</h4>
									<div className={styles.scenarioMetrics}>
										{scenarioMetricDefs.map((metricDef, rowIndex) => (
											<ScenarioMetricRow
												key={metricDef.key}
												metricDef={metricDef}
												base={scenario.metrics[metricDef.key]}
												delta={scenario.deltas[metricDef.key]}
												showAiDeltas={showAiDeltas}
												rowIndex={rowIndex}
												scenarioStaggerMs={scenarioIndex * 115}
												revision={scenarioComparisonRevision}
												dockOnDark
											/>
										))}
									</div>
								</article>
							))}
						</div>
					</section>

					<section className={styles.sectionRow}>
						<h3 className={styles.sectionTitle}>Контекст текущей стратегии</h3>
						<p className={styles.sectionNote}>
							Текущая стратегия сформирована последовательностью управленческих решений
						</p>
						<h4 className={styles.sectionSubTitle}>
							Управленческие решения, определившие текущую стратегию
						</h4>
						<div className={styles.decisionsGrid}>
							{STRATEGY_DECISIONS.map((decision, index) => (
								<article key={index} className={styles.decisionCard}>
									<h5 className={styles.decisionTitle}>{decision.title}</h5>
									<div className={styles.decisionRow}>
										<span className={styles.decisionLabel}>Выбранный</span>
										<span>{decision.chosen}</span>
									</div>
									{decision.alternative ? (
										<div className={`${styles.decisionRow} ${styles.decisionAlternative}`}>
											<span className={styles.decisionLabel}>Альтернатива</span>
											<span>{decision.alternative}</span>
										</div>
									) : null}
									{decision.detail ? (
										<p className={styles.decisionDetail}>{decision.detail}</p>
									) : null}
									<div className={styles.decisionOutcome}>
										{decision.outcomeIcon === "check" ? (
											<span className={styles.decisionOutcomeOk}>✓</span>
										) : null}
										{decision.outcomeIcon === "partial" ? (
											<span className={styles.decisionOutcomePartial}>◐</span>
										) : null}
										<span>{decision.outcome}</span>
									</div>
								</article>
							))}
						</div>
					</section>

					<section className={styles.sectionRow}>
						<h3 className={styles.sectionTitle}>Цифровые двойники</h3>
						<p className={styles.sectionNote}>
							Цепочка взаимосвязанных цифровых двойников выбранного актива
						</p>
						{twinsChain?.nodes?.length ? (
							<>
								<div className={styles.twinsMeta}>
									<span>Узлов: {twinsChain.nodes.length}</span>
									<span>Связей: {twinsChain.edges?.length || 0}</span>
								</div>
								<div className={styles.twinsList}>
									{twinsChain.nodes.map((nodeName, index) => (
										<div key={`${nodeName}-${index}`} className={styles.twinsItem}>
											<span className={styles.twinsIndex}>{index + 1}</span>
											<span>{nodeName}</span>
										</div>
									))}
								</div>
							</>
						) : (
							<p className={styles.emptyState}>
								Для выбранного актива цепочка цифровых двойников пока не задана.
							</p>
						)}
					</section>
				</div>
				<span className={styles.cornerIndicator} aria-hidden />
			</section>
		</div>
	)
}
