// Генератор вертикальной Sankey‑структуры для Thinking Mode.
// Здесь мы не пытаемся соблюдать строгий баланс потоков, цель — красивая «река» сценариев:
// много веток, которые разветвляются, местами обрываются и уходят в стороны.

const DEFAULT_ROOT_IDS = ['variant-1', 'variant-2', 'variant-3', 'variant-4', 'variant-5', 'variant-6']

export function buildVerticalScenarioSankey(options = {}) {
  const {
    rootIds = DEFAULT_ROOT_IDS,
    maxDepth = 5,
    baseBranching = 2.6, // ориентир ~x3, но с хаотичностью
    seed = 42,
  } = options

  const rnd = makeRng(seed)

  const nodes = []
  const links = []

  // создаём корневые ветки
  const rootNodes = rootIds.map((pathId, idx) => {
    const id = `n-root-${idx}`
    const depth = 0
    const quality = 0.8 + 0.15 * rnd() // корни в верхней зелёной зоне
    const node = {
      id,
      depth,
      pathId,
      quality,
    }
    nodes.push(node)
    return node
  })

  // рекурсивно наращиваем дерево
  rootNodes.forEach((root, rootIdx) => {
    growBranch(root, rootIdx)
  })

  // после генерации назначаем координаты
  const layers = new Map()
  nodes.forEach((n) => {
    if (!layers.has(n.depth)) layers.set(n.depth, [])
    layers.get(n.depth).push(n)
  })

  const depthKeys = Array.from(layers.keys()).sort((a, b) => a - b)
  const layerCount = depthKeys.length || 1

  depthKeys.forEach((depth, di) => {
    const list = layers.get(depth)
    // небольшая «хаотичность» по X: случайные смещения и разные количества на уровне
    const baseCount = list.length
    const span = 0.8
    const left = 0.1
    const step = baseCount > 1 ? span / (baseCount - 1) : 0

    list.forEach((node, idx) => {
      const jitter = (rnd() - 0.5) * 0.04 // лёгкое случайное смещение
      const x = baseCount === 1 ? 0.5 + jitter : left + step * idx + jitter
      const t = layerCount === 1 ? 0 : di / (layerCount - 1)
      const depthJitter = (rnd() - 0.5) * 0.03
      const y = 0.06 + (0.86 * t) + depthJitter
      node.x = clamp01(x)
      node.y = clamp01(y)
    })
  })

  // thicknessIndex по глубине, с небольшими локальными вариациями
  nodes.forEach((n) => {
    const base = thicknessForDepth(n.depth)
    const local = base * (0.9 + rnd() * 0.2)
    n.thickness = local
  })

  return { nodes, links }

  function growBranch(parent, rootIdx) {
    const stack = [parent]
    while (stack.length) {
      const node = stack.pop()
      const depth = node.depth
      if (depth >= maxDepth) continue

      // вероятность оборваться раньше
      const stopChance = 0.15 + 0.12 * depth
      if (rnd() < stopChance) continue

      // целевое количество детей — слегка хаотично вокруг baseBranching
      const meanChildren = baseBranching * (0.9 + rnd() * 0.4)
      let childCount = clampInt(Math.round(meanChildren + (rnd() - 0.5) * 1.2), 1, 4)

      // чуть уменьшаем разветвление на последних уровнях
      if (depth >= maxDepth - 2) {
        childCount = clampInt(childCount - 1, 0, 3)
      }
      if (childCount <= 0) continue

      for (let i = 0; i < childCount; i += 1) {
        const id = `n-${depth + 1}-${rootIdx}-${Math.floor(rnd() * 100000)}`
        // качество постепенно деградирует от зелёного к жёлто‑красному, но с шумом
        const qualityBase = Math.max(0, 0.85 - depth * 0.15 + (rnd() - 0.5) * 0.15)
        const quality = clamp01(qualityBase)
        const child = {
          id,
          depth: depth + 1,
          pathId: node.pathId,
          quality,
        }
        nodes.push(child)
        links.push({
          id: `e-${node.id}-${id}`,
          from: node.id,
          to: id,
          depth,
          pathId: node.pathId,
          quality,
        })

        // некоторая часть веток обрывается сразу, а часть идёт глубже
        const instantStopChance = 0.12 + depth * 0.08
        if (rnd() > instantStopChance) {
          stack.push(child)
        }
      }
    }
  }
}

function makeRng(seed) {
  let s = seed || 1
  return function rng() {
    // простейший LCG, достаточно стабильный для визуальных эффектов
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function thicknessForDepth(depth) {
  if (depth <= 0) return 30
  if (depth === 1) return 22
  if (depth === 2) return 15
  if (depth === 3) return 10
  return 7
}

function clamp01(v) {
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

function clampInt(v, min, max) {
  if (v < min) return min
  if (v > max) return max
  return v
}

