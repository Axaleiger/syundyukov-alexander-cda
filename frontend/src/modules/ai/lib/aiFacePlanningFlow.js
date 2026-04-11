/**
 * Общий поток: главная → цепочка мышления → согласование → переход на планирование с пресетом доски.
 */
import { useAppStore } from "../../../core/store/appStore.js"
import { AI_PRESET_THINKING_SUMMARIES } from "../../planning/data/aiPlanningBoardPresets.js"
import { getThinkingStepsFromPanels } from "./panelsScenarioContent.js"

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

const GRAPH_STAGES = ["Подготовка", "Реализация", "Контроль"]
const GRAPH_SERVICES = [
	"СПЕКТР",
	"Б6К",
	"EXOIL",
	"ЦД well",
	"ГибрИМА",
	"ЭРА ИСКРА",
	"ЭраРемонты",
	"ИПА",
]

function getGraphNodes(topicLabel, preset) {
	const summary = AI_PRESET_THINKING_SUMMARIES[preset] || ""
	return [
		...GRAPH_STAGES,
		`Кейс: ${topicLabel}`,
		summary.slice(0, 80),
		...GRAPH_SERVICES.slice(0, 6),
	]
}

const STEPS_BY_PRESET = {
	base_drilling: [
		"Начинаю с главной страницы…",
		"Связываю базовую добычу с программой бурения…",
		"Проверяю очередность скважин и ГТМ…",
		"Формирую цепочку сценария…",
		"Валидация цепочки для выбранного актива…",
		"Готово к согласованию цепочки.",
	],
	fcf_no_drill: [
		"Начинаю с главной страницы…",
		"Оцениваю риски и чувствительность CAPEX…",
		"Исключаю новое бурение из базового плана…",
		"Перераспределяю капвложения по пакетам FCF…",
		"Сжимаю низкоотдачные блоки…",
		"Готово к согласованию цепочки.",
	],
	opex_reduction: [
		"Начинаю с главной страницы…",
		"Собираю полный контур этапов и метрик…",
		"Моделирую удельный OPEX и энергозатраты…",
		"Проверяю удержание добычи на уровне профиля…",
		"Упаковываю меры по сервисам и логистике…",
		"Готово к согласованию цепочки.",
	],
}

const CONFIRM_TEXT = {
	base_drilling:
		"Проверьте цепочку размышлений и нажмите «Согласовать предлагаемый сценарий» — обновится панель «Сравнение сценариев развития актива» справа; затем откроется планирование с доской «Управление добычей с учётом ближайшего бурения».",
	fcf_no_drill:
		"Проверьте цепочку размышлений и нажмите «Согласовать предлагаемый сценарий» — панель сценариев обновится; затем откроется планирование с доской ребаланса CAPEX без нового бурения.",
	opex_reduction:
		"Проверьте цепочку размышлений и нажмите «Согласовать предлагаемый сценарий» — панель сценариев обновится; затем откроется планирование с доской снижения OPEX и метрик.",
}

/**
 * @param {object} ctx
 * @param {string} preset — base_drilling | fcf_no_drill | opex_reduction
 * @param {string} [topic]
 */
export async function runAiFacePlanningFlow(ctx, preset, topic) {
	useAppStore.getState().setAiFaceBrainPreset(preset ?? null)
	const {
		setActiveTab,
		setShowBpm,
		setThinkingPhase,
		setThinkingGraphNodes,
		addThinkingStep,
		isPaused,
		waitForUserConfirm,
		navigateToPlanningAfterAi,
	} = ctx
	const topicLabel = topic || "планирование"

	if (isPaused?.()) return
	if (typeof setThinkingPhase === "function") setThinkingPhase("brain")
	if (typeof setThinkingGraphNodes === "function") {
		setThinkingGraphNodes(
			getGraphNodes(topicLabel, preset).map((label, i) => ({ id: `g-${preset}-${i}`, label })),
		)
	}
	if (typeof setShowBpm === "function") setShowBpm(false)
	if (typeof setActiveTab === "function") setActiveTab("face")

	const fromPanels = getThinkingStepsFromPanels(preset)
	const tail = STEPS_BY_PRESET[preset] || STEPS_BY_PRESET.base_drilling
	const steps = [...fromPanels, ...tail]
	for (const label of steps) {
		if (isPaused?.()) return
		addThinkingStep?.(label)
		await delay(620)
	}

	if (isPaused?.()) return
	if (typeof waitForUserConfirm === "function") {
		await waitForUserConfirm(CONFIRM_TEXT[preset] || CONFIRM_TEXT.base_drilling, {
			phase: "brain",
			refreshScenarioPanel: true,
		})
	} else {
		await delay(800)
	}
	if (isPaused?.()) return

	if (typeof navigateToPlanningAfterAi === "function") {
		navigateToPlanningAfterAi({ preset })
	}
}
