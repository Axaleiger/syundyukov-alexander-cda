import React from "react"
import AiThinkingUI from "../../../modules/thinking/ui/AiThinkingUI"
import BrainChainView from "../../../modules/thinking/ui/BrainChainView"
import styles from "./ThinkingDrawerShell.module.css"

/**
 * Разметка «Режим мышления»: drawer (планирование/онтология) или голограмма на `/demo/face` как в demo-stand.
 */
export function ThinkingDrawerShell({
	thinkingPanelOpen,
	setThinkingPanelOpen,
	setThinkingCurrentMessage,
	isThinkingDrawerCollapsed,
	showCollapsedBrainMinimal,
	faceHologram = false,
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
	isNewDemo = false,
}) {
	if (!thinkingPanelOpen) return null

	const showNewDemoRecalculate =
		Boolean(selectedDecisionPathId) &&
		Boolean(appliedDecisionPathId) &&
		selectedDecisionPathId !== appliedDecisionPathId &&
		Boolean(handleRecalculateDecision)

	const closePanel = () => {
		setThinkingPanelOpen(false)
		if (!isNewDemo) {
			setThinkingCurrentMessage("")
		}
		setThinkingPaused(false)
	}

	const renderBody = () => (
		<>
			{showCollapsedBrainMinimal ? (
				faceHologram ? (
					<div className="app-thinking-drawer-minimal">
						<h3 className="app-thinking-drawer-title">Цепочка размышлений</h3>
						<button
							type="button"
							className="app-thinking-drawer-exit app-thinking-drawer-exit--success"
							onClick={handleThinkingConfirm}
						>
							Согласовать предлагаемый сценарий
						</button>
					</div>
				) : (
					<div className={styles.minimal}>
						<h3 className={styles.title}>Цепочка размышлений</h3>
						<button
							type="button"
							className={`${styles.exit} ${styles.exitSuccess}`}
							onClick={handleThinkingConfirm}
						>
							Согласовать предлагаемый сценарий
						</button>
					</div>
				)
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
					isNewDemo={isNewDemo}
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
					isNewDemo={isNewDemo}
				/>
			)}
			{!(isNewDemo && thinkingConfirmPhase === "brain") && (
				<button
					type="button"
					className={faceHologram ? "app-thinking-drawer-exit" : `${styles.exit} ${isNewDemo ? styles.exitNewDemo : ""}`}
					onClick={() => {
						thinkingChainRevealedRef.current = true
						closePanel()
					}}
				>
					Закрыть панель
				</button>
			)}
		</>
	)

	if (faceHologram) {
		return (
			<div className="app-thinking-scene">
				<div
					className="app-thinking-overlay app-thinking-overlay--holo"
					onClick={closePanel}
					aria-hidden
				/>
				<div
					className="app-thinking-hologram glass-panel app-thinking-hologram--scene"
					role="dialog"
					aria-modal="true"
					aria-labelledby="thinking-holo-title"
				>
					<div className="app-thinking-hologram-head">
						<h3 id="thinking-holo-title" className="app-thinking-drawer-title">
							Режим мышления
						</h3>
						<button
							type="button"
							className="app-thinking-drawer-close"
							onClick={closePanel}
							aria-label="Закрыть"
						>
							×
						</button>
					</div>
					<div className="app-thinking-hologram-body app-thinking-drawer-body">
						{renderBody()}
					</div>
				</div>
			</div>
		)
	}

	return (
		<>
			<div
				className={styles.overlay}
				onClick={closePanel}
				aria-hidden
			/>
			<div
				className={`${styles.drawer} ${isThinkingDrawerCollapsed ? styles.drawerCollapsed : ""} ${isNewDemo ? styles.drawerNewDemo : ""}`}
				data-new-demo-thinking={isNewDemo ? "true" : undefined}
			>
				<div className={`${styles.head} ${isNewDemo ? styles.headNewDemo : ""}`}>
					<h3 className={`${styles.title} ${isNewDemo ? styles.titleNewDemo : ""}`}>Режим мышления</h3>
					<button
						type="button"
						className={`${styles.close} ${isNewDemo ? styles.closeNewDemo : ""}`}
						onClick={closePanel}
						aria-label="Закрыть"
					>
						×
					</button>
				</div>
				<div className={`${styles.body} ${isNewDemo ? styles.bodyNewDemo : ""}`}>
					{renderBody()}
				</div>
				{isNewDemo && thinkingConfirmPhase === "brain" && (
					<footer className={styles.footerNewDemo}>
						{thinkingAwaitingConfirm && (
							<button
								type="button"
								className={`${styles.exit} ${styles.exitNewDemo} ${styles.footerActionBtn} ${styles.footerConfirmBtn}`}
								onClick={handleThinkingConfirm}
							>
								Согласовать предлагаемый сценарий
							</button>
						)}
						{showNewDemoRecalculate && (
							<button
								type="button"
								className={`${styles.exit} ${styles.exitNewDemo} ${styles.footerActionBtn}`}
								onClick={handleRecalculateDecision}
							>
								Пересчитать
							</button>
						)}
						<button
							type="button"
							className={`${styles.exit} ${styles.exitNewDemo} ${styles.footerActionBtn}`}
							onClick={() => {
								thinkingChainRevealedRef.current = true
								closePanel()
							}}
						>
							Закрыть панель
						</button>
					</footer>
				)}
			</div>
		</>
	)
}
