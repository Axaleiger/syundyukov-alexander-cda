import React, { useRef, useEffect, useState } from 'react'
import './ThinkingGraph.css'

const PAD = 20
const NODE_R = 3
const REVEAL_INTERVAL_MS = 40
const NUM_CORES = 4

/** Псевдо-рандом от индекса */
function seededRandom(seed) {
  const x = Math.sin(seed * 9999) * 10000
  return x - Math.floor(x)
}

/**
 * Универсальный canvas: по умолчанию — граф мыслей, но
 * также используется как единственный слой рендеринга дерева решений.
 * В режиме дерева координаты и структура приходят снаружи.
 */
function ThinkingGraph({ nodes = [], skipRevealAnimation = false, treeMode = false, treeData = null }) {
  const canvasRef = useRef(null)
  const nodesRef = useRef([])
  const [visibleCount, setVisibleCount] = useState(() => (skipRevealAnimation ? nodes.length : 0))
  const [size, setSize] = useState({ width: 10, height: 10 })
  const wrapRef = useRef(null)

  React.useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const resize = () => {
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      setSize({ width: rect.width, height: rect.height })
    }
    resize()
    const obs = new ResizeObserver(resize)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

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
    if (treeMode) {
      nodesRef.current = nodes
      if (!skipRevealAnimation) setVisibleCount((c) => (c === 0 ? 1 : c))
      return
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
  }, [nodes.length, skipRevealAnimation, treeMode])

  useEffect(() => {
    if (treeMode) return
    if (skipRevealAnimation || nodes.length === 0) return
    if (visibleCount >= nodes.length) return
    const t = setTimeout(() => setVisibleCount((c) => Math.min(c + 1, nodes.length)), REVEAL_INTERVAL_MS)
    return () => clearTimeout(t)
  }, [skipRevealAnimation, nodes.length, visibleCount, treeMode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const list = nodesRef.current
    const show = list.slice(0, visibleCount)
    const width = size.width || 10
    const height = size.height || 10

    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)

    if (treeMode && treeData) {
      const { edges = [], positions = {}, leafMeta = {}, activePathId = null } = treeData
      ctx.save()
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)

      // Широкая корневая «подушка» в верхней трети кадра
      const rootY = height * 0.09
      ctx.strokeStyle = '#15803d'
      ctx.lineWidth = 40
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(width * 0.05, rootY)
      const midX = width * 0.5
      const endX = width * 0.95
      const waveAmp = height * 0.02
      ctx.bezierCurveTo(
        width * 0.25,
        rootY - waveAmp,
        width * 0.35,
        rootY + waveAmp,
        midX,
        rootY
      )
      ctx.bezierCurveTo(
        width * 0.65,
        rootY - waveAmp,
        width * 0.8,
        rootY + waveAmp,
        endX,
        rootY
      )
      ctx.stroke()

      // Органические зелёные ветви дерева решений: S‑образные кривые с переменной толщиной
      edges.forEach(({ from, to, pathId }) => {
        const a = positions[from]
        const b = positions[to]
        if (!a || !b) return
        const isActivePath = activePathId && activePathId === pathId

        // Базовый зелёный цвет для всех ветвей
        const startColor = isActivePath ? '#166534' : '#16a34a'
        const endColor = isActivePath ? '#22c55e' : '#4ade80'

        const ax = a.x * width
        const ay = a.y * height
        const bx = b.x * width
        const by = b.y * height

        // Толщина сильно меняется по высоте: наверху 20–35px, внизу 2–6px
        const midYNorm = (a.y + b.y) / 2
        const tHeight = midYNorm // 0..1
        const maxW = isActivePath ? 35 : 28
        const minW = isActivePath ? 6 : 3
        const lineWidth = maxW - (maxW - minW) * tHeight

        // Усиленный S‑образный изгиб для каждого сегмента
        const dx = bx - ax
        const dy = by - ay
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        const nx = -dy / len
        const ny = dx / len

        // Поперечный сдвиг, чтобы избежать длинных прямых участков
        const sway = width * 0.04
        const ctrl1Shift = sway * (0.5 - Math.random())
        const ctrl2Shift = sway * (0.5 - Math.random())

        const c1x = ax + dx * 0.3 + nx * ctrl1Shift
        const c1y = ay + dy * 0.3 + ny * ctrl1Shift
        const c2x = ax + dx * 0.7 + nx * ctrl2Shift
        const c2y = ay + dy * 0.7 + ny * ctrl2Shift

        // Лёгкий продольный градиент вдоль сегмента
        const grad = ctx.createLinearGradient(ax, ay, bx, by)
        grad.addColorStop(0, startColor)
        grad.addColorStop(1, endColor)

        ctx.strokeStyle = isActivePath ? grad : grad
        ctx.globalAlpha = isActivePath ? 1 : 0.55
        ctx.lineWidth = lineWidth
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.bezierCurveTo(c1x, c1y, c2x, c2y, bx, by)
        ctx.stroke()
        ctx.globalAlpha = 1
      })

      // Листья‑точки: маленькие тёмные круги на концах ветвей
      show.forEach((node) => {
        const { x, y, pathId, leaf } = node
        const isActivePath = activePathId && activePathId === pathId

        const r = leaf ? 4 : 2.5
        ctx.beginPath()
        ctx.arc(x * width, y * height, r, 0, Math.PI * 2)
        // Тёмные точки без обводки
        ctx.fillStyle = isActivePath ? '#030712' : 'rgba(15, 23, 42, 0.82)'
        ctx.fill()
      })

      ctx.restore()
      return
    }

    const WIDTH = width
    const HEIGHT = height

    const numCores = Math.min(NUM_CORES, list.length)
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
  }, [nodes.length, visibleCount, size, treeMode, treeData])

  return (
    <div ref={wrapRef} className="thinking-graph-wrap" aria-label="Схема карточек и сервисов">
      <canvas
        ref={canvasRef}
        className="thinking-graph-canvas"
      />
    </div>
  )
}

export default ThinkingGraph
