import { useCallback, useEffect, useRef } from "react"

/**
 * Панель «Режим мышления»: подтверждения, resolver, overflow body, шаги, пересчёт решения.
 */
export function useThinkingDrawerController({
	thinkingPanelOpen,
	setThinkingPanelOpen,
	setThinkingSteps,
	setThinkingCurrentMessage,
	setThinkingPaused,
	setThinkingAwaitingConfirm,
	thinkingConfirmPhase,
	setThinkingConfirmPhase,
	setScenarioComparisonRevision,
	setAppliedDecisionPathId,
	selectedDecisionPathId,
	setBrainPanelOpenKey,
	setBpmCommand,
	/** Вызывается после resolver; phase — значение фазы до закрытия панели */
	onAfterThinkingConfirm,
}) {
	const thinkingConfirmResolverRef = useRef(null)
	const thinkingConfirmPhaseRef = useRef(null)
	thinkingConfirmPhaseRef.current = thinkingConfirmPhase

	const thinkingChainRevealedRef = useRef(false)
	const prevThinkingPanelOpenRef = useRef(thinkingPanelOpen)
	const selectedDecisionPathIdRef = useRef(null)
	selectedDecisionPathIdRef.current = selectedDecisionPathId

	useEffect(() => {
		if (thinkingPanelOpen && !prevThinkingPanelOpenRef.current) {
			setBrainPanelOpenKey((k) => k + 1)
			thinkingChainRevealedRef.current = false
		}
		prevThinkingPanelOpenRef.current = thinkingPanelOpen
	}, [thinkingPanelOpen, setBrainPanelOpenKey])

	const resetThinkingChain = useCallback(() => {
		thinkingChainRevealedRef.current = false
	}, [])

	const requestUserConfirm = useCallback(
		(label, options) => {
			setThinkingPanelOpen(true)
			thinkingChainRevealedRef.current = false
			setThinkingPaused(false)
			setThinkingAwaitingConfirm(true)
			const phase = options?.phase ?? "planning"
			const refreshScenarioPanel = !!options?.refreshScenarioPanel
			setThinkingConfirmPhase(phase)
			setThinkingCurrentMessage(label)
			return new Promise((resolve) => {
				thinkingConfirmResolverRef.current = () => {
					setThinkingAwaitingConfirm(false)
					if (refreshScenarioPanel) {
						setScenarioComparisonRevision((n) => n + 1)
					}
					if (thinkingConfirmPhaseRef.current !== "brain")
						setThinkingConfirmPhase(null)
					thinkingConfirmResolverRef.current = null
					resolve()
				}
			})
		},
		[
			setThinkingPanelOpen,
			setThinkingPaused,
			setThinkingAwaitingConfirm,
			setThinkingConfirmPhase,
			setThinkingCurrentMessage,
			setScenarioComparisonRevision,
		],
	)

	const handleThinkingConfirm = useCallback(() => {
		const phaseSnapshot = thinkingConfirmPhaseRef.current
		if (selectedDecisionPathIdRef.current) {
			setAppliedDecisionPathId(selectedDecisionPathIdRef.current)
		}
		if (thinkingConfirmResolverRef.current) {
			thinkingConfirmResolverRef.current()
		}
		onAfterThinkingConfirm?.({ phase: phaseSnapshot })
		setThinkingPanelOpen(false)
		setThinkingCurrentMessage("")
		setThinkingPaused(false)
		setThinkingConfirmPhase(null)
	}, [
		setAppliedDecisionPathId,
		setThinkingPanelOpen,
		setThinkingCurrentMessage,
		setThinkingPaused,
		setThinkingConfirmPhase,
		onAfterThinkingConfirm,
	])

	const handleRecalculateDecision = useCallback(() => {
		if (!selectedDecisionPathIdRef.current) return
		setBpmCommand({
			scenarioId: "createPlanningCase",
			params: { topic: selectedDecisionPathIdRef.current },
		})
	}, [setBpmCommand])

	useEffect(() => {
		if (!thinkingPanelOpen) return
		const prev = document.body.style.overflow
		document.body.style.overflow = "hidden"
		return () => {
			document.body.style.overflow = prev
		}
	}, [thinkingPanelOpen])

	const addThinkingStep = useCallback(
		(label) => {
			setThinkingSteps((prev) => {
				if (prev.length && prev[prev.length - 1]?.label === label) return prev
				return [
					...prev,
					{
						id: `step-${Date.now()}-${prev.length}-${Math.random().toString(36).slice(2)}`,
						label,
						status: "done",
					},
				]
			})
			setThinkingCurrentMessage(label)
		},
		[setThinkingSteps, setThinkingCurrentMessage],
	)

	return {
		requestUserConfirm,
		handleThinkingConfirm,
		handleRecalculateDecision,
		addThinkingStep,
		resetThinkingChain,
		thinkingChainRevealedRef,
	}
}
