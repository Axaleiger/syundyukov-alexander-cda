import React, { useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { ResponsiveSankey } from '@nivo/sankey'
import { BasicTooltip } from '@nivo/tooltip'

function easeOutCubic(t) {
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3)
}

/** Деформация «градирня»: масштаб по x зависит от y (сверху сжато, снизу норма). */
function applyCoolingTowerTransform(containerEl) {
  if (!containerEl) return
  const svg = containerEl.querySelector('svg')
  if (!svg) return
  const vb = svg.viewBox?.baseVal || { width: 0, height: 0 }
  const width = vb.width || containerEl.offsetWidth || 400
  const height = vb.height || containerEl.offsetHeight || 520
  const centerX = width / 2
  const scaleAt = (y) => 0.6 + 0.4 * easeOutCubic(y / height)
  svg.querySelectorAll('rect').forEach((rect) => {
    const x = parseFloat(rect.getAttribute('x')) || 0
    const y = parseFloat(rect.getAttribute('y')) || 0
    const w = parseFloat(rect.getAttribute('width')) || 0
    const s = scaleAt(y)
    const newX = centerX + (x - centerX) * s
    const newW = w * s
    rect.setAttribute('x', String(newX))
    rect.setAttribute('width', String(newW))
  })
  svg.querySelectorAll('path').forEach((path) => {
    const bbox = path.getBBox()
    const centerY = bbox.y + bbox.height / 2
    const s = scaleAt(centerY)
    path.setAttribute('transform', `translate(${centerX},0) scale(${s},1) translate(${-centerX},0)`)
  })
}

function getPathFromVariant(variantId, links) {
  if (!variantId || !links?.length) return { pathNodeIds: new Set(), pathLinkKeys: new Set() }
  const pathNodeIds = new Set([String(variantId)])
  const pathLinkKeys = new Set()
  const queue = [String(variantId)]
  while (queue.length) {
    const sourceId = queue.shift()
    links.forEach((link) => {
      const src = String(link.source?.id ?? link.source ?? '')
      if (src !== sourceId) return
      const tid = String(link.target?.id ?? link.target ?? '')
      pathLinkKeys.add(`${src}|${tid}`)
      if (!pathNodeIds.has(tid)) {
        pathNodeIds.add(tid)
        queue.push(tid)
      }
    })
  }
  return { pathNodeIds, pathLinkKeys }
}

/** Один путь от корня варианта до представительского терминала (для подсветки одного зелёного пути). */
function getPathFromVariantToRepresentative(variantId, links, terminalPercentageMap) {
  if (!variantId || !links?.length) return { pathNodeIds: new Set(), pathLinkKeys: new Set() }
  const targetScore = VARIANT_TARGET_SCORES[variantId]
  if (targetScore == null) return getPathFromVariant(variantId, links)
  const full = getPathFromVariant(variantId, links)
  const repTerminal = [...full.pathNodeIds].find((id) => TERMINAL_NODE_IDS.has(id) && terminalPercentageMap.get(id) === targetScore)
  if (!repTerminal) return full
  const reverse = new Map()
  links.forEach((link) => {
    const src = String(link.source?.id ?? link.source ?? '')
    const tid = String(link.target?.id ?? link.target ?? '')
    if (!reverse.has(tid)) reverse.set(tid, [])
    reverse.get(tid).push(src)
  })
  const queue = [[repTerminal]]
  const seen = new Set([repTerminal])
  let foundChain = null
  while (queue.length) {
    const chain = queue.shift()
    const nodeId = chain[chain.length - 1]
    if (nodeId === variantId) {
      foundChain = chain
      break
    }
    const inLinks = reverse.get(nodeId) || []
    for (const sourceId of inLinks) {
      if (seen.has(sourceId)) continue
      seen.add(sourceId)
      queue.push([...chain, sourceId])
    }
  }
  if (!foundChain || foundChain.length < 2) return full
  const pathNodeIds = new Set(foundChain)
  const pathLinkKeys = new Set()
  for (let i = 1; i < foundChain.length; i++) pathLinkKeys.add(`${foundChain[i]}|${foundChain[i - 1]}`)
  return { pathNodeIds, pathLinkKeys }
}

// Красные концы по хешу id — рандомно слева, по центру, справа и по уровням
function isRedTerminal(id, seed = 2917) {
  let h = seed
  const str = String(id)
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h) % 2 === 0
}

const LAYER_0 = ['variant-1', 'variant-2', 'variant-3']
const L1 = Array.from({ length: 9 }, (_, i) => `m${i + 1}`)
const L2 = Array.from({ length: 14 }, (_, i) => `n${i + 1}`)
const L3 = Array.from({ length: 24 }, (_, i) => `p${i + 1}`)
const L4 = Array.from({ length: 28 }, (_, i) => `q${i + 1}`)
// Больше конечных узлов на последнем уровне → плотнее «ковёр» тонких линий
const L5 = Array.from({ length: 52 }, (_, i) => `r${i + 1}`)
const TERM_L2 = ['t2a', 't2b']
const TERM_L3 = ['t3a', 't3b', 't3c', 't3d']
const TERM_L4 = ['t4a', 't4b', 't4c', 't4d']
// Дополнительные досрочные концы перед финальным уровнем (достаточно целей для разветвления L4→L5)
const TERM_L5 = ['t5a', 't5b', 't5c', 't5d', 't5e', 't5f']
// Правило: полоса, заканчивающаяся раньше последнего уровня (TERM_*), — конец строго красный. Концы L5 — по хешу.
const EARLY_TERMINALS = [...TERM_L2, ...TERM_L3, ...TERM_L4, ...TERM_L5]
const RED_TERMINAL_IDS = new Set([
  ...EARLY_TERMINALS,
  ...L5.filter((id) => isRedTerminal(id)),
])
const TERMINAL_NODE_IDS = new Set([...L5, ...EARLY_TERMINALS])

/** Целевые проценты для кнопок вариантов (лучшие значения по дереву). */
const VARIANT_TARGET_SCORES = { 'variant-1': 94.2, 'variant-2': 92.5, 'variant-3': 90.3 }

/**
 * Строит карту терминал → процент. Правило: зелёные строго ≥ 90%, красные строго < 90%.
 * Три представителя вариантов получают 94.2 / 92.5 / 90.3; остальные — по хешу: часть 72–89 (красные), часть 90–99 (зелёные).
 */
function buildTerminalPercentageMap(links) {
  const map = new Map()
  const variantToTerminals = {}
  LAYER_0.forEach((v) => {
    const { pathNodeIds } = getPathFromVariant(v, links)
    variantToTerminals[v] = [...pathNodeIds].filter((id) => TERMINAL_NODE_IDS.has(id))
  })
  const assigned = new Set()
  LAYER_0.forEach((v) => {
    const terminals = variantToTerminals[v]
    if (terminals.length) {
      const sorted = [...terminals].sort()
      const rep = sorted.find((t) => !assigned.has(t)) || sorted[0]
      map.set(rep, VARIANT_TARGET_SCORES[v])
      assigned.add(rep)
    }
  })
  const seed = 2917
  TERMINAL_NODE_IDS.forEach((terminalId) => {
    if (!map.has(terminalId)) {
      let h = seed
      const str = String(terminalId)
      for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0
      const abs = Math.abs(h)
      if (abs % 2 === 0) {
        map.set(terminalId, 90 + (abs % 2 + 1) / 10)
      } else {
        map.set(terminalId, 72 + (abs % 18) + (abs % 10) / 10)
      }
    }
  })
  return map
}

const GREEN = '#16a34a'
const RED = '#dc2626'

const NODE_LAYER = {}
LAYER_0.forEach((id) => { NODE_LAYER[id] = 0 })
L1.forEach((id) => { NODE_LAYER[id] = 1 })
L2.forEach((id) => { NODE_LAYER[id] = 2 })
TERM_L2.forEach((id) => { NODE_LAYER[id] = 2 })
L3.forEach((id) => { NODE_LAYER[id] = 3 })
TERM_L3.forEach((id) => { NODE_LAYER[id] = 3 })
L4.forEach((id) => { NODE_LAYER[id] = 4 })
TERM_L4.forEach((id) => { NODE_LAYER[id] = 4 })
L5.forEach((id) => { NODE_LAYER[id] = 5 })
TERM_L5.forEach((id) => { NODE_LAYER[id] = 5 })

const NUM_LAYERS = 6

/**
 * Дерево без слияний, 5 уровней переходов (L0..L5). Линии каждого уровня в 2 раза тоньше. Досрочные концы — красные; концы L5 — по хешу.
 */
function buildData() {
  const nodes = [
    ...LAYER_0.map((id, i) => ({ id, label: `Вариант ${i + 1}` })),
    ...L1.map((id) => ({ id })),
    ...L2.map((id) => ({ id })),
    ...TERM_L2.map((id) => ({ id })),
    ...L3.map((id) => ({ id })),
    ...TERM_L3.map((id) => ({ id })),
    ...L4.map((id) => ({ id })),
    ...TERM_L4.map((id) => ({ id })),
    ...L5.map((id) => ({ id })),
    ...TERM_L5.map((id) => ({ id })),
  ]
  const links = []
  const add = (s, t, v) => links.push({ source: s, target: t, value: v })

  // Блоками: дети одного родителя подряд → ветви рядом.
  // Здесь ВСЕ связи одного уровня имеют ОДИНАКОВОЕ значение baseValue,
  // чтобы толщина уровня зависела только от layerValues, а не от позиции внутри блока.
  function partitionBlock(sources, targets, baseValue = 4) {
    const n = targets.length
    const perSource = Math.floor(n / sources.length)
    const remainder = n % sources.length
    let idx = 0
    for (let i = 0; i < sources.length; i++) {
      const count = perSource + (i < remainder ? 1 : 0)
      for (let k = 0; k < count; k++) {
        add(sources[i], targets[idx], baseValue)
        idx++
      }
    }
  }

  // По кругу: дети одного родителя разбросаны по слою → перекрёстно
  function partitionRoundRobin(sources, targets, baseValue = 4) {
    targets.forEach((t, k) => {
      const src = sources[k % sources.length]
      add(src, t, baseValue)
    })
  }

  // Псевдо-рандом: перемешать индексы целей (seed), потом блоками — часть веток перекрестно
  function partitionShuffled(sources, targets, baseValue = 4, seed = 19) {
    const idx = targets.map((_, i) => i)
    for (let i = idx.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      const j = seed % (i + 1);
      [idx[i], idx[j]] = [idx[j], idx[i]]
    }
    const shuffled = idx.map((i) => targets[i])
    partitionBlock(sources, shuffled, baseValue)
  }

  // Центральное «окно»: возвращает цели в порядке «сначала центр, потом периферия» для сгущения к центру.
  const CENTER_WINDOW_PCT = 0.35
  function getCenterOrderedTargets(targets, seed = 19) {
    const n = targets.length
    if (!n) return []
    const mid = Math.floor(n / 2)
    const windowRadius = Math.max(1, Math.floor((n * CENTER_WINDOW_PCT) / 2))
    const idx = targets.map((_, i) => i)
    for (let i = idx.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      const j = seed % (i + 1)
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
    const center = []
    const outer = []
    idx.forEach((i) => {
      if (Math.abs(i - mid) <= windowRadius) center.push(i)
      else outer.push(i)
    })
    center.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))
    return [...center, ...outer].map((i) => targets[i])
  }

  // Центрированное распределение (линии к центру).
  function partitionCenterWeighted(sources, targets, baseValue = 4, seed = 19) {
    const orderedTargets = getCenterOrderedTargets(targets, seed)
    if (!orderedTargets.length || !sources.length) return
    let si = 0
    orderedTargets.forEach((t) => {
      add(sources[si], t, baseValue)
      si = (si + 1) % sources.length
    })
  }

  // Центр + разветвление: сгущение к центру и минимум minChildren потомков на источник (для L4→L5).
  function partitionCenterWeightedWithMinChildren(sources, targets, baseValue = 4, minChildren = 2, seed = 31) {
    const orderedTargets = getCenterOrderedTargets(targets, seed)
    if (!orderedTargets.length || !sources.length) return
    const m = sources.length
    let ti = 0
    for (let round = 0; round < minChildren && ti < orderedTargets.length; round++) {
      for (let si = 0; si < m && ti < orderedTargets.length; si++) {
        add(sources[si], orderedTargets[ti], baseValue)
        ti++
      }
    }
    let si = 0
    while (ti < orderedTargets.length) {
      add(sources[si], orderedTargets[ti], baseValue)
      ti++
      si = (si + 1) % m
    }
  }

  // Распределение с минимальным числом потомков для каждого источника.
  // Используем для уровня L2→L3, чтобы ветви на 3‑м уровне гарантированно продолжали разветвляться.
  function partitionWithMinChildren(sources, targets, baseValue = 4, minChildren = 2, seed = 29) {
    const n = targets.length
    if (!n || !sources.length) return
    const idx = targets.map((_, i) => i)
    // Перемешиваем цели
    for (let i = idx.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      const j = seed % (i + 1)
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
    const shuffled = idx.map((i) => targets[i])
    const m = sources.length
    let ti = 0
    // Первый проход: даём каждому источнику до minChildren потомков (если хватает целей)
    for (let round = 0; round < minChildren && ti < shuffled.length; round++) {
      for (let si = 0; si < m && ti < shuffled.length; si++) {
        add(sources[si], shuffled[ti], baseValue)
        ti++
      }
    }
    // Оставшиеся цели раздаём по кругу
    let si = 0
    while (ti < shuffled.length) {
      add(sources[si], shuffled[ti], baseValue)
      ti++
      si = (si + 1) % m
    }
  }

  // Снизу — самые тонкие линии, с каждым уровнем выше — заметно толще (сильный градиент).
  const layerValues = [10, 6, 3, 1.5, 0.5] // L0→L1 самый толстый, L4→L5 самый тонкий
  const seeds = [11, 13, 17, 7, 19]
  partitionShuffled(LAYER_0, L1, layerValues[0], seeds[0])
  partitionShuffled(L1, [...L2, ...TERM_L2], layerValues[1], seeds[1])
  // На уровне L2→L3 гарантируем минимум 2 потомка на источник (насколько хватает целей)
  partitionWithMinChildren(L2, [...L3, ...TERM_L3], layerValues[2], 2, seeds[2])
  partitionWithMinChildren(L3, [...L4, ...TERM_L4], layerValues[3], 2, seeds[3])
  // На последнем уровне: сгущение к центру + разветвление (минимум 2 потомка на узел L4)
  partitionCenterWeightedWithMinChildren(L4, [...L5, ...TERM_L5], layerValues[4], 2, seeds[4])

  return { nodes, links }
}

const data = buildData()
const TERMINAL_PERCENTAGE_MAP = buildTerminalPercentageMap(data.links)

function getTerminalPercentage(terminalId) {
  const pct = TERMINAL_PERCENTAGE_MAP.get(String(terminalId))
  return pct != null ? pct : 85
}

function isTerminalGreen(terminalId) {
  return getTerminalPercentage(terminalId) >= 90
}

data.links.forEach((l) => {
  const tid = String(l.target?.id ?? l.target ?? '')
  if (TERMINAL_NODE_IDS.has(tid)) {
    const c = isTerminalGreen(tid) ? GREEN : RED
    l.startColor = c
    l.endColor = c
  }
})

/** Лучший процент по дереву для каждого варианта (для подписей на кнопках). */
export function getVariantScores() {
  const scores = {}
  LAYER_0.forEach((v) => {
    const { pathNodeIds } = getPathFromVariant(v, data.links)
    let maxPct = 0
    pathNodeIds.forEach((nid) => {
      if (TERMINAL_NODE_IDS.has(nid)) {
        const pct = getTerminalPercentage(nid)
        if (pct > maxPct) maxPct = pct
      }
    })
    scores[v] = maxPct
  })
  return scores
}

function nodeColor(node) {
  const id = String(node?.id ?? node ?? '')
  if (id.startsWith('variant-')) return GREEN
  if (TERMINAL_NODE_IDS.has(id)) return isTerminalGreen(id) ? GREEN : RED
  return GREEN
}

function ScenarioSankeyNivo({
  activePathId = null,
  onVariantSelect,
  onVariantHover,
  growthProgress = 1,
  stepsVisibleCount,
}) {
  const highlightId = activePathId != null && activePathId !== '' ? String(activePathId) : null
  const onHoverRef = useRef(onVariantHover)
  onHoverRef.current = onVariantHover

  // Появление дерева синхронно с галочками: 0 → слой 0, 1 → 0, 2 → 1, … 6 → все слои
  const revealedLayer = useMemo(() => {
    if (stepsVisibleCount != null) {
      return Math.min(NUM_LAYERS - 1, Math.max(0, stepsVisibleCount - 1))
    }
    if (growthProgress >= 1) return NUM_LAYERS - 1
    return Math.floor(growthProgress * NUM_LAYERS)
  }, [growthProgress, stepsVisibleCount])

  const { pathNodeIds, pathLinkKeys } = useMemo(() => {
    if (!highlightId) return { pathNodeIds: new Set(), pathLinkKeys: new Set() }
    return getPathFromVariantToRepresentative(highlightId, data.links, TERMINAL_PERCENTAGE_MAP)
  }, [highlightId])

  function variantRoot(node) {
    if (!node) return null
    const id = String(node?.id ?? node ?? '')
    if (id.startsWith('variant-')) return id
    const incoming = node.targetLinks || []
    const first = incoming[0]?.source
    return first ? variantRoot(first) : null
  }

  const HoverSyncLayer = ({ currentNode, currentLink }) => {
    useEffect(() => {
      if (currentNode) {
        const id = String(currentNode.id ?? '')
        if (id.startsWith('variant-')) {
          onHoverRef.current?.(id)
          return
        }
      }
      if (currentLink?.source) {
        const root = variantRoot(currentLink.source)
        onHoverRef.current?.(root ?? null)
        return
      }
      onHoverRef.current?.(null)
    }, [currentNode, currentLink])
    return null
  }

  const handleClick = (data, event) => {
    const node = data?.id != null ? data : data?.source
    const id = node?.id != null ? node.id : node?.id
    if (id && String(id).startsWith('variant-')) {
      onVariantSelect?.(String(id))
    }
  }

  const nodeLayer = (node) => NODE_LAYER[String(node?.id ?? node ?? '')] ?? 0
  const isNodeRevealed = (node) => nodeLayer(node) <= revealedLayer
  const isLinkRevealed = (link) => {
    const s = String(link.source?.id ?? link.source ?? '')
    const t = String(link.target?.id ?? link.target ?? '')
    return (NODE_LAYER[s] ?? 0) <= revealedLayer && (NODE_LAYER[t] ?? 0) <= revealedLayer
  }

  const isInPath = (nodeId) => pathNodeIds.has(String(nodeId ?? ''))
  const getLinkEndIds = (link) => {
    const sid = String(link.source?.id ?? link.source?.data?.id ?? link.source ?? '')
    const tid = String(link.target?.id ?? link.target?.data?.id ?? link.target ?? '')
    return { sid, tid }
  }
  const isLinkInPath = (link) => {
    const { sid, tid } = getLinkEndIds(link)
    return pathLinkKeys.has(`${sid}|${tid}`)
  }

  // Всегда примитивное число 0–1 для DOM (избегаем strokeOpacity warning от Nivo)
  const clampOpacity = (v) => {
    const n = Number(v)
    if (Number.isNaN(n) || typeof n !== 'number') return 0
    return Math.min(1, Math.max(0, n))
  }
  const getNodeId = (node) => String(node?.id ?? node?.data?.id ?? node ?? '')
  const getNodeOpacity = (node) => {
    if (!node) return 0
    if (!isNodeRevealed(node)) return 0
    if (highlightId && !isInPath(getNodeId(node))) return 0.2
    return 1
  }
  const getLinkOpacity = (link) => {
    if (!link) return 0
    if (!isLinkRevealed(link)) return 0
    if (highlightId && !isLinkInPath(link)) return 0.15
    return highlightId ? 0.95 : 0.75
  }

  const wrapRef = useRef(null)
  useLayoutEffect(() => {
    const run = () => applyCoolingTowerTransform(wrapRef.current)
    const id1 = requestAnimationFrame(() => {
      requestAnimationFrame(run)
    })
    const t1 = setTimeout(run, 80)
    const t2 = setTimeout(run, 250)
    const el = wrapRef.current
    if (el) {
      const ro = new ResizeObserver(() => { run() })
      ro.observe(el)
      return () => {
        cancelAnimationFrame(id1)
        clearTimeout(t1)
        clearTimeout(t2)
        ro.disconnect()
      }
    }
    return () => {
      cancelAnimationFrame(id1)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [revealedLayer, highlightId, data])

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%', minHeight: 520 }}>
      <ResponsiveSankey
        data={data}
        layout="vertical"
        margin={{ top: 12, right: 16, bottom: 12, left: 16 }}
        align="center"
        sort="input"
        colors={nodeColor}
        nodeThickness={2}
        nodeSpacing={6}
        nodeInnerPadding={1}
        nodeBorderWidth={0}
        nodeBorderColor={{ from: 'color', modifiers: [['darker', 0.8]] }}
        linkBlendMode="multiply"
        enableLinkGradient={true}
        enableLabels={false}
        isInteractive={true}
        animate={false}
        onClick={handleClick}
        linkOpacity={(link) => clampOpacity(getLinkOpacity(link))}
        nodeOpacity={(node) => clampOpacity(getNodeOpacity(node))}
        linkHoverOpacity={0.75}
        linkHoverOthersOpacity={0.75}
        nodeHoverOpacity={1}
        nodeHoverOthersOpacity={1}
        layers={['links', 'nodes', 'labels']}
        linkTooltip={({ link }) => {
          const tid = String(link.target?.id ?? link.target ?? '')
          if (!TERMINAL_NODE_IDS.has(tid)) return null
          const pct = getTerminalPercentage(tid)
          const color = pct >= 90 ? GREEN : RED
          const label = Number.isInteger(pct) ? `${pct}%` : `${Number(pct).toFixed(1)}%`
          return <BasicTooltip id={label} enableChip color={color} />
        }}
      />
    </div>
  )
}

export default ScenarioSankeyNivo
