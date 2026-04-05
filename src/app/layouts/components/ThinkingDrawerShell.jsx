import React from "react"
import AiThinkingUI from "../../../modules/thinking/ui/AiThinkingUI"
import BrainChainView from "../../../modules/thinking/ui/BrainChainView"
import styles from "./ThinkingDrawerShell.module.css"

/**
 * Разметка выдвижной панели «Режим мышления» (оверлей + drawer + внутренний контент).
 */
export function ThinkingDrawerShell({
	thinkingPanelOpen,
	setThinkingPanelOpen,
	setThinkingCurrentMessage,
	isThinkingDrawerCollapsed,
	showCollapsedBrainMinimal,
	handleThinkingConfirm,
	thinkingSteps,
	thinkingCurrentMessage,
	thinkingPaused,
	setThinkingPaused,
	thinkingAwaitingConfirm,
	thinkingConfirmPhase,
	brainPanelOpenKey,
	graphNodesForThinking,
	thinkingChainRevealedRef,
	selectedDecisionPathId,
	appliedDecisionPathId,
	setSelectedDecisionPathId,
	handleRecalculateDecision,
}) {
	if (!thinkingPanelOpen) return null

	return (
		<>
			<div
				className={styles.overlay}
				onClick={() => setThinkingPanelOpen(false)}
				aria-hidden
			/>
			<div
				className={`${styles.drawer} ${isThinkingDrawerCollapsed ? styles.drawerCollapsed : ""}`}
			>
				<div className={styles.head}>
					<h3 className={styles.title}>Режим мышления</h3>
					<button
						type="button"
						className={styles.close}
						onClick={() => setThinkingPanelOpen(false)}
						aria-label="Закрыть"
					>
						×
					</button>
				</div>
				<div className={styles.body}>
					{showCollapsedBrainMinimal ? (
						<div className={styles.minimal}>
							<h3 className={styles.title}>
								Цепочка размышлений
							</h3>
							<button
								type="button"
								className={`${styles.exit} ${styles.exitSuccess}`}
								onClick={handleThinkingConfirm}
							>
								Согласовать предлагаемый сценарий
							</button>
						</div>
					) : thinkingConfirmPhase === "brain" ? (
						<BrainChainView
							key={`brain-${brainPanelOpenKey}`}
							steps={thinkingSteps}
							graphNodes={graphNodesForThinking}
							chainAlreadyRevealed={thinkingChainRevealedRef.current}
							selectedDecisionPathId={selectedDecisionPathId}
							appliedDecisionPathId={appliedDecisionPathId}
							onSelectDecisionPath={setSelectedDecisionPathId}
							onRecalculate={handleRecalculateDecision}
							awaitingConfirm={thinkingAwaitingConfirm}
							onConfirm={handleThinkingConfirm}
						/>
					) : (
						<AiThinkingUI
							steps={thinkingSteps}
							currentMessage={thinkingCurrentMessage}
							isPaused={thinkingPaused}
							isFinished={thinkingSteps.some(
								(s) => s.label && s.label.includes("Готово"),
							)}
							onStop={() => setThinkingPaused(true)}
							onResume={() => setThinkingPaused(false)}
							awaitingConfirm={thinkingAwaitingConfirm}
							onConfirm={handleThinkingConfirm}
						/>
					)}
					<button
						type="button"
						className={styles.exit}
						onClick={() => {
							thinkingChainRevealedRef.current = true
							setThinkingPanelOpen(false)
							setThinkingCurrentMessage("")
							setThinkingPaused(false)
						}}
					>
						Закрыть панель
					</button>
				</div>
			</div>
		</>
	)
}
