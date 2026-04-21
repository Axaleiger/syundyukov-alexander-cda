import React from "react"
import styles from "./NewDemoAIAssistantWidget.module.css"

const WIZARD_STEPS = [
	{ step: 1, label: "Шаг 1: база сравнения", dim: "bases" },
	{ step: 2, label: "Шаг 2: горизонт", dim: "horizons" },
	{ step: 3, label: "Шаг 3: цели", dim: "objectives" },
	{ step: 4, label: "Шаг 4: ограничения", dim: "constraints" },
	{ step: 5, label: "Шаг 5: рычаги", dim: "levers" },
]

function DimensionPickRow({ title, items, selectedIds, dimKey, onToggleId, max }) {
	if (!items?.length) return null
	const sel = new Set(selectedIds || [])
	return (
		<div className={styles.constructorBlock} role="group" aria-label={title}>
			<div className={styles.constructorBlockTitle}>{title}</div>
			<div className={styles.templateScroll}>
				{items.map((x) => {
					const on = sel.has(x.id)
					const atCap = !on && sel.size >= (max ?? 99)
					return (
						<button
							key={`${dimKey}-${x.id}`}
							type="button"
							className={`${styles.suggestionButton} ${on ? styles.templateButtonSelected : ""}`}
							disabled={atCap}
							onClick={() => onToggleId(dimKey, x.id)}
						>
							{x.name}
						</button>
					)
				})}
			</div>
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
	onSelectTemplate,
	constructorDisplay,
	wizardStep,
	onWizardStep,
	dimensionCatalog,
	wizardSets,
	onToggleDimension,
	maxPerDimension,
}) {
	const horizons = wizardSets?.horizons || []
	const showPhases = horizons.includes("T04")

	return (
		<>
			<div className={styles.constructorRoot}>
				<div className={styles.constructorSectionLabel}>Шаблоны сценария</div>
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

			<div className={styles.constructorRoot}>
				<div className={styles.constructorSectionLabel}>Конструктор запроса</div>
				<div className={styles.templateScroll} role="tablist" aria-label="Шаги мастера">
				{WIZARD_STEPS.map(({ step, label }) => (
					<button
						key={step}
						type="button"
						role="tab"
						aria-selected={wizardStep === step}
						className={`${styles.suggestionButton} ${wizardStep === step ? styles.templateButtonSelected : ""}`}
						onClick={() => onWizardStep(step)}
					>
						{label}
					</button>
				))}
			</div>

			{constructorDisplay?.matchedIntents?.length ? (
				<div className={styles.intentRow} aria-label="Сработавшие интенты">
					{constructorDisplay.matchedIntents.map((name) => (
						<span key={name} className={styles.intentTag}>
							{name}
						</span>
					))}
				</div>
			) : null}

			{wizardStep === 1 ? (
				<DimensionPickRow
					title="База сравнения"
					items={dimensionCatalog?.bases}
					selectedIds={wizardSets?.bases}
					dimKey="bases"
					onToggleId={onToggleDimension}
					max={maxPerDimension?.bases}
				/>
			) : null}
			{wizardStep === 2 ? (
				<>
					<DimensionPickRow
						title="Горизонт"
						items={dimensionCatalog?.horizons}
						selectedIds={wizardSets?.horizons}
						dimKey="horizons"
						onToggleId={onToggleDimension}
						max={maxPerDimension?.horizons}
					/>
					{showPhases ? (
						<DimensionPickRow
							title="Фазы горизонта"
							items={dimensionCatalog?.horizonPhases}
							selectedIds={wizardSets?.horizon_phases}
							dimKey="horizon_phases"
							onToggleId={onToggleDimension}
							max={maxPerDimension?.horizon_phases}
						/>
					) : null}
				</>
			) : null}
			{wizardStep === 3 ? (
				<DimensionPickRow
					title="Цели"
					items={dimensionCatalog?.objectives}
					selectedIds={wizardSets?.objectives}
					dimKey="objectives"
					onToggleId={onToggleDimension}
					max={maxPerDimension?.objectives}
				/>
			) : null}
			{wizardStep === 4 ? (
				<DimensionPickRow
					title="Ограничения"
					items={dimensionCatalog?.constraints}
					selectedIds={wizardSets?.constraints}
					dimKey="constraints"
					onToggleId={onToggleDimension}
					max={maxPerDimension?.constraints}
				/>
			) : null}
			{wizardStep === 5 ? (
				<DimensionPickRow
					title="Рычаги"
					items={dimensionCatalog?.levers}
					selectedIds={wizardSets?.levers}
					dimKey="levers"
					onToggleId={onToggleDimension}
					max={maxPerDimension?.levers}
				/>
			) : null}

				{wizardStep === 3 && !(wizardSets?.objectives?.length > 0) ? (
					<p className={styles.constructorEmpty}>
						Выберите хотя бы одну цель на шаге 3 — без целей сценарий не строится.
					</p>
				) : null}
			</div>
		</>
	)
}
