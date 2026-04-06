import { schemaToMermaid, mermaidToSchema } from './schemaToMermaid'

export const NODE_WIDTH = 200
export const COL = 260
export const ROW = 80

/** Базовая схема из UBD.html — совпадает с OntologyTab */
export const INITIAL_UBD_NODES = [
  { id: 'spectr', label: 'СПЕКТР', type: 'trigger', x: 0, y: 1 * ROW },
  { id: 'b6k', label: 'Б6К', type: 'process', x: 1 * COL, y: 0 },
  { id: 'exoil', label: 'EXOIL', type: 'process', x: 1 * COL, y: 2 * ROW },
  { id: 'cdwell', label: 'ЦД well', type: 'process', x: 2 * COL, y: 0 },
  { id: 'gibrima', label: 'ГибрИМА', type: 'process', x: 2 * COL, y: 2 * ROW },
  { id: 'eraiskra', label: 'ЭРА ИСКРА', type: 'process', x: 2 * COL, y: 4 * ROW },
  { id: 'eraremonty', label: 'ЭраРемонты', type: 'process', x: 3 * COL, y: 0 },
  { id: 'ipa', label: 'ИПА', type: 'process', x: 3 * COL, y: 2 * ROW },
  { id: 'condition', label: 'Условие достижения макс. профиля ДДН', type: 'output', x: 2 * COL, y: 6 * ROW },
  { id: 'cdrb', label: 'ЦДРБ', type: 'output', x: 0, y: 4 * ROW },
]

export const INITIAL_UBD_EDGES = [
  { id: 'e-spectr-b6k', from: 'spectr', to: 'b6k' },
  { id: 'e-spectr-exoil', from: 'spectr', to: 'exoil' },
  { id: 'e-b6k-cdwell', from: 'b6k', to: 'cdwell' },
  { id: 'e-exoil-gibrima', from: 'exoil', to: 'gibrima' },
  { id: 'e-cdwell-gibrima', from: 'cdwell', to: 'gibrima' },
  { id: 'e-eraiskra-gibrima', from: 'eraiskra', to: 'gibrima' },
  { id: 'e-gibrima-condition', from: 'gibrima', to: 'condition' },
  { id: 'e-cdwell-eraremonty', from: 'cdwell', to: 'eraremonty' },
  { id: 'e-gibrima-ipa', from: 'gibrima', to: 'ipa' },
  { id: 'e-spectr-cdrb', from: 'spectr', to: 'cdrb' },
]

export const DEFAULT_FLOW_CODE = schemaToMermaid(INITIAL_UBD_NODES, INITIAL_UBD_EDGES)

export function centerNodesInField(nodes) {
  if (!nodes.length) return nodes
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  nodes.forEach((n) => {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + NODE_WIDTH)
    maxY = Math.max(maxY, n.y + 56)
  })
  const padding = 80
  return nodes.map((n) => ({
    ...n,
    x: n.x - minX + padding,
    y: n.y - minY + padding,
  }))
}

export const FALLBACK_NODES = centerNodesInField([...INITIAL_UBD_NODES])
export const FALLBACK_EDGES = [...INITIAL_UBD_EDGES]

/** Для App: парсит flowCode и возвращает { nodes, edges } с центрированием в локальных координатах, или null */
export function getSchemaFromFlowCode(code) {
  if (!code || typeof code !== 'string') return null
  try {
    const parsed = mermaidToSchema(code)
    const rawNodes = parsed?.nodes || []
    const edges = parsed?.edges || []
    const nodes = rawNodes.length ? centerNodesInField(rawNodes) : null
    return nodes?.length ? { nodes, edges } : null
  } catch {
    return null
  }
}

function stableNodesKey(nodes) {
  if (!nodes?.length) return ''
  return JSON.stringify(
    [...nodes]
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map((n) => ({
        id: n.id,
        label: n.label,
        type: n.type,
        x: n.x,
        y: n.y,
      })),
  )
}

function stableEdgesKey(edges) {
  if (!edges?.length) return ''
  return JSON.stringify(
    [...edges]
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map((e) => ({ id: e.id, from: e.from, to: e.to })),
  )
}

/**
 * Детерминированная подпись «моста» планирования → онтология.
 * При изменении flowCode или переданных узлов/рёбер считаем, что пришла новая порция данных.
 */
export function computePlanningBridgeSignature(flowCode, initialNodes, initialEdges) {
  const fc = flowCode == null ? '' : String(flowCode)
  return `${fc}::${stableNodesKey(initialNodes)}::${stableEdgesKey(initialEdges)}`
}

/**
 * Начальное состояние вкладки из данных планирования (логика совпадает с прежними useState-инициализаторами OntologyTab).
 */
export function deriveInitialOntologyState({
  initialSchemaNodes,
  initialSchemaEdges,
  flowCode,
  schemaFromPlanningRef,
}) {
  const fromRef = schemaFromPlanningRef?.current

  let schemaNodes
  if (fromRef?.nodes?.length) {
    schemaNodes = centerNodesInField(fromRef.nodes)
  } else if (initialSchemaNodes?.length) {
    schemaNodes = centerNodesInField(initialSchemaNodes)
  } else if (flowCode && typeof flowCode === 'string') {
    try {
      const parsed = mermaidToSchema(flowCode)
      if (parsed?.nodes?.length) {
        schemaNodes = centerNodesInField(parsed.nodes)
      }
    } catch (_) {
      /* use default below */
    }
  }
  if (!schemaNodes?.length) {
    schemaNodes = centerNodesInField([...INITIAL_UBD_NODES])
  }

  let schemaEdges
  if (fromRef?.edges?.length) {
    schemaEdges = fromRef.edges
  } else if (initialSchemaEdges?.length) {
    schemaEdges = initialSchemaEdges
  } else if (flowCode && typeof flowCode === 'string') {
    try {
      const parsed = mermaidToSchema(flowCode)
      if (parsed?.edges?.length) {
        schemaEdges = parsed.edges
      }
    } catch (_) {
      /* default */
    }
  }
  if (!schemaEdges?.length) {
    schemaEdges = [...INITIAL_UBD_EDGES]
  }

  let codeValue
  if (fromRef?.nodes?.length) {
    codeValue = schemaToMermaid(fromRef.nodes, fromRef.edges || [])
  } else if (initialSchemaNodes?.length && initialSchemaEdges) {
    codeValue = schemaToMermaid(initialSchemaNodes, initialSchemaEdges)
  } else {
    codeValue = flowCode || DEFAULT_FLOW_CODE
  }

  return {
    schemaNodes,
    schemaEdges,
    codeValue,
    mode: 'schema',
  }
}
