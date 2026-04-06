import { useFacePageModel } from "../../modules/face/model/useFacePageModel"
import MainRussiaGlobe from "../../modules/globe/ui/MainRussiaGlobe"
import MainWindRose from "../../modules/globe/ui/MainWindRose"
import MainHypercube3D from "../../modules/globe/ui/Hypercube3D/MainHypercube3D"
import MainLifecycleChart from "../../modules/globe/ui/LifecycleChart/MainLifecycleChart"
import RightPanel from "../../widgets/right-panel/RightPanel/index.js"

import styles from "./FacePage.module.css"

export const FacePage = () => {
	const {
		PRODUCTION_STAGES,
		hypercubeCaseIntro,
		selectedAssetId,
		setSelectedAssetId,
		scenarioComparisonRevision,
		selectedLeftStageIndex,
		selectedRightObjectIndex,
		selectedAssetPoint,
		assetStatus,
		assetStatusLabel,
		assetStatusIcon,
		faceSeed,
		leftRoseData,
		rightRoseData,
		handleMapAssetSelect,
		handleLeftSegmentClick,
		handleRightSegmentClick,
		handleLifecycleStageClick,
		openPlanningWithHighlight,
	} = useFacePageModel("")

	const assetIconColorClass =
		assetStatusIcon &&
		{
			green: styles.faceAssetStickyIconGreen,
			orange: styles.faceAssetStickyIconOrange,
			red: styles.faceAssetStickyIconRed,
		}[assetStatusIcon.color]

	return (
		<div className={styles.faceWithPanel}>
			<div className={styles.faceMainColumn}>
				{selectedAssetId && selectedAssetPoint && assetStatus && (
					<div className={styles.faceAssetSticky}>
						<span className={styles.faceAssetStickyName}>
							{selectedAssetPoint.name}
						</span>
						<span className={styles.faceAssetStickyStatus}>{assetStatusLabel}</span>
						{assetStatusIcon && (
							<span
								className={`${styles.faceAssetStickyIcon} ${assetIconColorClass || ""}`}
								title={assetStatusLabel}
							>
								{assetStatusIcon.type === "check" && "✓"}
								{assetStatusIcon.type === "exclamation" && "!"}
								{assetStatusIcon.type === "question" && "?"}
							</span>
						)}
						<button
							type="button"
							className={styles.faceAssetStickyClose}
							onClick={() => setSelectedAssetId(null)}
							aria-label="Сбросить"
						>
							×
						</button>
					</div>
				)}
				<div className={`${styles["app-content"]} ${styles["app-content-face"]}`}>
					<section className={`${styles["section"]} ${styles["map-section"]}`}>
						<h2>Карта объектов Оркестратора актива</h2>
						<MainRussiaGlobe onAssetSelect={handleMapAssetSelect} />
					</section>

					<section className={`${styles["section"]} ${styles["wind-rose-section"]}`}>
						<h2 className={`${styles["wind-rose-section-title"]}`}>
							Карта здоровья цифровых двойников
						</h2>
						<div className={`${styles["wind-rose-container"]}`}>
							<div className={`${styles["wind-rose-item"]}`}>
								<h3>ЦД производственных этапов</h3>
								<MainWindRose
									type="left"
									data={leftRoseData}
									centerTitle="ЦД этапов"
									selectedIndex={selectedLeftStageIndex}
									onSegmentClick={handleLeftSegmentClick}
								/>
							</div>
							<div className={`${styles["wind-rose-item"]}`}>
								<h3>ЦД объектов</h3>
								<MainWindRose
									type="right"
									data={rightRoseData}
									centerTitle={
										selectedLeftStageIndex != null
											? PRODUCTION_STAGES[selectedLeftStageIndex].name
											: "ЦД объектов"
									}
									selectedIndex={selectedRightObjectIndex}
									onSegmentClick={handleRightSegmentClick}
								/>
							</div>
						</div>
					</section>

					<section
						className={`${styles["section"]} ${styles["hypercube-section"]} ${hypercubeCaseIntro ? styles["hypercube-case-intro"] : ""}`}
					>
						<h2>Гиперкуб рычагов влияния</h2>
						<MainHypercube3D
							highlightCaseTree={hypercubeCaseIntro}
							onOpenBpm={openPlanningWithHighlight}
						/>
					</section>

					<section className={`${styles["section"]} ${styles["lifecycle-section"]}`}>
						<h2>Этап выбранного жизненного цикла актива</h2>
						<MainLifecycleChart onStageClick={handleLifecycleStageClick} faceSeed={faceSeed} />
					</section>
				</div>
			</div>
			{selectedAssetId && (
				<aside className={styles.faceRightPanel}>
					<RightPanel
						assetId={selectedAssetId}
						scenarioComparisonRevision={scenarioComparisonRevision}
					/>
				</aside>
			)}
		</div>
	)
}

export default FacePage
