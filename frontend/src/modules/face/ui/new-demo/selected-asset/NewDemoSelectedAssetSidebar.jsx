import { useState } from "react"
import { useMergedAssetScenarioComparison } from "../../../../../widgets/right-panel/RightPanel/model/useMergedAssetScenarioComparison"
import { ScenarioMetricRow } from "../../../../../widgets/right-panel/RightPanel/ScenarioMetricRow"
import { STRATEGY_DECISIONS } from "../../../data/strategyDecisions"
import styles from "./NewDemoSelectedAssetSidebar.module.css"

const TAB_KEYS = {
	scenarios: "scenarios",
	strategy: "strategy",
}

const TAB_ITEMS = [
	{ key: TAB_KEYS.scenarios, label: "Сравнение сценариев развития актива" },
	{ key: TAB_KEYS.strategy, label: "Контекст текущей стратегии" },
]

export function NewDemoSelectedAssetSidebar({
	assetId,
	selectedAsset,
	assetStatusLabel,
	assetStatusIcon,
	scenarioComparisonRevision = 0,
	onClose,
	panelRef,
}) {
	const { metricDefs: scenarioMetricDefs, comparison } = useMergedAssetScenarioComparison(assetId)
	const [activeTab, setActiveTab] = useState(TAB_KEYS.scenarios)
	const showAiDeltas = scenarioComparisonRevision > 0

	const statusMark =
		assetStatusIcon?.type === "check"
			? "✓"
			: assetStatusIcon?.type === "exclamation"
				? "!"
				: assetStatusIcon?.type === "question"
					? "?"
					: "•"

	return (
		<div className={styles.sidebarRoot}>
			<section ref={panelRef} className={styles.panel} aria-label="Панель выбранного актива">
				<header className={styles.header}>
					<div className={styles.titleWrap}>
						<p className={styles.title}>Выбранный актив</p>
						<p className={styles.assetName}>{selectedAsset?.name || assetId}</p>
					</div>
					<button
						type="button"
						className={styles.closeBtn}
						onClick={onClose}
						aria-label="Закрыть панель выбранного актива"
					>
						×
					</button>
				</header>

				<div className={styles.statusRow}>
					<span className={styles.statusLabel}>{assetStatusLabel || "Статус уточняется"}</span>
					<span className={styles.statusIcon} aria-hidden>
						{statusMark}
					</span>
					<span className={styles.revisionLabel}>Ревизия: {scenarioComparisonRevision}</span>
				</div>

				<nav className={styles.tabsRow} aria-label="Разделы выбранного актива">
					{TAB_ITEMS.map((tab) => (
						<button
							key={tab.key}
							type="button"
							className={`${styles.tabButton} ${activeTab === tab.key ? styles.tabButtonActive : ""}`}
							onClick={() => setActiveTab(tab.key)}
							aria-pressed={activeTab === tab.key}
						>
							{tab.label}
						</button>
					))}
				</nav>

				<div className={styles.contentArea}>
					{activeTab === TAB_KEYS.scenarios ? (
						<section className={styles.sectionRow}>
							<p className={styles.sectionNote}>
								Альтернативные управленческие логики при единых допущениях
							</p>
							<div className={styles.scenariosGrid}>
								{comparison.scenarios.map((scenario, scenarioIndex) => (
									<div key={scenario.id} className={styles.scenarioColumn}>
										<div className={styles.scenarioAboveCard}>
											{scenario.isBest ? (
												<span className={styles.scenarioBadge}>Рекомендуемый</span>
											) : (
												<span className={styles.scenarioAboveSpacer} aria-hidden />
											)}
										</div>
										<article
											className={`${styles.scenarioCard} ${styles[`scenarioCardRole${scenario.role}`] || ""} ${scenario.isBest ? styles.scenarioCardBest : ""}`}
										>
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
									</div>
								))}
							</div>
						</section>
					) : null}

					{activeTab === TAB_KEYS.strategy ? (
						<section className={styles.sectionRow}>
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
					) : null}
				</div>
			</section>
		</div>
	)
}
