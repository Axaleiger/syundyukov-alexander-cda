import { Canvas } from "@react-three/fiber"
import { useEffect, useState } from "react"
import { HypercubeR3FScene } from "../../../../globe/ui/Hypercube3D/HypercubeScene"
import { VARIANT_COLORS } from "../../../../globe/ui/Hypercube3D/hypercube3DLegendData"
import styles from "./NewDemoHypercubeExpandedPanel.module.css"

const VARIANT_FILTERS = [
	{ key: null, label: "Все варианты" },
	{ key: "applicable", label: "Применимые" },
	{ key: "legitimate", label: "Уверенные" },
	{ key: "inapplicable", label: "Неприменимые" },
]
export function NewDemoHypercubeExpandedPanel({ onClose, model }) {
	const isFunnelOpen = model.selectedVariantId != null
	const [selectedPointDetails, setSelectedPointDetails] = useState(null)
	const shouldShowPointLegend = isFunnelOpen && selectedPointDetails != null

	useEffect(() => {
		if (!isFunnelOpen || !model.sceneProps.selectedPlanePoint) {
			setSelectedPointDetails(null)
		}
	}, [isFunnelOpen, model.sceneProps.selectedPlanePoint])

	return (
		<div className={styles.expandedRoot}>
			<section className={styles.modal} aria-label="Бизнес возможности">
				<header className={styles.header}>
					<div className={styles.headerLeft}>
						<p className={styles.title}>
							<span>Бизнес возможности</span>
						</p>
						<button
							type="button"
							className={`${styles.funnelToggleBtn} ${isFunnelOpen ? styles.funnelToggleBtnActive : ""}`}
							onClick={isFunnelOpen ? model.closeFunnel : undefined}
							disabled={!isFunnelOpen}
							title={isFunnelOpen ? "Закрыть воронку" : "Выберите точку куба для открытия воронки"}
						>
							<i className={styles.funnelToggleTriangle} aria-hidden />
							<span>{isFunnelOpen ? "закрыть воронку" : "открыть воронку"}</span>
						</button>
					</div>
					<div className={styles.headerRight}>
						<button
							type="button"
							className={styles.closeBtn}
							onClick={onClose}
							aria-label="Закрыть панель гиперкуба"
						>
							×
						</button>
					</div>
				</header>

				<div className={`${styles.content} ${isFunnelOpen ? styles.contentExpanded : ""}`}>
					<aside className={styles.infoZone}>
						<div className={styles.sectionBlock}>
							<p className={styles.groupTitle}>Управление целеполаганием</p>
						</div>
						<label className={styles.controlRow}>
							<span className={styles.controlName}>NPV, млн руб</span>
							<strong>{model.npvMillions}</strong>
							<input type="range" min="0" max="100" value={model.npv} onChange={(e) => model.setNpv(Number(e.target.value))} />
						</label>
						<label className={styles.controlRow}>
							<span className={styles.controlName}>Запасы, млн т</span>
							<strong>{model.reservesMillions}</strong>
							<input
								type="range"
								min="0"
								max="100"
								value={model.reserves}
								onChange={(e) => model.setReserves(Number(e.target.value))}
							/>
						</label>
						<label className={styles.controlRow}>
							<span className={styles.controlName}>Добыча Q млн т</span>
							<strong>{model.extractionMillions}</strong>
							<input
								type="range"
								min="0"
								max="100"
								value={model.extraction}
								onChange={(e) => model.setExtraction(Number(e.target.value))}
							/>
						</label>
						<div className={styles.filterGrid}>
							{VARIANT_FILTERS.map((item) => (
								<button
									key={String(item.key)}
									type="button"
									className={`${styles.filterBtn} ${model.filterVariantType === item.key ? styles.filterBtnActive : ""}`}
									onClick={() => model.setFilterVariantType(item.key)}
								>
									{item.label}
								</button>
							))}
						</div>

						<div className={styles.riskBlock}>
							<p className={styles.groupTitle}>Области рисков</p>
							<div className={styles.riskScaleWrap}>
								<span>Низкие</span>
								<div className={styles.riskScale} aria-hidden />
								<span>Высокие</span>
							</div>
							<button
								type="button"
								className={`${styles.riskPill} ${model.showRisks ? styles.riskPillActive : ""}`}
								onClick={() => model.setShowRisks(!model.showRisks)}
							>
								Карта рисков (зоны и плоскости)
							</button>
							{shouldShowPointLegend ? (
								<div className={styles.pointLegendBlock}>
									<div className={styles.pointLegendHeader}>
										<p className={styles.pointLegendLayer}>{selectedPointDetails.levelTitle}</p>
										<p className={styles.pointLegendName}>{selectedPointDetails.pointName}</p>
									</div>
									<div className={styles.pointLegendList}>
										{selectedPointDetails.metrics
											.filter((item) => item?.label && item?.value)
											.map((item) => (
												<p key={`${item.label}-${item.value}`} className={styles.pointLegendRow}>
													<span className={styles.pointLegendLine} style={{ background: item.color }} aria-hidden />
													<span className={styles.pointLegendText}>
														{item.label}: {item.value}
													</span>
												</p>
											))}
									</div>
								</div>
							) : null}
						</div>
					</aside>

					<div className={`${styles.cubeZone} ${isFunnelOpen ? styles.cubeZoneExpanded : ""}`}>
						<Canvas
							key={isFunnelOpen ? "funnel-open" : "funnel-closed"}
							gl={{ alpha: true, antialias: true }}
							camera={{ position: [4, 4, 4], fov: 50 }}
						>
							<HypercubeR3FScene
								{...model.sceneProps}
								visualPreset="newDemo"
								idleRotationPaused
								showFunnelLevelLabels={isFunnelOpen}
								sceneOffsetY={isFunnelOpen ? 0.92 : 0}
								plainFunnelLayers={isFunnelOpen}
								funnelLabelWithConnector={isFunnelOpen}
								enableVerticalMousePan
								colorFunnelPointsByStatus={false}
								useNewDemoTreePointColors={isFunnelOpen}
								onSelectedPointDetailsChange={setSelectedPointDetails}
								randomizeTreeBySelection={isFunnelOpen}
							/>
						</Canvas>
					</div>
				</div>

				<div className={styles.bottomDivider} />
				<div className={styles.footerText}>
					<p>
						Наведите на рычаги NPV, Запасы и Добыча для контроля влияния. Точки куба показывают варианты
						сценариев, точки на плоскостях воронки отражают статус ЦД.
					</p>
					<p>Выберите точку куба, чтобы открыть воронку сквозных сценариев и перейти к детальному анализу.</p>
				</div>
				<div className={styles.metricsRow}>
					<article className={styles.metricCard}>
						<p className={styles.metricTitle}>NPV</p>
						<p className={styles.metricValue}>
							(оперативный рычаг — деньги за год): рычаг {model.npv}% · {model.npvMillions} млн руб (±25% от базы актива)
						</p>
					</article>
					<article className={styles.metricCard}>
						<p className={styles.metricTitle}>Запасы</p>
						<p className={styles.metricValue}>
							(стратегический рычаг — суммарная добыча нефти/КИН за 30 лет): рычаг {model.reserves}% ·{" "}
							{model.reservesMillions} млн т (±10% от базы актива)
						</p>
					</article>
					<article className={styles.metricCard}>
						<p className={styles.metricTitle}>Добыча</p>
						<p className={styles.metricValue}>
							(Q, млн т) — оперативный рычаг добычи нефти за год: рычаг {model.extraction}% ·{" "}
							{model.extractionMillions} млн т (±15% от базы актива)
						</p>
					</article>
				</div>

				<span className={styles.cornerIndicator} aria-hidden />
			</section>
		</div>
	)
}
