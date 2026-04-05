import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { useFaceData } from "../../modules/face/model/useFaceData"
import RussiaGlobe from "../../modules/globe/ui/RussiaGlobe"
import WindRose from "../../modules/globe/ui/WindRose"
import Hypercube3D from "../../modules/globe/ui/Hypercube3D/index.js"
import LifecycleChart from "../../modules/globe/ui/LifecycleChart/index.js"
// Секция cash flow отключена в UI (как в main-stand); импорт оставлен для будущего включения блока ниже.
import CashFlowChart from "../../modules/face/ui/CashFlowChart"
import RightPanel from "../../widgets/right-panel/RightPanel/index.js"

import styles from "./FacePage.module.css"
import { useAppStore } from "../../core/store/appStore"

export const FacePage = () => {
	const navigate = useNavigate()
	const {
		mapPointsData,
		productionStages: PRODUCTION_STAGES,
		objectsByStage: OBJECTS_BY_STAGE,
		defaultObjects: DEFAULT_OBJECTS,
		scenarioStageFilters: SCENARIO_STAGE_FILTERS,
		getAssetStatus,
		getAssetStatusLabel,
		getAssetStatusIcon,
	} = useFaceData()
	const {
		selectedAssetId,
		setSelectedAssetId,
		scenarioComparisonRevision,
		setScenarioComparisonRevision,
		setBpmHighlight,
		setScenarioStageFilters,
		setScenariosStageFilter,
		setCdPageNode,
		hypercubeCaseIntro,
	} = useAppStore()

	const [selectedLeftStageIndex, setSelectedLeftStageIndex] = useState(null)
	const [selectedRightObjectIndex, setSelectedRightObjectIndex] = useState(null)

	const handleMapAssetSelect = (pointId) => {
		setSelectedAssetId(pointId || null)
		setScenarioComparisonRevision(0)
	}

	const selectedAssetPoint = useMemo(
		() => (selectedAssetId ? mapPointsData.find((p) => p.id === selectedAssetId) : null),
		[selectedAssetId, mapPointsData],
	)
	const assetStatus = selectedAssetId ? getAssetStatus(selectedAssetId) : null
	const assetStatusLabel = assetStatus ? getAssetStatusLabel(assetStatus) : null
	const assetStatusIcon = assetStatus ? getAssetStatusIcon(assetStatus) : null

	const faceSeed = useMemo(() => {
		if (!selectedAssetId) return 0
		return Math.abs(
			selectedAssetId.split("").reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0),
		)
	}, [selectedAssetId])

	const rightRoseData = useMemo(() => {
		let base =
			selectedLeftStageIndex != null
				? OBJECTS_BY_STAGE[PRODUCTION_STAGES[selectedLeftStageIndex].name] || DEFAULT_OBJECTS
				: DEFAULT_OBJECTS
		if (faceSeed === 0) return base
		const r = (i, j) => ((faceSeed * (i + 1) * 7 + (j + 1) * 11) % 17) - 8
		return base.map((item, i) => ({
			...item,
			value: Math.max(50, Math.min(99, item.value + r(i, 0))),
			coverage: Math.max(50, Math.min(99, (item.coverage || item.value) + r(i, 1))),
		}))
	}, [selectedLeftStageIndex, faceSeed, OBJECTS_BY_STAGE, PRODUCTION_STAGES, DEFAULT_OBJECTS])

	const leftRoseData = useMemo(() => {
		if (faceSeed === 0) return PRODUCTION_STAGES
		const r = (i, j) => ((faceSeed * (i + 1) * 7 + (j + 1) * 13) % 17) - 8
		return PRODUCTION_STAGES.map((item, i) => ({
			...item,
			value: Math.max(50, Math.min(99, item.value + r(i, 0))),
			coverage: Math.max(50, Math.min(99, (item.coverage || item.value) + r(i, 1))),
		}))
	}, [faceSeed, PRODUCTION_STAGES])

	const handleLeftSegmentClick = (index) => {
		setSelectedLeftStageIndex((prev) => (prev === index ? null : index))
		setSelectedRightObjectIndex(null)
	}

	const handleRightSegmentClick = (index) => {
		const name = rightRoseData[index]?.name
		if (name === "Пласт" || (name && name.startsWith("Пласт"))) {
			setCdPageNode("ЦД пласта")
			setSelectedRightObjectIndex(null)
			return
		}
		setSelectedRightObjectIndex((prev) => (prev === index ? null : index))
	}

	const assetIconColorClass =
		assetStatusIcon &&
		{
			green: styles.faceAssetStickyIconGreen,
			orange: styles.faceAssetStickyIconOrange,
			red: styles.faceAssetStickyIconRed,
		}[assetStatusIcon.color]

	const handleLifecycleStageClick = (stageName) => {
		setScenarioStageFilters(
			SCENARIO_STAGE_FILTERS.reduce((acc, name) => ({ ...acc, [name]: name === stageName }), {}),
		)
		setScenariosStageFilter(stageName)
		navigate("/scenarios")
	}

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
						<RussiaGlobe onAssetSelect={handleMapAssetSelect} />
					</section>

					<section className={`${styles["section"]} ${styles["wind-rose-section"]}`}>
						<h2 className={`${styles["wind-rose-section-title"]}`}>
							Карта здоровья цифровых двойников
						</h2>
						<div className={`${styles["wind-rose-container"]}`}>
							<div className={`${styles["wind-rose-item"]}`}>
								<h3>ЦД производственных этапов</h3>
								<WindRose
									type="left"
									data={leftRoseData}
									centerTitle="ЦД этапов"
									selectedIndex={selectedLeftStageIndex}
									onSegmentClick={handleLeftSegmentClick}
								/>
							</div>
							<div className={`${styles["wind-rose-item"]}`}>
								<h3>ЦД объектов</h3>
								<WindRose
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
						<Hypercube3D
							highlightCaseTree={hypercubeCaseIntro}
							onOpenBpm={(highlight) => {
								setBpmHighlight(highlight || null)
								navigate("/planning")
							}}
						/>
					</section>

					{/*
					<section className={`${styles["section"]} ${styles["cashflow-section"]}`}>
						<h2>Динамика Cash flow и добычи</h2>
						<CashFlowChart faceSeed={faceSeed} />
					</section>
					*/}

					<section className={`${styles["section"]} ${styles["lifecycle-section"]}`}>
						<h2>Этап выбранного жизненного цикла актива</h2>
						<LifecycleChart onStageClick={handleLifecycleStageClick} faceSeed={faceSeed} />
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
