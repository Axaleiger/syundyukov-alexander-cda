// Вертикальная sankey‑раскладка дерева решений для правой панели.
// Пока работает с фиктивными данными, но API рассчитан на будущий JSON от sklearn.

/**
 * Базовый формат узлов дерева.
 * id: уникальный идентификатор узла
 * parentId: id родителя или null для корня
 * depth: уровень по вертикали (0 — корень)
 * weight: условный "вес" потока (например, количество сэмплов)
 */
export function createMockTreeNodes() {
  // Один корень, 5 основных стволов, у каждого по плотному веерному ветвлению вниз.
  const nodes = []

  nodes.push({
    id: 'root',
    parentId: null,
    depth: 0,
    weight: 1,
  })

  // 5 стволов первого уровня
  for (let i = 0; i < 5; i += 1) {
    const trunkId = `trunk-${i}`
    nodes.push({
      id: trunkId,
      parentId: 'root',
      depth: 1,
      weight: 1,
    })

    // 2–4 ответвления второго уровня для каждого ствола
    const branchesCount = 2 + (i % 3) // 2,3,4 повторяются
    for (let j = 0; j < branchesCount; j += 1) {
      const branchId = `${trunkId}-b${j}`
      nodes.push({
        id: branchId,
        parentId: trunkId,
        depth: 2,
        weight: 0.6,
      })

      // нижний плотный веер третьего уровня
      const twigsCount = 3 + ((i + j) % 3) // 3–5
      for (let k = 0; k < twigsCount; k += 1) {
        nodes.push({
          id: `${branchId}-t${k}`,
          parentId: branchId,
          depth: 3,
          weight: 0.3,
        })
      }
    }
  }

  return nodes
}

/**
 * Конвертация списка узлов в структуру для canvas‑рисования:
 * positions: координаты узлов в нормализованной системе [0,1]x[0,1]
 * edges: связи между узлами с глубиной и весом
 */
export function buildFlowLayout(nodes, { minY = 0.12, maxY = 0.96 } = {}) {
  if (!nodes || nodes.length === 0) {
    return {
      positions: {},
      edges: [],
      leaves: [],
    }
  }

  const byDepth = new Map()
  let maxDepth = 0
  nodes.forEach((n) => {
    const d = n.depth || 0
    if (!byDepth.has(d)) byDepth.set(d, [])
    byDepth.get(d).push(n)
    if (d > maxDepth) maxDepth = d
  })

  const positions = {}
  const edges = []
  const leaves = []

  const depthCount = maxDepth + 1

  for (let depth = 0; depth <= maxDepth; depth += 1) {
    const list = byDepth.get(depth) || []
    if (!list.length) continue

    // базовый y для слоя c лёгкой ease‑функцией
    const t = depthCount === 1 ? 0 : depth / (depthCount - 1)
    const eased = easeOutCubic(t)
    const y = minY + (maxY - minY) * eased

    const n = list.length
    // дерево слегка расширяется книзу
    const spreadBase = 0.18 + 0.12 * depth
    const spread = Math.min(0.85, spreadBase)

    list.forEach((node, index) => {
      const center = 0.5
      const offset =
        n === 1 ? 0 : ((index / (n - 1)) - 0.5) * spread

      // небольшой псевдослучайный jitter для переплетения
      const rand = pseudoRand(hashString(node.id))
      const jitterX = (rand() - 0.5) * 0.06 * (1 - t * 0.6)
      const jitterY = (rand() - 0.5) * 0.02

      const x = clamp01(center + offset + jitterX)
      const yy = clamp01(y + jitterY)

      positions[node.id] = { x, y: yy }
    })
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  nodes.forEach((n) => {
    if (!n.parentId) return
    const parent = nodeById.get(n.parentId)
    if (!parent) return
    edges.push({
      id: `${n.parentId}->${n.id}`,
      from: n.parentId,
      to: n.id,
      depthFrom: parent.depth || 0,
      depthTo: n.depth || 0,
      weight: n.weight ?? 1,
    })
  })

  nodes.forEach((n) => {
    const hasChild = nodes.some((m) => m.parentId === n.id)
    if (!hasChild) {
      leaves.push(n.id)
    }
  })

  return {
    positions,
    edges,
    leaves,
  }
}

/**
 * Заготовка адаптера под будущий JSON в формате, похожем на вывод _parse_tree из Python‑кода.
 * Ожидаемый формат элемента: { self, parent, pos, value, color, children: [...] }
 * Сейчас просто разворачивает дерево в плоский список узлов с parentId/depth.
 */
export function fromParsedTreeToFlowNodes(treeJson) {
  if (!treeJson) return []

  const out = []

  function walk(node, parentId, depth) {
    if (!node || typeof node !== 'object') return
    const id = String(node.self ?? node.id ?? `${parentId || 'root'}-${depth}-${out.length}`)
    out.push({
      id,
      parentId: parentId ? String(parentId) : null,
      depth,
      weight: 1,
      color: node.color || null,
    })
    const children = node.children || []
    children.forEach((child) => walk(child, id, depth + 1))
  }

  if (Array.isArray(treeJson)) {
    treeJson.forEach((n) => walk(n, null, 0))
  } else {
    walk(treeJson, null, 0)
  }

  return out
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

function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(h) + 1
}

function pseudoRand(seed) {
  let x = seed || 1
  return function () {
    x = (x * 1664525 + 1013904223) % 4294967296
    return x / 4294967296
  }
}

