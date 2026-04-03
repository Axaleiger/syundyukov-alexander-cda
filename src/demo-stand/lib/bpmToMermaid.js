/**
 * Генерация Mermaid flowchart из данных доски BPM (этапы и карточки).
 * Используется для синхронизации вкладки Планирование с Кодом/Схемой в Конфигураторе.
 */

function safeId(str) {
  if (!str || typeof str !== 'string') return 'N'
  return str.replace(/\s+/g, '_').replace(/[^\wа-яА-ЯёЁ_-]/gi, '').slice(0, 30) || 'N'
}

function safeLabel(str) {
  if (str == null) return ''
  const s = String(str).replace(/"/g, "'").slice(0, 40)
  return s
}

/**
 * @param {string[]} stages - массив названий этапов
 * @param {Record<string, Array<{ id: string, name: string, entries?: Array<{ system?: string }> }>>} tasks - задачи по этапам
 * @returns {string} Mermaid flowchart LR
 */
export function bpmToMermaid(stages, tasks) {
  if (!Array.isArray(stages) || !stages.length) {
    return `flowchart LR
  A[Нет этапов] --> B((Добавьте данные в Планирование))`
  }

  const lines = ['flowchart LR']
  const stageNodeIds = []
  const cardNodeIds = []

  stages.forEach((stageName, stageIndex) => {
    const sgId = `SG${stageIndex}_${safeId(stageName)}`
    const stageLabel = safeLabel(stageName.length > 35 ? stageName.slice(0, 32) + '...' : stageName)
    lines.push(`  subgraph ${sgId}["${stageLabel}"]`)

    const taskList = tasks && tasks[stageName] ? tasks[stageName] : []
    const cards = []
    taskList.forEach((task, taskIndex) => {
      const cardId = `C${stageIndex}_${taskIndex}_${safeId(task.id || task.name)}`
      cardNodeIds.push(cardId)
      const cardLabel = safeLabel((task.name || task.id || 'Карточка').slice(0, 35))
      lines.push(`    ${cardId}["${cardLabel}"]`)
      cards.push(cardId)
    })

    lines.push('  end')
    stageNodeIds.push({ stageId: sgId, cards })
  })

  // Рёбра: между этапами (первая карточка -> первая карточка следующего этапа) и внутри этапа (карточка -> карточка)
  for (let i = 0; i < stageNodeIds.length; i++) {
    const { cards } = stageNodeIds[i]
    for (let j = 0; j < cards.length - 1; j++) {
      lines.push(`  ${cards[j]} --> ${cards[j + 1]}`)
    }
    if (i < stageNodeIds.length - 1 && stageNodeIds[i + 1].cards.length > 0) {
      const lastCard = cards[cards.length - 1]
      const nextFirst = stageNodeIds[i + 1].cards[0]
      if (lastCard) lines.push(`  ${lastCard} --> ${nextFirst}`)
    }
  }

  return lines.join('\n')
}
