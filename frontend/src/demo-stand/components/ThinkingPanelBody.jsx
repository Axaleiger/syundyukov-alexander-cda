import React from 'react'
import AiThinkingUI from './AiThinkingUI'
import BrainChainView from './BrainChainView'

/**
 * Общее тело панели «Режим мышления» (drawer или голограмма).
 */
export default function ThinkingPanelBody({
  showCollapsedBrainMinimal,
  thinkingConfirmPhase,
  thinkingSteps,
  graphNodesForThinking,
  thinkingChainRevealedRef,
  brainPanelOpenKey,
  selectedDecisionPathId,
  appliedDecisionPathId,
  setSelectedDecisionPathId,
  handleRecalculateDecision,
  thinkingAwaitingConfirm,
  handleThinkingConfirm,
  thinkingCurrentMessage,
  thinkingPaused,
  setThinkingPaused,
  onClosePanel,
}) {
  return (
    <>
      {showCollapsedBrainMinimal ? (
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
      ) : thinkingConfirmPhase === 'brain' ? (
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
          isFinished={thinkingSteps.some((s) => s.label && s.label.includes('Готово'))}
          onStop={() => setThinkingPaused(true)}
          onResume={() => setThinkingPaused(false)}
          awaitingConfirm={thinkingAwaitingConfirm}
          onConfirm={handleThinkingConfirm}
        />
      )}
      <button
        type="button"
        className="app-thinking-drawer-exit"
        onClick={() => {
          thinkingChainRevealedRef.current = true
          onClosePanel()
        }}
      >
        Закрыть панель
      </button>
    </>
  )
}
