import React, { useRef, useEffect, useState } from 'react'
import './ThinkingGraph.css'

const WIDTH = 680
const HEIGHT = 380
const PAD = 20
const NODE_R = 4
const REVEAL_INTERVAL_MS = 70
const NUM_CORES = 4

/** Псевдо-рандом от индекса */
function seededRandom(seed) {
  const x = Math.sin(seed * 9999) * 10000
  return x - Math.floor(x)
}

/**
 * Граф мыслей: несколько ядер (ключевые мысли), остальные узлы — кластеры вокруг ядер.
 * Кластеры соединяются линиями между ядрами. Узлы появляются постепенно (сначала ядра, потом вокруг них).
 * skipRevealAnimation: при повторном открытии панели граф показывается сразу целиком.
 */
function ThinkingGraph({ nodes = [], skipRevealAnimation = false }) {
  const canvasRef = useRef(null)
  const nodesRef = useRef([])
  const [visibleCount, setVisibleCount] = useState(() => (skipRevealAnimation ? nodes.length : 0))

  useEffect(() => {
    const n = nodes.length
    if (!n) {
      nodesRef.current = []
      setVisibleCount(0)
      return
    }
    if (skipRevealAnimation) {
      setVisibleCount(n)
    }
    const prev = nodesRef.current
    const numCores = Math.min(NUM_CORES, Math.max(1, Math.floor(n / 5)))
    const centerX = WIDTH / 2
    const centerY = HEIGHT / 2
    const coreRadius = Math.min(WIDTH, HEIGHT) * 0.28

    const out = nodes.map((item, i) => {
      const existing = prev[i]
      const id = item?.id ?? i
      let x, y
      if (i < numCores) {
        if (existing?.x != null && existing?.y != null) {
          return { ...existing, id, radius: NODE_R + 1, core: true }
        }
        const angle = (i / numCores) * Math.PI * 2 - Math.PI / 2
        x = centerX + Math.cos(angle) * coreRadius
        y = centerY + Math.sin(angle) * coreRadius * 0.6
        return { id, x, y, radius: NODE_R + 1, core: true }
      }
      if (existing?.x != null && existing?.y != null) {
        return { ...existing, id, radius: NODE_R, core: false }
      }
      const coreIdx = (i - numCores) % numCores
      const coreAngle = (coreIdx / numCores) * Math.PI * 2 - Math.PI / 2
      const coreX = centerX + Math.cos(coreAngle) * coreRadius
      const coreY = centerY + Math.sin(coreAngle) * coreRadius * 0.6
      const clusterRadius = 25 + seededRandom(i * 13) * 45
      const clusterAngle = seededRandom(i * 17) * Math.PI * 2
      x = coreX + Math.cos(clusterAngle) * clusterRadius
      y = coreY + Math.sin(clusterAngle) * clusterRadius * 0.7
      x = Math.max(PAD + NODE_R, Math.min(WIDTH - PAD - NODE_R, x))
      y = Math.max(PAD + NODE_R, Math.min(HEIGHT - PAD - NODE_R, y))
      return { id, x, y, radius: NODE_R, core: false, coreIdx }
    })
    nodesRef.current = out
    if (!skipRevealAnimation) setVisibleCount(0)
  }, [nodes.length, skipRevealAnimation])

  useEffect(() => {
    if (skipRevealAnimation || nodes.length === 0) return
    if (visibleCount >= nodes.length) return
    const t = setTimeout(() => setVisibleCount((c) => Math.min(c + 1, nodes.length)), REVEAL_INTERVAL_MS)
    return () => clearTimeout(t)
  }, [skipRevealAnimation, nodes.length, visibleCount])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const list = nodesRef.current
    const numCores = Math.min(NUM_CORES, list.length)
    const show = list.slice(0, visibleCount)

    ctx.fillStyle = '#f9fafb'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)

    const visibleCores = show.filter((n) => n.core)
    for (let i = 0; i < visibleCores.length; i++) {
      for (let j = i + 1; j < visibleCores.length; j++) {
        const a = visibleCores[i]
        const b = visibleCores[j]
        ctx.strokeStyle = 'rgba(91, 141, 201, 0.35)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
    }

    const showSet = new Set(show.map((n) => n.id))
    for (const node of show) {
      if (node.core) continue
      const coreIdx = node.coreIdx ?? 0
      if (coreIdx < list.length && list[coreIdx] && showSet.has(list[coreIdx].id)) {
        const core = list[coreIdx]
        ctx.strokeStyle = 'rgba(91, 141, 201, 0.28)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(core.x, core.y)
        ctx.lineTo(node.x, node.y)
        ctx.stroke()
      }
    }

    for (const node of show) {
      const r = node.radius
      const g = ctx.createRadialGradient(node.x - r * 0.3, node.y - r * 0.3, 0, node.x, node.y, r)
      g.addColorStop(0, 'rgba(255,255,255,0.95)')
      g.addColorStop(0.6, node.core ? 'rgba(59, 130, 246, 0.55)' : 'rgba(91, 141, 201, 0.5)')
      g.addColorStop(1, node.core ? 'rgba(59, 130, 246, 0.45)' : 'rgba(59, 130, 246, 0.35)')
      ctx.fillStyle = g
      ctx.strokeStyle = node.core ? 'rgba(59, 130, 246, 0.6)' : 'rgba(59, 130, 246, 0.45)'
      ctx.lineWidth = node.core ? 1.2 : 1
      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }, [nodes.length, visibleCount])

  return (
    <div className="thinking-graph-wrap" aria-label="Схема карточек и сервисов">
      <canvas
        ref={canvasRef}
        className="thinking-graph-canvas"
        width={WIDTH}
        height={HEIGHT}
      />
    </div>
  )
}

export default ThinkingGraph
