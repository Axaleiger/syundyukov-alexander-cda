/**
 * Синхронизация схемы конфигуратора (узлы + рёбра) с Mermaid-кодом.
 */

export function schemaToMermaid(nodes, edges) {
  if (!nodes || !nodes.length) {
    return `flowchart LR
  A[Нет узлов] --> B((Добавьте узлы на схему))`
  }
  const lines = ['flowchart LR']
  const nodeIds = (nodes || []).map((n) => n.id)
  const idToNode = Object.fromEntries((nodes || []).map((n) => [n.id, n]))
  ;(nodes || []).forEach((n) => {
    const label = (n.label || n.id || 'Узел').replace(/"/g, "'").slice(0, 50)
    lines.push(`  ${n.id}["${label}"]`)
  })
  ;(edges || []).forEach((e) => {
    if (idToNode[e.from] && idToNode[e.to]) lines.push(`  ${e.from} --> ${e.to}`)
  })
  return lines.join('\n')
}

/**
 * Парсит Mermaid flowchart LR в узлы и рёбра (без позиций — позиции задаются авто-раскладкой).
 */
export function mermaidToSchema(code) {
  const nodes = []
  const edges = []
  const seenIds = new Set()
  if (!code || typeof code !== 'string') return { nodes, edges }
  const lines = code.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  for (const line of lines) {
    if (line.startsWith('flowchart') || line.startsWith('subgraph') || line === 'end') continue
    const arrow = line.match(/^([^\s]+)\s*-->\s*([^\s]+)$/)
    if (arrow) {
      const [, from, to] = arrow
      edges.push({ id: `e-${from}-${to}`, from, to })
      if (!seenIds.has(from)) {
        seenIds.add(from)
        nodes.push({ id: from, label: from.replace(/_/g, ' '), type: 'process', x: 0, y: 0 })
      }
      if (!seenIds.has(to)) {
        seenIds.add(to)
        nodes.push({ id: to, label: to.replace(/_/g, ' '), type: 'process', x: 0, y: 0 })
      }
      continue
    }
    const nodeMatch = line.match(/^([^\s\[]+)\s*\["([^"]*)"\]$/) || line.match(/^([^\s\[]+)\s*\[([^\]]*)\]$/)
    if (nodeMatch) {
      const [, id, label] = nodeMatch
      if (!seenIds.has(id)) {
        seenIds.add(id)
        nodes.push({ id, label: (label || id).replace(/_/g, ' '), type: 'process', x: 0, y: 0 })
      }
    }
  }
  layoutNodes(nodes, edges)
  return { nodes, edges }
}

function layoutNodes(nodes, edges) {
  const idToIdx = Object.fromEntries(nodes.map((n, i) => [n.id, i]))
  const W = 220
  const H = 80
  const cols = Math.ceil(Math.sqrt(nodes.length)) || 1
  nodes.forEach((n, i) => {
    n.x = 80 + (i % cols) * W
    n.y = 80 + Math.floor(i / cols) * H
  })
  const inDegree = {}
  nodes.forEach((n) => { inDegree[n.id] = 0 })
  edges.forEach((e) => { inDegree[e.to] = (inDegree[e.to] || 0) + 1 })
  const layers = []
  const placed = new Set()
  let layer = 0
  while (placed.size < nodes.length) {
    const inLayer = nodes.filter((n) => !placed.has(n.id) && edges.filter((e) => e.to === n.id).every((e) => placed.has(e.from)))
    if (!inLayer.length) break
    inLayer.forEach((n) => {
      const idx = idToIdx[n.id]
      if (nodes[idx]) {
        nodes[idx].x = 80 + layer * W
        nodes[idx].y = 80 + (layers[layer] || 0) * H
        layers[layer] = (layers[layer] || 0) + 1
      }
      placed.add(n.id)
    })
    layer++
  }
}
