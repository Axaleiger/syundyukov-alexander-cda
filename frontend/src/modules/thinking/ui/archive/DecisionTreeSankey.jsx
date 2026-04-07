/** Перенесено из main-stand; не подключено к роутам — архивная копия. */
import React, { useEffect, useRef } from 'react'
import { createMockTreeNodes, buildFlowLayout } from '../../lib/flowTreeLayout'
import '../ThinkingGraph.css'

// Органическое вертикальное дерево решений в стиле sankey/flow.
// Пока использует фиктивные данные дерева; позже сюда можно передать JSON из sklearn.

function DecisionTreeSankey({ activeVariantId = null }) {
  const canvasRef = useRef(null)
  const layoutRef = useRef(null)

  // Статичный layout на основе заглушек
  if (!layoutRef.current) {
    const nodes = createMockTreeNodes()
    const layout = buildFlowLayout(nodes)
    layoutRef.current = { nodes, ...layout }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const width = rect.width || 10
    const height = rect.height || 10
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { positions, edges, leaves } = layoutRef.current

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    // Корневая «подушка» в верхней трети
    const rootY = height * 0.1
    ctx.strokeStyle = '#16a34a'
    ctx.lineWidth = 38
    ctx.lineCap = 'round'
    ctx.beginPath()
    const startX = width * 0.05
    const midX = width * 0.5
    const endX = width * 0.95
    const waveAmp = height * 0.025
    ctx.moveTo(startX, rootY)
    ctx.bezierCurveTo(width * 0.22, rootY - waveAmp, width * 0.32, rootY + waveAmp, midX, rootY)
    ctx.bezierCurveTo(width * 0.68, rootY - waveAmp, width * 0.78, rootY + waveAmp, endX, rootY)
    ctx.stroke()

    // 5 главных стволов: берём связи от корня к узлам depth=1
    const trunkEdges = edges.filter((e) => e.depthFrom === 0 && e.depthTo === 1)
    const activeMainIndex =
      activeVariantId === 'variant-1'
        ? 0
        : activeVariantId === 'variant-2'
          ? 1
          : activeVariantId === 'variant-3'
            ? 2
            : null

    edges.forEach((edge, index) => {
      const a = positions[edge.from]
      const b = positions[edge.to]
      if (!a || !b) return

      const ax = a.x * width
      const ay = a.y * height
      const bx = b.x * width
      const by = b.y * height

      // Активная ветвь = один из главных стволов и его потомки
      const isTrunk = trunkEdges.includes(edge)
      let isOnActivePath = false
      if (activeMainIndex != null && isTrunk) {
        const tEdge = trunkEdges[activeMainIndex]
        isOnActivePath = tEdge && tEdge.id === edge.id
      }

      const midYNorm = (a.y + b.y) / 2
      const tHeight = midYNorm
      const maxW = isTrunk ? 34 : 20
      const minW = isTrunk ? 6 : 2.5
      const lineWidth = maxW - (maxW - minW) * tHeight

      // Усиленная s‑образность для каждого сегмента
      const dx = bx - ax
      const dy = by - ay
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      const nx = -dy / len
      const ny = dx / len
      const sway = width * 0.04
      const localSeed = index + 1
      const sway1 = sway * (pseudoRand(localSeed) - 0.5)
      const sway2 = sway * (pseudoRand(localSeed * 7) - 0.5)

      const c1x = ax + dx * 0.3 + nx * sway1
      const c1y = ay + dy * 0.3 + ny * sway1
      const c2x = ax + dx * 0.7 + nx * sway2
      const c2y = ay + dy * 0.7 + ny * sway2

      const baseStart = isOnActivePath ? '#166534' : '#16a34a'
      const baseEnd = isOnActivePath ? '#22c55e' : '#4ade80'
      const grad = ctx.createLinearGradient(ax, ay, bx, by)
      grad.addColorStop(0, baseStart)
      grad.addColorStop(1, baseEnd)

      ctx.strokeStyle = grad
      ctx.globalAlpha = isOnActivePath || !activeVariantId ? 1 : 0.25
      ctx.lineWidth = lineWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, bx, by)
      ctx.stroke()
      ctx.globalAlpha = 1
    })

    // тёмные точки‑листья внизу
    leaves.forEach((id) => {
      const p = positions[id]
      if (!p) return
      const x = p.x * width
      const y = p.y * height
      ctx.beginPath()
      ctx.arc(x, y, 3.5, 0, Math.PI * 2)
      ctx.fillStyle = '#020617'
      ctx.fill()
    })
  }, [activeVariantId])

  return (
    <canvas
      ref={canvasRef}
      className="thinking-graph-canvas"
      aria-label="Органическое дерево решений"
    />
  )
}

// Локальный простой псевдослучайный генератор
function pseudoRand(seed) {
  let x = seed || 1
  x = (x * 1664525 + 1013904223) % 4294967296
  return x / 4294967296
}

export default DecisionTreeSankey

