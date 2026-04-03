import React, { useMemo } from 'react'
import * as d3 from 'd3'
import * as d3Sankey from 'd3-sankey'

const ROOT_IDS = ['variant-1', 'variant-2', 'variant-3', 'variant-4', 'variant-5']

const ROOT_COLORS = {
  'variant-1': '#16a34a',
  'variant-2': '#22c55e',
  'variant-3': '#4ade80',
  'variant-4': '#0ea5e9',
  'variant-5': '#6366f1',
}

function VerticalScenarioSankey({ activePathId = null }) {
  const { nodes, links, linkPath, color, width, height, marginTop, marginRight, marginBottom, marginLeft } =
    useMemo(() => {
      const { nodes: baseNodes, links: baseLinks } = buildSankeyData()
      return computeSankeyLayout(baseNodes, baseLinks)
    }, [])

  const highlightPathId = activePathId || null

  const verticalWidth = height
  const verticalHeight = width

  return (
    <svg
      viewBox={`0 0 ${verticalWidth} ${verticalHeight}`}
      className="vertical-sankey-svg"
      role="img"
      aria-label="Варианты сценариев"
    >
      <defs>
        <linearGradient id="sankey-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f9fafb" />
          <stop offset="100%" stopColor="#e5e7eb" />
        </linearGradient>
      </defs>

      <g transform={`translate(0, ${verticalHeight}) rotate(-90)`}>
        <rect
          x={marginLeft}
          y={marginTop}
          width={width - marginLeft - marginRight}
          height={height - marginTop - marginBottom}
          fill="url(#sankey-bg)"
          rx={16}
        />

        {d3
          .groups(nodes, (n) => n.pathId)
          .map(([pathId, pathNodes]) => {
            const ordered = [...pathNodes].sort(
              (a, b) => (a.layer ?? a.depth ?? 0) - (b.layer ?? b.depth ?? 0)
            )
            if (ordered.length < 2) return null

            const isActive = highlightPathId && highlightPathId === pathId
            const baseDepth = ordered[0].layer ?? ordered[0].depth ?? 0
            const baseWidth = 8
            const factor = thicknessFactorForDepth(baseDepth)
            const thickness = baseWidth * factor
            const avgQuality =
              ordered.reduce((s, n) => s + (n.quality ?? 0.9), 0) / ordered.length
            const stroke = colorForQuality(pathId, avgQuality, color, ordered[0].index)
            const opacity = highlightPathId ? (isActive ? 1 : 0.4) : 0.9

            const segments = []
            for (let i = 0; i < ordered.length - 1; i += 1) {
              const a = ordered[i]
              const b = ordered[i + 1]
              const x0 = a.x1
              const y0 = (a.y0 + a.y1) / 2
              const x1 = b.x0
              const y1 = (b.y0 + b.y1) / 2
              const my = (y0 + y1) / 2
              segments.push({ x0, y0, x1, y1, my })
            }

            const [{ x0, y0 }] = segments
            const d = [
              'M',
              x0.toFixed(1),
              y0.toFixed(1),
              ...segments.flatMap((s) => [
                'C',
                s.x0.toFixed(1),
                s.my.toFixed(1),
                s.x1.toFixed(1),
                s.my.toFixed(1),
                s.x1.toFixed(1),
                s.y1.toFixed(1),
              ]),
            ].join(' ')

            return (
              <path
                key={pathId}
                d={d}
                fill="none"
                stroke={stroke}
                strokeWidth={thickness}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={opacity}
              />
            )
          })}

        {/* маркеры только на начальных узлах (корнях) */}
        {nodes
          .filter((n) => !n.targetLinks || n.targetLinks.length === 0)
          .map((n) => {
            const cxNode = (n.x0 + n.x1) / 2
            const cyNode = n.y0
            const pathId = n.pathId
            const isActive = highlightPathId && highlightPathId === pathId
            const r = isActive ? 6 : 4
            const fill = colorForQuality(pathId, n.quality ?? 0.98, color, n.index)
            return (
              <circle
                key={n.id}
                cx={cxNode}
                cy={cyNode - 6}
                r={r}
                fill={fill}
                opacity={isActive || !highlightPathId ? 0.95 : 0.5}
              />
            )
          })}
      </g>
    </svg>
  )
}

function computeSankeyLayout(nodesInput, linksInput) {
  const format = d3.format(',')
  const align = 'justify'
  const nodeId = (d) => d.id
  const linkSource = ({ source }) => source
  const linkTarget = ({ target }) => target
  const linkValue = ({ value }) => value
  const width = 960
  const height = 480
  const marginTop = 16
  const marginRight = 8
  const marginBottom = 16
  const marginLeft = 8

  const LS = d3.map(linksInput, linkSource).map(intern)
  const LT = d3.map(linksInput, linkTarget).map(intern)
  const LV = d3.map(linksInput, linkValue)
  const nodes =
    nodesInput === undefined
      ? Array.from(d3.union(LS, LT), (id) => ({ id }))
      : nodesInput.map((d) => ({ ...d }))

  const N = d3.map(nodes, nodeId).map(intern)

  const G = null

  const links = d3.map(linksInput, (_, i) => ({ source: LS[i], target: LT[i], value: LV[i], ...linksInput[i] }))

  let nodeAlign = align
  if (typeof nodeAlign !== 'function') {
    nodeAlign =
      {
        left: d3Sankey.sankeyLeft,
        right: d3Sankey.sankeyRight,
        center: d3Sankey.sankeyCenter,
      }[align] ?? d3Sankey.sankeyJustify
  }

  const color = d3.scaleOrdinal().range(Object.values(ROOT_COLORS))

  const sankeyGen = d3Sankey
    .sankey()
    .nodeId(({ index: i }) => N[i])
    .nodeAlign(nodeAlign)
    .nodeWidth(16)
    .nodePadding(14)
    .extent([
      [marginLeft, marginTop],
      [width - marginRight, height - marginBottom],
    ])

  sankeyGen({ nodes, links })

  const linkPath = d3Sankey.sankeyLinkHorizontal()

  return {
    nodes,
    links,
    linkPath,
    color,
    format,
    width,
    height,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
  }
}

function buildSankeyData() {
  const nodes = []
  const links = []

  ROOT_IDS.forEach((id, idx) => {
    const nodeId = `${id}-lvl0`
    nodes.push({
      id: nodeId,
      name: id,
      pathId: id,
      quality: 0.98 - idx * 0.02,
    })
  })

  const maxDepth = 4
  let currentLevel = ROOT_IDS.map((id) => `${id}-lvl0`)

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const nextLevel = []

    currentLevel.forEach((parentId) => {
      const parent = nodes.find((n) => n.id === parentId)
      if (!parent) return

      const pathId = parent.pathId
      const branchCount = depth === 1 ? 3 : depth === 2 ? 2 : 1

      for (let i = 0; i < branchCount; i += 1) {
        const childId = `${parentId}-lvl${depth}-${i}`
        const quality = Math.max(0.15, (parent.quality ?? 0.9) - 0.12 - depth * 0.04)

        nodes.push({
          id: childId,
          name: '',
          pathId,
          quality,
        })

        links.push({
          source: parentId,
          target: childId,
          value: 1,
          pathId,
          quality,
        })

        if (depth < maxDepth && !(depth >= 2 && i === branchCount - 1)) {
          nextLevel.push(childId)
        }
      }
    })

    currentLevel = nextLevel
  }

  return { nodes, links }
}

function intern(value) {
  return value !== null && typeof value === 'object' ? value.valueOf() : value
}

function colorForQuality(pathId, quality, colorScale, sourceIndex) {
  const q = clamp01(quality)
  const baseHex = ROOT_COLORS[pathId] || (colorScale && typeof sourceIndex === 'number' ? colorScale(sourceIndex) : '#38bdf8')
  const from = hexToRgb(baseHex)
  const to = { r: 239, g: 68, b: 68 }
  const t = 1 - q
  const r = Math.round(from.r + (to.r - from.r) * t)
  const g = Math.round(from.g + (to.g - from.g) * t)
  const b = Math.round(from.b + (to.b - from.b) * t)
  return `rgb(${r}, ${g}, ${b})`
}

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return { r: 120, g: 200, b: 120 }
  const h = hex.replace('#', '')
  if (h.length !== 6) return { r: 120, g: 200, b: 120 }
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return { r, g, b }
}

function clamp01(v) {
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

function thicknessFactorForDepth(depth) {
  if (depth <= 0) return 2.1
  if (depth === 1) return 1.6
  if (depth === 2) return 1.1
  if (depth === 3) return 0.9
  return 0.8
}

export default VerticalScenarioSankey

