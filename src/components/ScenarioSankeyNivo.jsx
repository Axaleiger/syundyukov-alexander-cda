import React, { useRef, useEffect, useMemo } from 'react'
import { ResponsiveSankey } from '@nivo/sankey'

function getPathFromVariant(variantId, links) {
  if (!variantId || !links?.length) return { pathNodeIds: new Set(), pathLinkKeys: new Set() }
  const pathNodeIds = new Set([variantId])
  const pathLinkKeys = new Set()
  const queue = [variantId]
  while (queue.length) {
    const sourceId = queue.shift()
    links.forEach((link) => {
      if (link.source !== sourceId) return
      const tid = link.target
      pathLinkKeys.add(`${sourceId}|${tid}`)
      if (!pathNodeIds.has(tid)) {
        pathNodeIds.add(tid)
        queue.push(tid)
      }
    })
  }
  return { pathNodeIds, pathLinkKeys }
}

// Много полос: 3 варианта → несколько уровней → тонкие концы (value 1–3), больше веток
const data = {
  nodes: [
    { id: 'variant-1', label: 'Вариант 1' },
    { id: 'variant-2', label: 'Вариант 2' },
    { id: 'variant-3', label: 'Вариант 3' },
    { id: 'm1' }, { id: 'm2' }, { id: 'm3' }, { id: 'm4' }, { id: 'm5' }, { id: 'm6' }, { id: 'm7' }, { id: 'm8' }, { id: 'm9' }, { id: 'm10' },
    { id: 'n1' }, { id: 'n2' }, { id: 'n3' }, { id: 'n4' }, { id: 'n5' }, { id: 'n6' }, { id: 'n7' }, { id: 'n8' }, { id: 'n9' }, { id: 'n10' }, { id: 'n11' },
    { id: 'end-1' }, { id: 'end-2' }, { id: 'end-3' }, { id: 'end-4' }, { id: 'end-5' }, { id: 'end-6' }, { id: 'end-7' }, { id: 'end-8' },
  ],
  links: [
    { source: 'variant-1', target: 'm1', value: 8 },
    { source: 'variant-1', target: 'm2', value: 7 },
    { source: 'variant-1', target: 'm3', value: 6 },
    { source: 'variant-1', target: 'm4', value: 5 },
    { source: 'variant-2', target: 'm2', value: 7 },
    { source: 'variant-2', target: 'm3', value: 6 },
    { source: 'variant-2', target: 'm4', value: 8 },
    { source: 'variant-2', target: 'm5', value: 6 },
    { source: 'variant-2', target: 'm6', value: 5 },
    { source: 'variant-3', target: 'm3', value: 5 },
    { source: 'variant-3', target: 'm4', value: 6 },
    { source: 'variant-3', target: 'm5', value: 7 },
    { source: 'variant-3', target: 'm6', value: 5 },
    { source: 'variant-3', target: 'm7', value: 6 },
    { source: 'variant-3', target: 'm8', value: 5 },
    { source: 'm1', target: 'n1', value: 5 },
    { source: 'm1', target: 'n2', value: 4 },
    { source: 'm2', target: 'n2', value: 5 },
    { source: 'm2', target: 'n3', value: 4 },
    { source: 'm3', target: 'n3', value: 5 },
    { source: 'm3', target: 'n4', value: 4 },
    { source: 'm4', target: 'n4', value: 5 },
    { source: 'm4', target: 'n5', value: 5 },
    { source: 'm5', target: 'n5', value: 4 },
    { source: 'm5', target: 'n6', value: 4 },
    { source: 'm6', target: 'n6', value: 3 },
    { source: 'm6', target: 'n7', value: 4 },
    { source: 'm7', target: 'n7', value: 3 },
    { source: 'm7', target: 'n8', value: 4 },
    { source: 'm8', target: 'n8', value: 3 },
    { source: 'm8', target: 'n9', value: 4 },
    { source: 'm9', target: 'n9', value: 3 },
    { source: 'm9', target: 'n10', value: 4 },
    { source: 'm10', target: 'n10', value: 3 },
    { source: 'm10', target: 'n11', value: 4 },
    { source: 'n1', target: 'end-1', value: 2 },
    { source: 'n1', target: 'end-2', value: 1 },
    { source: 'n2', target: 'end-2', value: 2 },
    { source: 'n2', target: 'end-3', value: 1 },
    { source: 'n3', target: 'end-3', value: 2 },
    { source: 'n3', target: 'end-4', value: 1 },
    { source: 'n4', target: 'end-4', value: 2 },
    { source: 'n4', target: 'end-5', value: 1 },
    { source: 'n5', target: 'end-5', value: 2 },
    { source: 'n5', target: 'end-6', value: 1 },
    { source: 'n6', target: 'end-1', value: 1 },
    { source: 'n6', target: 'end-6', value: 2 },
    { source: 'n7', target: 'end-1', value: 2 },
    { source: 'n7', target: 'end-7', value: 1 },
    { source: 'n8', target: 'end-2', value: 1 },
    { source: 'n8', target: 'end-7', value: 2 },
    { source: 'n9', target: 'end-3', value: 1 },
    { source: 'n9', target: 'end-8', value: 2 },
    { source: 'n10', target: 'end-7', value: 2 },
    { source: 'n10', target: 'end-8', value: 1 },
    { source: 'n11', target: 'end-8', value: 2 },
  ],
}

const GREEN = '#16a34a'
const RED = '#dc2626'
const END_RED_IDS = ['end-1', 'end-2', 'end-3', 'end-7']
const END_GREEN_IDS = ['end-4', 'end-5', 'end-6', 'end-8']

function nodeColor(node) {
  if (String(node.id).startsWith('variant-')) return GREEN
  if (END_RED_IDS.includes(node.id)) return RED
  if (END_GREEN_IDS.includes(node.id)) return GREEN
  return GREEN
}

function ScenarioSankeyNivo({
  activePathId = null,
  onVariantSelect,
  onVariantHover,
}) {
  const highlightId = activePathId || null
  const onHoverRef = useRef(onVariantHover)
  onHoverRef.current = onVariantHover

  const { pathNodeIds, pathLinkKeys } = useMemo(() => {
    if (!highlightId) return { pathNodeIds: new Set(), pathLinkKeys: new Set() }
    return getPathFromVariant(highlightId, data.links)
  }, [highlightId])

  function variantRoot(node) {
    if (!node) return null
    if (String(node.id).startsWith('variant-')) return node.id
    const incoming = node.targetLinks || []
    const first = incoming[0]?.source
    return first ? variantRoot(first) : null
  }

  const HoverSyncLayer = ({ currentNode, currentLink }) => {
    useEffect(() => {
      if (currentNode && String(currentNode.id).startsWith('variant-')) {
        onHoverRef.current?.(currentNode.id)
        return
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
    const id = node?.id
    if (id && String(id).startsWith('variant-')) {
      onVariantSelect?.(id)
    }
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: 400,
      }}
    >
      <ResponsiveSankey
        data={data}
        layout="vertical"
        margin={{ top: 20, right: 120, bottom: 20, left: 120 }}
        align="justify"
        colors={nodeColor}
        nodeOpacity={1}
        nodeThickness={8}
        nodeSpacing={10}
        nodeInnerPadding={2}
        nodeBorderWidth={0}
        nodeBorderColor={{ from: 'color', modifiers: [['darker', 0.8]] }}
        linkOpacity={0.75}
        linkHoverOpacity={0.95}
        linkHoverOthersOpacity={0.12}
        linkBlendMode="multiply"
        enableLinkGradient={true}
        enableLabels={true}
        labelPosition="outside"
        labelOrientation="vertical"
        labelPadding={8}
        isInteractive={true}
        onClick={handleClick}
        theme={{
          labels: {
            text: {
              fontSize: 11,
              fill: '#111827',
            },
          },
        }}
        linkOpacity={(link) => {
          if (!highlightId) return 0.75
          const sid = String(link.source?.id ?? link.source ?? '')
          const tid = String(link.target?.id ?? link.target ?? '')
          const key = `${sid}|${tid}`
          return pathLinkKeys.has(key) ? 1 : 0.06
        }}
        nodeOpacity={(node) => {
          if (!highlightId) return 1
          const id = String(node.id ?? '')
          return pathNodeIds.has(id) ? 1 : 0.06
        }}
        layers={['links', 'nodes', 'labels', HoverSyncLayer]}
      />
    </div>
  )
}

export default ScenarioSankeyNivo
