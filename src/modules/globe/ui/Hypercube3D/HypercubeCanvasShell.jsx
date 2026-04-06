import React from 'react'
import { Canvas } from '@react-three/fiber'
import { HypercubeR3FScene } from './HypercubeScene'
import styles from './HypercubeCanvasShell.module.css'

/**
 * Окно визуализации: кнопки воронки / полноэкранного режима и R3F Canvas со сценой.
 */
export function HypercubeCanvasShell({
  cubeCanvasRef,
  isFullscreen,
  selectedVariantId,
  highlightCaseTree,
  onCloseFunnel,
  onToggleFullscreen,
  sceneProps,
  hudCompact = false,
}) {
  return (
    <div
      className={`${styles.window} ${hudCompact ? styles.windowHudCompact : ''} ${isFullscreen ? styles.windowFullscreen : ''} ${selectedVariantId != null ? styles.windowFunnelOpen : ''} ${highlightCaseTree ? styles.windowCaseHighlight : ''}`}
      ref={cubeCanvasRef}
    >
      <div className={`${styles.canvasWrap} ${hudCompact ? styles.canvasWrapHudCompact : ''}`}>
        {selectedVariantId != null && (
          <button
            type="button"
            className={styles.closeFunnelBtn}
            onClick={onCloseFunnel}
            aria-label="Закрыть воронку"
            title="Закрыть воронку сквозных сценариев"
          >
            Закрыть воронку
          </button>
        )}
        <button
          type="button"
          className={`${styles.fullscreenBtn} ${hudCompact ? styles.fullscreenBtnHudCompact : ''}`}
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? 'Выйти из полноэкранного режима' : 'Развернуть на весь экран'}
          title={isFullscreen ? 'Выйти из полноэкранного режима' : 'Развернуть на весь экран'}
        >
          {isFullscreen ? '✕ Свернуть' : '⛶ На весь экран'}
        </button>
        <div className={`${styles.canvas} ${hudCompact ? styles.canvasHudCompact : ''}`}>
          <Canvas camera={{ position: [4, 4, 4], fov: 50 }}>
            <HypercubeR3FScene {...sceneProps} />
          </Canvas>
        </div>
      </div>
    </div>
  )
}
