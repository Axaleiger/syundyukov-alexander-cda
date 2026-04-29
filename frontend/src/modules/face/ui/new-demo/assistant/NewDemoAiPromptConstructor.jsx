import React from "react"
import styles from "./NewDemoAIAssistantWidget.module.css"

const WIZARD_STEPS = [
	{ step: 1, label: "Шаг 1: выбор базы сравнения", dim: "bases" },
	{ step: 2, label: "Шаг 2: выбор горизонта планирования", dim: "horizons" },
	{ step: 3, label: "Шаг 3: выбор целей", dim: "objectives" },
	{ step: 4, label: "Шаг 4: задавание ограничений", dim: "constraints" },
	{ step: 5, label: "Шаг 5: выбор рычагов влияния", dim: "levers" },
]

const BASE_OPTION_LABELS = {
	B01: "Утвержденный бизнес-план",
	B02: "Референсный внешний отраслевой бенчмарк",
	B03: "Инерционный сценарий",
	B04: "Предыдущий сценарий платформы",
}

const HORIZON_OPTIONS = [
	{ id: "T06", name: "Оперативный такт 8 недель" },
	{ id: "T05", name: "Квартальный тактический горизонт" },
	{ id: "T01", name: "1 год" },
	{ id: "T08", name: "2 года" },
	{ id: "H03", name: "3 года" },
	{ id: "H05", name: "5 лет" },
	{ id: "H10", name: "10 лет" },
]

const OBJECTIVES_WITHOUT_MODE = new Set([
	"G06",
	"G07",
	"G17",
	"G18",
	"G19",
	"G20",
	"G21",
	"G22",
])
const OBJECTIVES_WITH_MINIMIZE_MODE = new Set(["G13", "G05"])
const OBJECTIVES_YEAR_THRESHOLD = new Set(["G16"])
const CONSTRAINT_INPUT_CONFIG = {
	C02: {
		label: "Потолок CAPEX за горизонт модели, ₽",
		defaultValue: 100000000,
		step: 5000000,
	},
	C03: {
		label: "Потолок OPEX (например за год), ₽",
		defaultValue: 50000000,
		step: 1000000,
	},
	C04: {
		label: "Нижняя граница добычи нефти, % к базовому профилю",
		defaultValue: 95,
		step: 0.5,
	},
	C05: { label: "Максимальный срок внедрения мероприятий, мес.", defaultValue: 12, step: 1 },
}

function formatObjectiveThresholdValue(itemId, value) {
	if (!OBJECTIVES_YEAR_THRESHOLD.has(itemId)) return `${value}%`
	const n = Math.max(0, Math.round(Number(value) || 0))
	const mod10 = n % 10
	const mod100 = n % 100
	if (mod10 === 1 && mod100 !== 11) return `${n} год`
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} года`
	return `${n} лет`
}

function formatConstraintValue(itemId, value) {
	if (itemId === "C02" || itemId === "C03") {
		return `${Math.round(Number(value) || 0).toLocaleString("ru-RU")} ₽`
	}
	if (itemId === "C04") return `${Number(value) || 0}%`
	if (itemId === "C05") return `${Math.round(Number(value) || 0)} мес.`
	return String(value ?? "")
}

function DimensionPickRow({
	title,
	items,
	selectedIds,
	dimKey,
	onToggleId,
	targetValue = "",
	onTargetValueChange,
	withTargetInput = false,
	displayNameById = null,
	selectionMode = "radio",
}) {
	if (!items?.length) return null
	const sel = new Set(selectedIds || [])
	const selectedId = (selectedIds || [])[0] || ""
	return (
		<div className={styles.constructorBlock} role="group" aria-label={title}>
			<div className={styles.constructorBlockTitle}>{title}</div>
			<div className={styles.templateScroll}>
				{items.map((x) => {
					const on = sel.has(x.id)
					return (
						<button
							key={`${dimKey}-${x.id}`}
							type="button"
							className={`${styles.suggestionButton} ${styles.radioOption} ${on ? styles.templateButtonSelected : ""}`}
							onClick={() => onToggleId(dimKey, x.id)}
						>
							<span
								className={
									selectionMode === "checkbox" ? styles.checkboxDot : styles.radioDot
								}
								aria-hidden="true"
							/>
							{displayNameById?.[x.id] || x.name}
						</button>
					)
				})}
			</div>
			{withTargetInput && selectedId ? (
				<div className={styles.targetInputRow}>
					<label className={styles.targetInputLabel}>Целевое значение</label>
					<input
						type="text"
						className={styles.targetInput}
						value={targetValue}
						onChange={(e) => onTargetValueChange?.(e.target.value)}
						placeholder="Например: +12% или 250 млн руб."
					/>
				</div>
			) : null}
		</div>
	)
}

/**
 * @param {{
 *   presets: { id: string, label: string, sets?: object }[], // форма «Шаблоны сценария»: только первые три, с подписями-запросами
 *   selectedTemplateId: string | null,
 *   onSelectTemplate: (t: { id: string, label: string, sets?: object }) => void,
 *   constructorDisplay: {
 *     matchedIntents?: string[],
 *   } | null,
 *   wizardStep: number,
 *   onWizardStep: (step: number) => void,
 *   dimensionCatalog: {
 *     bases: { id: string, name: string }[],
 *     horizons: { id: string, name: string }[],
 *     horizonPhases: { id: string, name: string }[],
 *     objectives: { id: string, name: string }[],
 *     constraints: { id: string, name: string }[],
 *     levers: { id: string, name: string }[],
 *   },
 *   wizardSets: {
 *     bases: string[],
 *     horizons: string[],
 *     horizon_phases: string[],
 *     objectives: string[],
 *     constraints: string[],
 *     levers: string[],
 *   },
 *   onToggleDimension: (dimKey: string, id: string) => void,
 *   maxPerDimension: Record<string, number>,
 * }} props
 */
export default function NewDemoAiPromptConstructor({
	presets = [],
	selectedTemplateId,
	constructorExpanded = false,
	onToggleConstructorExpanded,
	onSelectTemplate,
	constructorDisplay,
	wizardStep,
	onWizardStep,
	dimensionCatalog,
	wizardSets,
	onToggleDimension,
	wizardTargets,
	onSetTargetValue,
	onSetObjectiveMode,
	onObjectiveDelta,
	onSetConstraintMode,
	onConstraintDelta,
	onStepUp,
	onStepDown,
	onConfirmStep,
}) {
	React.useEffect(() => {
		// #region agent log
		fetch("http://127.0.0.1:7689/ingest/835d33eb-bbbf-4335-a415-5b77553fca5e", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "945340" }, body: JSON.stringify({ sessionId: "945340", runId: "pre-fix", hypothesisId: "H5", location: "NewDemoAiPromptConstructor.jsx:render-step1", message: "constructor render snapshot", data: { wizardStep, selectedBases: wizardSets?.bases || [], selectedTemplateId: selectedTemplateId || null }, timestamp: Date.now() }) }).catch(() => {})
		// #endregion
	}, [wizardStep, wizardSets?.bases, selectedTemplateId])

	const stepDone = {
		1: (wizardSets?.bases || []).length > 0,
		2: (wizardSets?.horizons || []).length > 0,
		3: (wizardSets?.objectives || []).length > 0,
		4: (wizardSets?.constraints || []).length > 0,
	}
	const maxUnlockedStep = stepDone[1]
		? stepDone[2]
			? stepDone[3]
				? 5
				: 4
			: 3
		: 2
	const canOpenStep = (s) => s <= maxUnlockedStep
	const canGoPrev = wizardStep > 1
	const canGoNext = wizardStep < 5 && canOpenStep(wizardStep + 1)
	const canConfirmCurrent = !(wizardStep === 3 && !(wizardSets?.objectives?.length > 0))
	const goPrev = () => {
		if (!canGoPrev) return
		if (typeof onStepUp === "function") onStepUp()
		else onWizardStep(Math.max(1, wizardStep - 1))
	}
	const goNext = () => {
		if (!canGoNext) return
		if (typeof onStepDown === "function") onStepDown()
		else onWizardStep(Math.min(5, wizardStep + 1))
	}
	const confirmCurrent = () => {
		if (wizardStep === 3 && !(wizardSets?.objectives?.length > 0)) return
		if (typeof onConfirmStep === "function") onConfirmStep()
		else if (canGoNext) onWizardStep(Math.min(5, wizardStep + 1))
	}

	return (
		<>
			<div className={styles.constructorRoot}>
				<div className={styles.constructorSectionLabel}>
					<span className={styles.sectionBadge}>1</span>
					Шаблоны сценария
				</div>
				<div className={styles.templateScroll} role="list">
					{presets.map((p) => (
						<button
							key={p.id}
							type="button"
							className={`${styles.suggestionButton} ${selectedTemplateId === p.id ? styles.templateButtonSelected : ""}`}
							onClick={() => onSelectTemplate(p)}
						>
							{p.label}
						</button>
					))}
				</div>
			</div>

			<div className={`${styles.constructorRoot} ${styles.constructorRootDocked}`}>
				<button
					type="button"
					className={styles.constructorAccordionTrigger}
					onClick={onToggleConstructorExpanded}
					aria-expanded={constructorExpanded}
				>
					<span className={styles.constructorSectionLabel}>
						<span className={styles.sectionBadge}>2</span>
						Конструктор запроса
					</span>
					<span className={styles.constructorChevron}>{constructorExpanded ? "▸" : "▹"}</span>
				</button>
				{constructorExpanded ? (
					<div className={styles.constructorFlyout}>
						<div className={styles.templateScroll} role="tablist" aria-label="Шаги мастера">
							{WIZARD_STEPS.map(({ step, label }) => (
								<button
									key={step}
									type="button"
									role="tab"
									aria-selected={wizardStep === step}
									disabled={!canOpenStep(step)}
									className={`${styles.suggestionButton} ${wizardStep === step ? styles.templateButtonSelected : ""}`}
									onClick={() => canOpenStep(step) && onWizardStep(step)}
								>
									{label}
								</button>
							))}
						</div>

						{wizardStep === 1 ? (
							<DimensionPickRow
								title="С ЧЕМ СРАВНИВАЕМ РЕЗУЛЬТАТ РАСЧЕТА СЦЕНАРИЯ?"
								items={dimensionCatalog?.bases}
								selectedIds={wizardSets?.bases}
								dimKey="bases"
								onToggleId={onToggleDimension}
								displayNameById={BASE_OPTION_LABELS}
							/>
						) : null}
						{wizardStep === 2 && stepDone[1] ? (
							<DimensionPickRow
								title="НА КАКОМ ГОРИЗОНТЕ ПЛАНИРОВАНИЯ БУДУЩЕГО ПРОИСХОДИТ РАСЧЕТ?"
								items={HORIZON_OPTIONS}
								selectedIds={wizardSets?.horizons}
								dimKey="horizons"
								onToggleId={onToggleDimension}
							/>
						) : null}
						{wizardStep === 3 && stepDone[2] ? (
							<div className={styles.constructorBlock}>
								<div className={styles.constructorBlockTitle}>Цели</div>
								<div className={styles.templateScroll}>
									{(dimensionCatalog?.objectives || []).map((item) => {
										const selected = (wizardSets?.objectives || []).includes(item.id)
										const cfg = wizardTargets?.objectives?.[item.id] || {
											mode: OBJECTIVES_WITH_MINIMIZE_MODE.has(item.id) ? "minimize" : "maximize",
											value: OBJECTIVES_YEAR_THRESHOLD.has(item.id) ? 3 : 10,
										}
										const value = Number.isFinite(Number(cfg.value))
											? Number(cfg.value)
											: OBJECTIVES_YEAR_THRESHOLD.has(item.id)
												? 3
												: 10
										const isThreshold = cfg.mode === "threshold"
										const withoutMode = OBJECTIVES_WITHOUT_MODE.has(item.id)
										const primaryModeLabel = OBJECTIVES_WITH_MINIMIZE_MODE.has(item.id)
											? "Минимизация показателя"
											: "Максимизация показателя"
										const primaryModeValue = OBJECTIVES_WITH_MINIMIZE_MODE.has(item.id)
											? "minimize"
											: "maximize"
										return (
											<div key={`objective-${item.id}`}>
												<button
													type="button"
													className={`${styles.suggestionButton} ${styles.radioOption} ${selected ? styles.templateButtonSelected : ""}`}
													onClick={() => onToggleDimension?.("objectives", item.id)}
												>
													<span className={styles.checkboxDot} aria-hidden="true" />
													{item.name}
												</button>
												{selected && !withoutMode ? (
													<div className={styles.objectiveTargetCard}>
														<div className={styles.objectiveModeRow}>
															<button
																type="button"
																className={`${styles.suggestionButton} ${!isThreshold ? styles.templateButtonSelected : ""}`}
																onClick={() =>
																	onSetObjectiveMode?.(item.id, primaryModeValue)
																}
															>
																{primaryModeLabel}
															</button>
															<button
																type="button"
																className={`${styles.suggestionButton} ${isThreshold ? styles.templateButtonSelected : ""}`}
																onClick={() => onSetObjectiveMode?.(item.id, "threshold")}
															>
																Порог
															</button>
														</div>
														{isThreshold ? (
															<div className={styles.thresholdRow}>
																<button
																	type="button"
																	className={styles.suggestionButton}
																	onClick={() => onObjectiveDelta?.(item.id, -1)}
																>
																	−
																</button>
																<div className={styles.thresholdValue}>
																	{formatObjectiveThresholdValue(item.id, value)}
																</div>
																<button
																	type="button"
																	className={styles.suggestionButton}
																	onClick={() => onObjectiveDelta?.(item.id, 1)}
																>
																	+
																</button>
															</div>
														) : null}
													</div>
												) : null}
											</div>
										)
									})}
								</div>
							</div>
						) : null}
						{wizardStep === 4 && stepDone[3] ? (
							<div className={styles.constructorBlock}>
								<div className={styles.constructorBlockTitle}>Ограничения</div>
								<div className={styles.templateScroll}>
									{(dimensionCatalog?.constraints || []).map((item) => {
										const selected = (wizardSets?.constraints || []).includes(item.id)
										const cfg = CONSTRAINT_INPUT_CONFIG[item.id] || null
										const value = Number.isFinite(
											Number(wizardTargets?.constraints?.[item.id]),
										)
											? Number(wizardTargets?.constraints?.[item.id])
											: cfg?.defaultValue
										return (
											<div key={`constraint-${item.id}`}>
												<button
													type="button"
													className={`${styles.suggestionButton} ${styles.radioOption} ${selected ? styles.templateButtonSelected : ""}`}
													onClick={() => onToggleDimension?.("constraints", item.id)}
												>
													<span className={styles.checkboxDot} aria-hidden="true" />
													{item.name}
												</button>
												{selected && cfg ? (
													<div className={styles.objectiveTargetCard}>
														<div className={styles.targetInputLabel}>{cfg.label}</div>
														<div className={styles.thresholdRow}>
															<button
																type="button"
																className={styles.suggestionButton}
																onClick={() => onConstraintDelta?.(item.id, -cfg.step)}
															>
																−
															</button>
															<div className={styles.thresholdValue}>
																{formatConstraintValue(item.id, value)}
															</div>
															<button
																type="button"
																className={styles.suggestionButton}
																onClick={() => onConstraintDelta?.(item.id, cfg.step)}
															>
																+
															</button>
														</div>
													</div>
												) : null}
											</div>
										)
									})}
								</div>
							</div>
						) : null}
						{wizardStep === 5 && stepDone[3] ? (
							<DimensionPickRow
								title="Рычаги"
								items={dimensionCatalog?.levers}
								selectedIds={wizardSets?.levers}
								dimKey="levers"
								onToggleId={onToggleDimension}
								selectionMode="checkbox"
							/>
						) : null}

						{wizardStep === 3 && !(wizardSets?.objectives?.length > 0) ? (
							<p className={styles.constructorEmpty}>
								Выберите хотя бы одну цель на шаге 3 — без целей сценарий не строится.
							</p>
						) : null}

						<div className={styles.constructorNavRow}>
							<button
								type="button"
								className={styles.suggestionButton}
								onClick={goPrev}
								disabled={!canGoPrev}
							>
								Назад
							</button>
							<button
								type="button"
								className={styles.suggestionButton}
								onClick={goNext}
								disabled={!canGoNext}
							>
								Далее
							</button>
							<button
								type="button"
								className={`${styles.suggestionButton} ${styles.templateButtonSelected} ${styles.confirmPulse}`}
								onClick={confirmCurrent}
								disabled={!canConfirmCurrent}
							>
								Подтвердить
							</button>
						</div>
					</div>
				) : null}
			</div>
		</>
	)
}
