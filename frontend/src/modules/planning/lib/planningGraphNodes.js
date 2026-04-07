/**
 * Строит список узлов для графа «Граф сценария» из этапов и карточек доски планирования.
 * Используется в панели «Режим мышления» для отображения той же цепочки, что и на вкладке Планирование.
 */

/**
 * @param {string[]} stages - названия этапов
 * @param {Record<string, Array<{ id: string, name: string, entries?: Array<{ system?: string }> }>>} tasks - карточки по этапам
 * @returns {{ id: string, label: string }[]}
 */
export function getScenarioGraphNodesFromBoard(stages, tasks) {
  if (!Array.isArray(stages) || !stages.length) return []
  const nodes = []
  let id = 0
  stages.forEach((stageName) => {
    const stageLabel = stageName.length > 16 ? stageName.slice(0, 13) + '…' : stageName
    nodes.push({ id: `s-${id++}`, label: stageLabel })
    const list = tasks && tasks[stageName] ? tasks[stageName] : []
    list.forEach((task) => {
      const name = task.name || task.id || ''
      const shortLabel = name.length > 14 ? name.slice(0, 11) + '…' : name
      nodes.push({ id: `t-${id++}`, label: shortLabel || 'Карточка' })
      const entries = task.entries || []
      entries.filter((e) => e && e.system && String(e.system).trim()).forEach((entry) => {
        const sysName = String(entry.system).trim()
        const sysShort = sysName.length > 10 ? sysName.slice(0, 8) + '…' : sysName
        nodes.push({ id: `e-${id++}`, label: sysShort })
      })
    })
  })
  return nodes
}
