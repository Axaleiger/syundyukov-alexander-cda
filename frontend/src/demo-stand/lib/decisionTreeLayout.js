// Утилиты для построения органической раскладки дерева решений
// на основе статичного decisionTreeRoot из DecisionTree.jsx.

import { VARIANT_IDS } from '../components/DecisionTree'

/**
 * Рекурсивно собирает все пути от корня до листьев.
 * Каждый путь: { id, variant, confidence, nodes }
 * где nodes — массив узлов от корня к листу включительно.
 */
export function extractPathsFromDecisionTree(root) {
  const paths = []

  function walk(node, accNodes) {
    if (!node) return
    const next = accNodes.concat(node)

    if (node.scenario) {
      const variant = node.variant ?? null
      const confidence = node.confidence ?? null
      const idBase =
        variant != null && VARIANT_IDS.includes(variant)
          ? `variant-${variant}`
          : 'variant-other'
      const suffix = paths.filter((p) => p.id.startsWith(idBase)).length
      const id = suffix === 0 ? `${idBase}-main` : `${idBase}-${suffix + 1}`

      paths.push({
        id,
        variant,
        confidence,
        nodes: next,
      })
      return
    }

    if (node.yes) walk(node.yes, next)
    if (node.no) walk(node.no, next)
  }

  walk(root, [])
  return paths
}

/**
 * Строит нормализованные координаты и данные для ThinkingGraph(treeMode)
 * в органическом стиле: корень сверху, листья снизу, плавные изгибы.
 */
export function buildOrganicLayout(paths, { aspectRatio = 3 / 4 } = {}) {
  if (!paths || paths.length === 0) {
    return {
      treeData: { edges: [], positions: {}, leafMeta: {}, activePathId: null },
      nodes: [],
      mainPathByVariant: {},
    }
  }

  // Группировка путей по variant для распределения по горизонтали
  const byVariant = new Map()
  paths.forEach((p) => {
    const key = p.variant ?? 'other'
    if (!byVariant.has(key)) byVariant.set(key, [])
    byVariant.get(key).push(p)
  })

  const variants = Array.from(byVariant.keys())
  variants.sort((a, b) => {
    if (a === 'other') return 1
    if (b === 'other') return -1
    return Number(a) - Number(b)
  })

  const positions = {}
  const edges = []
  const leafMeta = {}
  const nodes = []
  const mainPathByVariant = {}

  // Выбираем основной путь для каждого варианта — с максимальной confidence
  byVariant.forEach((list, key) => {
    let best = list[0]
    list.forEach((p) => {
      if ((p.confidence ?? 0) > (best.confidence ?? 0)) best = p
    })
    if (best) {
      mainPathByVariant[key] = best.id
    }
  })

  const rootY = 0.08
  const leafY = 0.95

  // Генерация координат и рёбер
  variants.forEach((variantKey, vIndex) => {
    const list = byVariant.get(variantKey) || []
    if (!list.length) return

    const sectorMinX = (vIndex / variants.length) * 0.9 + 0.05
    const sectorMaxX = ((vIndex + 1) / variants.length) * 0.9 + 0.05

    list.forEach((path, pathIndex) => {
      const { id: pathId, nodes: nodeChain, confidence } = path

      // Цвет листа по confidence
      let color = 'red'
      if (confidence != null) {
        const p = confidence * 100
        if (p >= 90) color = 'green'
        else if (p >= 70) color = 'orange'
        else color = 'red'
      }
      leafMeta[pathId] = { color }

      const depthCount = nodeChain.length
      if (!depthCount) return

      // Базовая горизонтальная позиция для пути в своём секторе
      const tVariant = list.length === 1 ? 0.5 : pathIndex / (list.length - 1)
      const baseX = sectorMinX + (sectorMaxX - sectorMinX) * tVariant

      // Небольшой джиттер для переплетения
      const jitterSeed = pathIndex + vIndex * 13
      const rand = pseudoRand(jitterSeed)

      let prevNodeId = null
      nodeChain.forEach((node, depthIndex) => {
        // Нормализованный прогресс по высоте: корень сверху, листья снизу
        const tDepth =
          depthCount === 1 ? 1 : depthIndex / (depthCount - 1)
        const y =
          rootY +
          (leafY - rootY) *
            easeOutCubic(tDepth) // чуть плавнее к низу

        // Горизонтальное смещение в виде плавной S-образной кривой
        const sCurve =
          Math.sin(tDepth * Math.PI * 1.2 - Math.PI / 2) * 0.12
        const jitterX =
          (rand() - 0.5) * 0.08 * (1 - tDepth * 0.6)
        const xRaw = baseX + sCurve + jitterX
        const x = clamp01(xRaw)

        const nodeId = `${pathId}-d${depthIndex}`
        if (!positions[nodeId]) {
          positions[nodeId] = { x, y }
          nodes.push({
            id: nodeId,
            x,
            y,
            pathId,
            leaf: depthIndex === depthCount - 1,
          })
        }

        if (prevNodeId) {
          edges.push({
            from: prevNodeId,
            to: nodeId,
            pathId,
          })
        }
        prevNodeId = nodeId
      })
    })
  })

  return {
    treeData: {
      edges,
      positions,
      leafMeta,
      activePathId: null,
    },
    nodes,
    mainPathByVariant,
  }
}

function clamp01(v) {
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

function easeOutCubic(t) {
  const x = 1 - t
  return 1 - x * x * x
}

// Простенький детерминированный генератор псевдослучайных чисел
function pseudoRand(seed) {
  let x = seed || 1
  return function () {
    x = (x * 1664525 + 1013904223) % 4294967296
    return x / 4294967296
  }
}

