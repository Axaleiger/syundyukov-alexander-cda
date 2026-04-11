import React, { useState, useCallback, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { BPM_STAGES, BPM_CARDS_BY_STAGE, PERSONNEL, SYSTEMS_LIST, cardMatchesHighlight } from '../data/bpmData'
import { AI_PLANNING_BOARD_PRESETS } from '../data/aiPlanningBoardPresets.js'

/** Генерирует данные для одной ИИ-карточки: id (AI + 5 цифр), исполнитель, согласующий, даты */
function getAiCardData(seed) {
  const id = 'AI' + String(10000 + Math.abs(hashStr(seed) % 90000))
  const execIdx = Math.abs(hashStr(seed + 'e') % PERSONNEL.length)
  const apprIdx = Math.abs(hashStr(seed + 'a') % PERSONNEL.length)
  const daysStart = Math.abs(hashStr(seed + 's') % 30)
  const daysEnd = daysStart + Math.abs(hashStr(seed + 'e') % 14) + 7
  const dStart = new Date()
  dStart.setDate(dStart.getDate() + daysStart)
  const dEnd = new Date()
  dEnd.setDate(dEnd.getDate() + daysEnd)
  return {
    id,
    executor: PERSONNEL[execIdx],
    approver: PERSONNEL[apprIdx === execIdx ? (apprIdx + 1) % PERSONNEL.length : apprIdx],
    periodStart: dStart.toISOString().slice(0, 10),
    periodEnd: dEnd.toISOString().slice(0, 10),
  }
}
import { generateBoardExcel, generateTemplateExcel, generateOntologyExcel } from '../data/bpmExcel'
import { bpmToMermaid } from '../lib/bpmToMermaid'
import CalculateGraph from './CalculateGraph'
import BPMRightPanelSystems from './BPMRightPanelSystems'
import BPMRightPanelExecutor from './BPMRightPanelExecutor'
import './BPMBoard.css'

const SCHEDULE_EVERY_OPTIONS = ['каждые 1 день', 'каждые 2 дня', 'каждые 3 дня', 'каждые 5 дней', 'каждую неделю', 'каждые 2 недели']
const AI_STAGE_NAME = 'ИИ-АВТОПРЕДЛОЖЕННЫЙ ЭТАП'
const AI_STAGE_NAME_2 = 'ИИ-АВТОПРЕДЛОЖЕННЫЙ ЭТАП 2'

/** Пустой шаблон этапов только для режима createPlanningCase (ИИ); доска с сервера — только из API. */
const DEFAULT_CREATE_STAGES = ['Подготовка', 'Реализация', 'Контроль']

/** CSS-переменная задержки появления карточки при анимации «ИИ строит доску». */
function bpmCardRevealStyle(animate, stageIdx, cardIdx) {
  if (!animate) return undefined
  return { '--bpm-card-reveal-delay': `${stageIdx * 120 + cardIdx * 58}ms` }
}

function nextUniqueStageName(existingStages, base = 'Новый этап') {
  const set = new Set(existingStages || [])
  if (!set.has(base)) return base
  let i = 2
  while (set.has(`${base} ${i}`)) i += 1
  return `${base} ${i}`
}

function getInitials(name) {
  if (!name || !String(name).trim()) return '?'
  const parts = String(name).trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2)
  return String(name).slice(0, 2).toUpperCase()
}

function formatDeadlineShort(deadline) {
  if (!deadline) return '—'
  const d = deadline instanceof Date ? deadline : new Date(deadline)
  if (isNaN(d.getTime())) return '—'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return '1 день'
  if (diff >= 2 && diff <= 4) return `${diff} дня`
  if (diff >= 5 && diff <= 20) return `${diff} дней`
  return d.toLocaleDateString('ru-RU')
}

function formatPeriod(deadline) {
  if (!deadline) return '—'
  const d = deadline instanceof Date ? deadline : new Date(deadline)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU')
}

function avatarColor(name) {
  if (!name || !String(name).trim()) return '#94a3b8'
  let h = 0
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h) + name.charCodeAt(i) | 0
  const hue = Math.abs(h % 360)
  return `hsl(${hue}, 55%, 45%)`
}

function hashStr(s) {
  let h = 0
  for (let i = 0; i < (s || '').length; i++) h = ((h << 5) - h) + (s || '').charCodeAt(i) | 0
  return Math.abs(h)
}

/** Только рандомное количество записей «Название данных», без придуманных названий */
function generateInputFiles(taskId) {
  const n = (hashStr(taskId) % 4) + 1
  const out = []
  for (let i = 0; i < n; i++) {
    const statuses = ['ok', 'ok', 'missing', 'warning']
    const status = statuses[hashStr(taskId + String(i)) % 4]
    out.push({ name: 'Название данных', date: new Date().toLocaleDateString('ru-RU'), status })
  }
  return out
}

/** Для ИИ-карточки: входные данные все зелёные (ok) */
function getAiCardInputFiles(aiCardId) {
  const n = (hashStr(aiCardId) % 4) + 1
  return Array.from({ length: n }, (_, i) => ({
    name: 'Название данных',
    date: new Date().toLocaleDateString('ru-RU'),
    status: 'ok',
  }))
}

/** Для ИИ-карточки: рандомные системы из списка (1–3) */
function getAiCardSystems(aiCardId) {
  const count = (hashStr(aiCardId) % 3) + 1
  const indices = []
  for (let i = 0; i < count; i++) {
    const idx = (hashStr(aiCardId + i) % SYSTEMS_LIST.length)
    if (!indices.includes(idx)) indices.push(idx)
  }
  return indices.slice(0, 3).map((i) => SYSTEMS_LIST[i]).filter(Boolean)
}

function generateResultFiles(taskId) {
  const n = (hashStr(taskId + 'r') % 3) + 1
  const names = ['Результат расчета', 'Отчёт', 'График']
  return Array.from({ length: n }, (_, i) => ({ name: names[i % names.length] + (n > 1 ? ` ${i + 1}` : '') }))
}

/** Результаты расчета — конкретные показатели по типу карточки/сервиса (как в ТЗ) */
function getResultLinesForCard(taskName, taskId) {
  const name = (taskName || '').trim().toLowerCase()
  if (name.includes('подбор гтм') && name.includes('добывающем фонде')) {
    return [
      'Прогнозный профиль добычи нефти, тыс. т',
      'Прогнозный профиль добычи воды, тыс. т',
      'Прогнозный профиль добычи газа, млн. м3',
      'Прогнозное Рзаб, атм',
    ]
  }
  if (name.includes('прогноз') && (name.includes('добыч') || name.includes('нефт'))) {
    return [
      'Прогнозный профиль добычи нефти, тыс. т',
      'Прогнозный профиль добычи воды, тыс. т',
      'Накопленная добыча нефти, тыс. т',
      'Обводнённость, %',
    ]
  }
  if (name.includes('скважин') || name.includes('фонд')) {
    return [
      'Список скважин по категориям',
      'Дебит нефти по скважинам, т/сут',
      'Дебит жидкости по скважинам, м³/сут',
      'Обводнённость по скважинам, %',
    ]
  }
  if (name.includes('модел') || name.includes('гидродинам')) {
    return [
      'Карта насыщенности',
      'Карта давления, атм',
      'Прогноз дебитов по скважинам',
      'История совпадения по добыче, %',
    ]
  }
  if (name.includes('гтм') || name.includes('обработк')) {
    return [
      'Рекомендуемые методы ГТМ по скважинам',
      'Ожидаемый прирост добычи нефти, т',
      'Экономический эффект, тыс. руб',
    ]
  }
  if (name.includes('породы') || name.includes('коллектор')) {
    return [
      'Проницаемость по пластам, мД',
      'Пористость по пластам, д.ед.',
      'Насыщенность нефтью, д.ед.',
    ]
  }
  if (name.includes('буре') || name.includes('бурение')) {
    return [
      'Траектория скважины, м',
      'Интервалы перфорации, м',
      'Календарный план бурения',
    ]
  }
  if (name.includes('реинжениринг') || name.includes('процесс')) {
    return [
      'Карта бизнес-процессов',
      'Список регламентов',
      'Матрица ответственности',
    ]
  }
  const byHash = [
    ['Дебит нефти, т/сут', 'Дебит жидкости, м³/сут', 'Обводнённость, %', 'Забойное давление, атм'],
    ['Накопленная добыча нефти, тыс. т', 'Накопленная добыча воды, тыс. м³', 'Текущий КИН', 'Остаточные извлекаемые запасы, тыс. т'],
    ['Прогноз добычи на 5 лет, тыс. т', 'Среднегодовой темп падения, %', 'Экономические показатели'],
  ]
  const list = byHash[hashStr(taskId) % byHash.length]
  return list.slice(0, (hashStr(taskId + 'x') % 2) + 3)
}

function getTaskInputFiles(task) {
  if (task.inputFiles && Array.isArray(task.inputFiles) && task.inputFiles.length > 0) return task.inputFiles
  return generateInputFiles(task.id)
}

function getTaskResultFiles(task) {
  if (task.resultFiles && Array.isArray(task.resultFiles) && task.resultFiles.length > 0) return task.resultFiles
  return getResultLinesForCard(task.name, task.id).map((name) => ({ name }))
}

function toTask(card) {
  const d = new Date()
  return {
    id: card.id,
    name: card.name,
    executor: '',
    approver: '',
    deadline: d,
    status: 'в работе',
    date: new Date().toLocaleDateString('ru-RU'),
    entries: [{ system: '', input: '', output: '' }],
    scheduleEvery: 'каждые 2 дня',
    periodStart: d,
    periodEnd: d,
    inputFiles: generateInputFiles(card.id),
    resultFiles: generateResultFiles(card.id),
  }
}

function initialTasks() {
  const out = {}
  BPM_STAGES.forEach((stage) => {
    out[stage] = (BPM_CARDS_BY_STAGE[stage] || []).map(toTask)
  })
  return out
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function downloadInputListExcel(inputFiles) {
  const rows = (inputFiles || []).map((f) => ({
    'Название данных': f.name || 'Название данных',
    'Статус': f.status || '—',
    'Дата': f.date || '—',
    ...(f.aiChanged && f.aiComment ? { 'Комментарий ИИ': f.aiComment } : {}),
  }))
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Название данных': '', 'Статус': '', 'Дата': '' }])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Данные')
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'Список_данных.xlsx')
}

function downloadEmptyExcel(fileName) {
  const base = (fileName || 'Название данных').replace(/\.xlsx$/i, '')
  const ws = XLSX.utils.aoa_to_sheet([[]])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Лист1')
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${base}.xlsx`)
}

function downloadResultListExcel(resultLines) {
  const rows = (resultLines || []).map((r) => {
    const name = typeof r === 'string' ? r : (r.name || '')
    const row = { 'Результаты расчета': name }
    if (typeof r === 'object' && r.aiChanged && r.aiComment) row['Комментарий ИИ'] = r.aiComment
    if (typeof r === 'object' && r.status) row['Статус'] = r.status
    return row
  })
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Результаты расчета': '' }])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Результаты')
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'Результаты_расчета.xlsx')
}

function generateOilFlowHtml(stages, tasks) {
  const nodes = []
  const edges = []
  let id = 0
  const stageIds = []
  stages.forEach((stageName, si) => {
    const sid = id++
    stageIds.push(sid)
    nodes.push({
      id: sid,
      label: stageName.length > 35 ? stageName.slice(0, 32) + '...' : stageName,
      x: 100 + si * 200,
      y: 80,
      color: { background: '#3b82f6', border: '#1e40af' },
      font: { color: '#fff', size: 14 },
      shape: 'box',
    })
    const list = tasks[stageName] || []
    list.forEach((task, ti) => {
      const tid = id++
      nodes.push({
        id: tid,
        label: `${task.id} — ${(task.name || '').slice(0, 30)}${(task.name || '').length > 30 ? '...' : ''}`,
        x: 120 + si * 200,
        y: 180 + ti * 70,
        color: { background: '#fff', border: '#94a3b8' },
        font: { color: '#1f2937', size: 12 },
        shape: 'box',
      })
      if (ti === 0) edges.push({ from: sid, to: tid, arrows: 'to' })
      else edges.push({ from: stageIds[si] + 1 + ti - 1, to: tid, arrows: 'to' })
    })
  })
  for (let i = 0; i < stageIds.length - 1; i++) edges.push({ from: stageIds[i], to: stageIds[i + 1], arrows: 'to' })
  const nodesJson = JSON.stringify(nodes)
  const edgesJson = JSON.stringify(edges)
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>OilFlow</title><script src="https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js"><\/script></head><body style="margin:0;background:#f1f5f9;"><div id="mynetwork" style="width:100vw;height:100vh;"></div><script>
var nodes=new vis.DataSet(${nodesJson});var edges=new vis.DataSet(${edgesJson});
var n=new vis.Network(document.getElementById("mynetwork"),{nodes:nodes,edges:edges},{physics:false,edges:{arrows:'to'}});
<\/script></body></html>`
}

function buildGraph(stages, tasks) {
  const nodes = new Map()
  const edges = []
  stages.forEach((stage) => {
    const skey = `Этап: ${stage}`
    nodes.set(skey, skey)
    ;(tasks[stage] || []).forEach((task) => {
      const ckey = `Карточка: ${task.name}`
      nodes.set(ckey, ckey)
      edges.push([skey, ckey])
      ;(task.entries || []).forEach((e) => {
        if (!e.system) return
        const sysKey = `Система: ${e.system}`
        nodes.set(sysKey, sysKey)
        edges.push([ckey, sysKey])
      })
    })
  })
  return { nodes: Array.from(nodes.keys()), edges }
}

function computeAnalytics(stages, tasks) {
  const g = buildGraph(stages, tasks)
  const degree = {}
  g.nodes.forEach((n) => { degree[n] = 0 })
  g.edges.forEach(([a, b]) => {
    degree[a] = (degree[a] || 0) + 1
    degree[b] = (degree[b] || 0) + 1
  })
  const byType = { Этап: 0, Карточка: 0, Система: 0 }
  g.nodes.forEach((label) => {
    if (label.startsWith('Этап:')) byType['Этап']++
    else if (label.startsWith('Карточка:')) byType['Карточка']++
    else if (label.startsWith('Система:')) byType['Система']++
  })
  const sorted = [...g.nodes].sort((a, b) => (degree[b] || 0) - (degree[a] || 0))
  const topNodes = sorted.slice(0, 10).map((n) => ({ label: n, degree: degree[n] }))
  const avgByType = {}
  Object.keys(byType).forEach((t) => {
    const count = byType[t]
    if (count === 0) avgByType[t] = 0
    else {
      const typeNodes = g.nodes.filter((n) =>
        (t === 'Этап' && n.startsWith('Этап:')) ||
        (t === 'Карточка' && n.startsWith('Карточка:')) ||
        (t === 'Система' && n.startsWith('Система:')))
      avgByType[t] = (typeNodes.reduce((s, n) => s + (degree[n] || 0), 0) / typeNodes.length).toFixed(1)
    }
  })
  const n = g.nodes.length
  const density = n < 2 ? 0 : (2 * g.edges.length / (n * (n - 1))).toFixed(4)
  const degreeHistogram = {}
  g.nodes.forEach((node) => {
    const d = degree[node] || 0
    degreeHistogram[d] = (degreeHistogram[d] || 0) + 1
  })
  const degreeBuckets = []
  const maxDeg = Math.max(...Object.keys(degreeHistogram).map(Number), 0)
  for (let i = 0; i <= Math.min(maxDeg, 15); i++) {
    degreeBuckets.push({ degree: i, count: degreeHistogram[i] || 0 })
  }
  return {
    nodeCount: g.nodes.length,
    edgeCount: g.edges.length,
    density,
    byType,
    avgByType,
    topNodes,
    degreeBuckets,
  }
}

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2
  if (max === min) h = s = 0
  else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      default: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}
function lessSaturated(hex, factor = 0.5) {
  const [h, s, l] = hexToHsl(hex)
  return `hsl(${h}, ${Math.round(s * factor)}%, ${l}%)`
}

function BPMBoard({ initialStages, initialTasks, initialConnections, scenarioName = 'Управление добычей с учетом ближайшего бурения', selectedAssetName, highlightCardName, onClose, onBoardChange, aiMode: aiModeProp, setAiMode: setAiModeProp, onOpenPlanningWithScenario, bpmCommand, onBpmCommandConsumed, animateAiBoardReveal = false }) {
  const isCreatePlanningCase = bpmCommand?.scenarioId === 'createPlanningCase'
  const [stages, setStages] = useState(() => {
    if (isCreatePlanningCase) return [...DEFAULT_CREATE_STAGES]
    return initialStages != null ? initialStages : []
  })
  const [tasks, setTasks] = useState(() => {
    if (isCreatePlanningCase) return {}
    return initialTasks != null ? initialTasks : {}
  })
  const [viewMode, setViewMode] = useState('Подробный вид')
  const [expanded, setExpanded] = useState({}) // key: task.id — сохраняется при перетаскивании между этапами
  const [expandedSections, setExpandedSections] = useState({}) // key: task.id, value: { systems, input, results }
  const [editingTask, setEditingTask] = useState(null)
  const [editingStage, setEditingStage] = useState(null)
  const [stageNameEdit, setStageNameEdit] = useState('')
  const [editingCardName, setEditingCardName] = useState(null) // { stageName, taskIdx }
  const [cardNameEdit, setCardNameEdit] = useState('')
  const [dragged, setDragged] = useState(null)
  const [showCalculateView, setShowCalculateView] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [executorFilter, setExecutorFilter] = useState('')
  const [approverFilter, setApproverFilter] = useState('')
  const [periodStartFilter, setPeriodStartFilter] = useState('')
  const [periodEndFilter, setPeriodEndFilter] = useState('')
  const [draggedStageIndex, setDraggedStageIndex] = useState(null)
  const [rightPanel, setRightPanel] = useState(null) // { type: 'systems'|'executor', stageName, taskIdx, role? }
  const [customPersonnelList, setCustomPersonnelList] = useState([]) // общий список добавленных вручную ФИО до обновления страницы
  const [connections, setConnections] = useState(() => (Array.isArray(initialConnections) ? initialConnections : [])) // [{ fromStage, fromId, toStage, toId }]
  const [connectionsMode, setConnectionsMode] = useState(false)
  const [connectionFrom, setConnectionFrom] = useState(null) // { stageName, taskId }
  const [aiModeLocal, setAiModeLocal] = useState(false)
  const aiMode = setAiModeProp != null ? aiModeProp : aiModeLocal
  const setAiMode = setAiModeProp || setAiModeLocal
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [connectionLines, setConnectionLines] = useState([])
  const [syntheticCountByTaskId, setSyntheticCountByTaskId] = useState({})
  const [aiAutoselectByTaskId, setAiAutoselectByTaskId] = useState({})
  const [agreedAiCardIds, setAgreedAiCardIds] = useState(() => new Set())
  const [aiStageAgreed, setAiStageAgreed] = useState(false)
  const [aiStage2Agreed, setAiStage2Agreed] = useState(false)
  const [aiCaseStageNames, setAiCaseStageNames] = useState(() => new Set())
  const [aiCaseCardIds, setAiCaseCardIds] = useState(() => new Set())
  const [agreedAiCaseCardIds, setAgreedAiCaseCardIds] = useState(() => new Set())
  const [aiStaticCardOverrides, setAiStaticCardOverrides] = useState({}) // { 'aiId': { executor, approver, name }, ... }
  const [editingAiCardId, setEditingAiCardId] = useState(null)
  const [aiSuggestionsOn, setAiSuggestionsOn] = useState(false)
  const [removedAiCardIds, setRemovedAiCardIds] = useState(() => new Set())
  const [aiSuggestionCardPlacements, setAiSuggestionCardPlacements] = useState(null)
  const aiSuggestionPlacementsRef = React.useRef(null)
  const draggedAiCardRef = React.useRef(null)
  const boardRef = React.useRef(null)

  const [aiRevealDone, setAiRevealDone] = useState(() => !animateAiBoardReveal)
  useEffect(() => {
    if (!animateAiBoardReveal) {
      setAiRevealDone(true)
      return undefined
    }
    if (!stages?.length) {
      setAiRevealDone(false)
      return undefined
    }
    const startTimer = window.setTimeout(() => {
      setAiRevealDone(true)
    }, 240)
    return () => {
      clearTimeout(startTimer)
    }
  }, [animateAiBoardReveal, stages])

  const removeAiCard = useCallback((aiId) => {
    setRemovedAiCardIds((prev) => new Set(prev).add(aiId))
  }, [])

  useEffect(() => {
    if (!aiMode) setAiAutoselectByTaskId({})
  }, [aiMode])

  useEffect(() => {
    if (aiSuggestionsOn) {
      setStages((prev) => {
        const base = prev.filter((s) => s !== AI_STAGE_NAME && s !== AI_STAGE_NAME_2)
        if (!base.length) return [AI_STAGE_NAME, AI_STAGE_NAME_2]
        let placements = aiSuggestionPlacementsRef.current
        if (!placements || !Array.isArray(placements.stageIndices)) {
          const len = base.length + 1
          let i1 = Math.floor(Math.random() * len)
          let i2 = Math.floor(Math.random() * len)
          if (i1 > i2) [i1, i2] = [i2, i1]
          if (i1 === i2) i2 = Math.min(i1 + 1, len)
          aiSuggestionPlacementsRef.current = { stageIndices: [i1, i2] }
          placements = aiSuggestionPlacementsRef.current
        }
        const [i1, i2] = placements.stageIndices
        return [
          ...base.slice(0, i1),
          AI_STAGE_NAME,
          ...base.slice(i1, i2),
          AI_STAGE_NAME_2,
          ...base.slice(i2),
        ]
      })
      setTasks((t) => {
        const buildStatic = (seeds, ids, indices) => seeds.map((seed, i) => {
          const ad = getAiCardData(seed)
          return { id: ids[i], isAiStatic: true, aiCardDataIndex: indices[i], name: 'ИИ-автопредложенная карточка', executor: ad.executor, approver: ad.approver, periodStart: ad.periodStart, periodEnd: ad.periodEnd }
        })
        const col1 = buildStatic(['ai-stage-0', 'ai-stage-1', 'ai-stage-2'], ['ai-static-0', 'ai-static-1', 'ai-static-2'], [1, 2, 3])
        const col2 = (() => { const ad = getAiCardData('ai-stage-3'); return [{ id: 'ai-static-col2-0', isAiStatic: true, aiCardDataIndex: 4, name: 'ИИ-автопредложенная карточка', executor: ad.executor, approver: ad.approver, periodStart: ad.periodStart, periodEnd: ad.periodEnd }] })()
        return { ...t, [AI_STAGE_NAME]: col1, [AI_STAGE_NAME_2]: col2 }
      })
      if (!aiSuggestionCardPlacements) {
        const base = stages.filter((s) => s !== AI_STAGE_NAME && s !== AI_STAGE_NAME_2)
        if (base.length) {
          const placements = []
          for (let c = 0; c < 3; c++) {
            const stageName = base[Math.floor(Math.random() * base.length)]
            const list = (tasks[stageName] || [])
            const index = Math.floor(Math.random() * (list.length + 1))
            placements.push({ stageName, index, cardKey: c })
          }
          setAiSuggestionCardPlacements(placements)
        }
      }
    } else {
      setStages((prev) => prev.filter((s) => s !== AI_STAGE_NAME && s !== AI_STAGE_NAME_2))
      setTasks((t) => {
        const next = { ...t }
        delete next[AI_STAGE_NAME]
        delete next[AI_STAGE_NAME_2]
        return next
      })
    }
  }, [aiSuggestionsOn])

  const toggleAgreedAiCard = useCallback((aiId) => {
    setAgreedAiCardIds((prev) => {
      const next = new Set(prev)
      if (next.has(aiId)) next.delete(aiId)
      else next.add(aiId)
      return next
    })
  }, [])

  const aiCardsData = useMemo(() => [
    getAiCardData('ai-0'),
    getAiCardData('ai-stage-0'),
    getAiCardData('ai-stage-1'),
    getAiCardData('ai-stage-2'),
    getAiCardData('ai-stage-3'),
  ], [])

  const AI_DONA_COMMENTS = ['Доработка данных', 'Устранение выбросов', 'Восполнение пропусков', 'Корректировка аномалий', 'Приведение к формату']

  const findTaskLocation = useCallback((taskId) => {
    for (const stageName of Object.keys(tasks)) {
      const list = tasks[stageName] || []
      const idx = list.findIndex((t) => t.id === taskId)
      if (idx >= 0) return { stageName, taskIdx: idx }
    }
    return null
  }, [tasks])

  const applyInputDona = useCallback((taskId) => {
    const loc = findTaskLocation(taskId)
    if (!loc) return
    const { stageName, taskIdx } = loc
    const task = tasks[stageName][taskIdx]
    const inputFiles = (getTaskInputFiles(task)).map((f) => ({ ...f, name: f.name || 'Название данных', date: f.date || new Date().toLocaleDateString('ru-RU'), status: f.status || 'ok' }))
    const next = inputFiles.map((f, i) => {
      if (Math.random() > 0.4) return f
      const status = f.status
      let newStatus = status
      if (status === 'warning') newStatus = Math.random() > 0.5 ? 'ok' : 'warning'
      else if (status === 'missing') newStatus = ['ok', 'warning'][Math.floor(Math.random() * 2)]
      if (newStatus !== status) {
        return { ...f, status: newStatus, aiChanged: true, aiComment: AI_DONA_COMMENTS[hashStr(taskId + String(i)) % AI_DONA_COMMENTS.length] }
      }
      return f
    })
    setTasks((t) => {
      const list = [...(t[stageName] || [])]
      list[taskIdx] = { ...list[taskIdx], inputFiles: next }
      return { ...t, [stageName]: list }
    })
  }, [tasks, findTaskLocation])

  const applyResultDona = useCallback((taskId) => {
    const loc = findTaskLocation(taskId)
    if (!loc) return
    const { stageName, taskIdx } = loc
    const task = tasks[stageName][taskIdx]
    const resultFiles = (getTaskResultFiles(task)).map((r) => ({ name: r.name || 'Результат расчета', status: r.status || ['ok', 'missing', 'warning'][hashStr(taskId + (r.name || '')) % 3] }))
    const next = resultFiles.map((f, i) => {
      if (Math.random() > 0.4) return f
      const status = f.status
      let newStatus = status
      if (status === 'warning') newStatus = Math.random() > 0.5 ? 'ok' : 'warning'
      else if (status === 'missing') newStatus = ['ok', 'warning'][Math.floor(Math.random() * 2)]
      if (newStatus !== status) {
        return { ...f, status: newStatus, aiChanged: true, aiComment: AI_DONA_COMMENTS[hashStr(taskId + String(i)) % AI_DONA_COMMENTS.length] }
      }
      return f
    })
    setTasks((t) => {
      const list = [...(t[stageName] || [])]
      list[taskIdx] = { ...list[taskIdx], resultFiles: next }
      return { ...t, [stageName]: list }
    })
  }, [tasks, findTaskLocation])

  const addSyntheticResult = useCallback((taskId) => {
    applyResultDona(taskId)
  }, [applyResultDona])

  const getSyntheticLabels = useCallback((taskId) => {
    return []
  }, [])

  // Обработка команд ИИ-помощника: создание кейса, риски, cashflow
  const stagesRef = React.useRef(stages)
  stagesRef.current = stages
  const processedBpmCommandRef = React.useRef(null)
  useEffect(() => {
    if (!bpmCommand?.scenarioId || typeof onBpmCommandConsumed !== 'function') {
      processedBpmCommandRef.current = null
      return
    }
    if (processedBpmCommandRef.current === bpmCommand) return
    processedBpmCommandRef.current = bpmCommand
    const scenarioId = bpmCommand.scenarioId
    if (scenarioId === 'loadAiPresetBoard') {
      const preset = bpmCommand.params?.preset
      const data = preset ? AI_PLANNING_BOARD_PRESETS[preset] : null
      if (data) {
        setStages([...data.stages])
        setTasks({ ...data.tasks })
        setConnections(Array.isArray(data.connections) ? [...data.connections] : [])
        setAiCaseStageNames(new Set())
        setAiCaseCardIds(new Set())
        onBpmCommandConsumed?.({ switchToOntology: false, flowCode: bpmToMermaid(data.stages, data.tasks) })
      } else {
        onBpmCommandConsumed?.({ switchToOntology: false })
      }
      return
    }
    const currentStages = stagesRef.current
    const d = new Date()
    const baseTask = {
      executor: PERSONNEL[0],
      approver: PERSONNEL[1] || PERSONNEL[0],
      deadline: d,
      status: 'в работе',
      date: new Date().toLocaleDateString('ru-RU'),
      entries: [{ system: '', input: '', output: '' }],
      scheduleEvery: 'каждые 2 дня',
      periodStart: d,
      periodEnd: d,
    }
    if (scenarioId === 'createPlanningCase') {
      const topic = bpmCommand.params?.topic || 'планирование'
      const customSteps = bpmCommand.params?.steps
      const stagesList = [...DEFAULT_CREATE_STAGES]
      const rawNames = Array.isArray(customSteps) && customSteps.length > 0
        ? ['Кейс: ' + topic, ...customSteps]
        : [
            'Кейс: ' + topic,
            'Оценка объёмов', 'Планирование сроков', 'Назначение исполнителей', 'Согласование',
            'Контроль выполнения', 'Отчётность', 'Корректировка плана', 'Итоговая приёмка',
          ]
      const cardNames = [...new Set(rawNames)].slice(0, 8)
      const cardDelayMs = 400
      setAiCaseStageNames(new Set(stagesList))
      setStages(stagesList)
      const initialTasks = {}
      stagesList.forEach((s) => { initialTasks[s] = [] })
      setTasks(initialTasks)
      const idsToMark = new Set()
      cardNames.forEach((name, i) => {
        setTimeout(() => {
          setTasks((prev) => {
            const stage = stagesList[i % stagesList.length]
            const taskId = `AIC${10000 + i}`
            idsToMark.add(taskId)
            const task = { id: taskId, name, ...baseTask, inputFiles: generateInputFiles(taskId), resultFiles: generateResultFiles(taskId) }
            return { ...prev, [stage]: [task, ...(prev[stage] || [])] }
          })
          if (i === cardNames.length - 1) {
            setAiCaseCardIds(new Set(idsToMark))
            const fullTasks = {}
            stagesList.forEach((s) => { fullTasks[s] = [] })
            cardNames.forEach((nm, j) => {
              const st = stagesList[j % stagesList.length]
              const tid = `AIC${10000 + j}`
              fullTasks[st].unshift({ id: tid, name: nm, ...baseTask, inputFiles: generateInputFiles(tid), resultFiles: generateResultFiles(tid) })
            })
            onBpmCommandConsumed?.({ flowCode: bpmToMermaid(stagesList, fullTasks) })
          }
        }, i * cardDelayMs)
      })
      if (cardNames.length === 0) { setAiCaseCardIds(new Set()); onBpmCommandConsumed?.({ flowCode: bpmToMermaid(stagesList, {}) }) }
    }
    if (scenarioId === 'analyzeRisks') {
      setStages((s) => (s.includes('Риски') ? s : ['Риски', ...s]))
      setTasks((t) => {
        const riskStage = 'Риски'
        const list = t[riskStage] || []
        const riskCards = [
          { name: 'Идентификация рисков', id: 'RISK1' },
          { name: 'Оценка вероятности и влияния', id: 'RISK2' },
          { name: 'Матрица рисков', id: 'RISK3' },
          { name: 'План реагирования на риски', id: 'RISK4' },
        ]
        const toAdd = riskCards.filter((c) => !list.some((x) => x.id === c.id))
        const newList = [
          ...toAdd.map((c) => ({
            id: c.id,
            name: c.name,
            ...baseTask,
            inputFiles: generateInputFiles(c.id),
            resultFiles: generateResultFiles(c.id),
          })),
          ...list,
        ]
        return { ...t, [riskStage]: newList }
      })
      onBpmCommandConsumed()
      return
    }
    if (scenarioId === 'generateCashflow') {
      setStages((s) => (s.includes('Финансы') ? s : ['Финансы', ...s]))
      setTasks((t) => {
        const finStage = 'Финансы'
        const list = t[finStage] || []
        const finCards = [
          { name: 'Денежные потоки (Cashflow)', id: 'CF1' },
          { name: 'Прогноз выручки', id: 'CF2' },
          { name: 'Расчёт NPV', id: 'CF3' },
        ]
        const toAdd = finCards.filter((c) => !list.some((x) => x.id === c.id))
        const newList = [
          ...toAdd.map((c) => ({
            id: c.id,
            name: c.name,
            ...baseTask,
            inputFiles: generateInputFiles(c.id),
            resultFiles: generateResultFiles(c.id),
          })),
          ...list,
        ]
        return { ...t, [finStage]: newList }
      })
      onBpmCommandConsumed()
      return
    }
    if (scenarioId === 'appendPlanningCard') {
      const topic = bpmCommand.params?.topic || 'Доп. шаг'
      const firstStage = currentStages[0] || 'Подготовка'
      const id = `AIC${10000 + Date.now() % 99999}`
      const task = { id, name: topic, ...baseTask, inputFiles: generateInputFiles(id), resultFiles: generateResultFiles(id) }
      setTasks((prev) => ({ ...prev, [firstStage]: [task, ...(prev[firstStage] || [])] }))
      if (typeof onBpmCommandConsumed === 'function') onBpmCommandConsumed({ switchToOntology: false })
      return
    }
    if (scenarioId === 'addPlanningStage') {
      const stageName = bpmCommand.params?.name || 'Новая стадия'
      if (!currentStages.includes(stageName)) {
        setStages((prev) => [...prev, stageName])
        setTasks((prev) => ({ ...prev, [stageName]: [] }))
      }
      if (typeof onBpmCommandConsumed === 'function') onBpmCommandConsumed({ switchToOntology: false })
      return
    }
  }, [bpmCommand, onBpmCommandConsumed])

  useEffect(() => {
    if (typeof onBoardChange === 'function') {
      onBoardChange(stages, tasks, connections)
    }
  }, [stages, tasks, connections, onBoardChange])

  const toggleExpanded = useCallback((key) => {
    setExpanded((e) => ({ ...e, [key]: !e[key] }))
  }, [])

  const toggleSection = useCallback((taskId, section) => {
    setExpandedSections((prev) => {
      const cur = prev[taskId] || { systems: false, input: false, results: false }
      const next = { ...cur, [section]: !cur[section] }
      return { ...prev, [taskId]: next }
    })
  }, [])

  const getSectionOpen = useCallback((taskId, section) => {
    const cur = expandedSections[taskId]
    if (!cur) return false
    return cur[section] === true
  }, [expandedSections])

  const handleDownloadBoard = useCallback(() => {
    const buf = generateBoardExcel(stages, tasks, connections)
    downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'tasks_board.xlsx')
  }, [stages, tasks, connections])

  const handleDownloadTemplate = useCallback(() => {
    const buf = generateTemplateExcel()
    downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'template.xlsx')
  }, [])

  const handleDownloadOilFlow = useCallback(() => {
    const html = generateOilFlowHtml(stages, tasks)
    downloadBlob(new Blob([html], { type: 'text/html' }), 'oilflow_graph.html')
  }, [stages, tasks])

  const handleOntology = useCallback(() => {
    const { nodes, edges } = buildGraph(stages, tasks)
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="padding:20px;font-family:sans-serif"><h2>Анализ графа</h2><p>Узлов: ${nodes.length}</p><p>Связей: ${edges.length}</p></body></html>`
    downloadBlob(new Blob([html], { type: 'text/html' }), 'ontology.html')
    const buf = generateOntologyExcel(edges)
    downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'граф_анализ.xlsx')
  }, [stages, tasks])

  const addStage = useCallback(() => {
    setStages((s) => {
      const name = nextUniqueStageName(s, 'Новый этап')
      setTasks((t) => (t[name] ? t : ({ ...t, [name]: [] })))
      setEditingStage(0)
      setStageNameEdit(name)
      return [name, ...s]
    })
  }, [])

  const handleDropAt = useCallback((targetStage, insertBeforeIndex) => {
    if (!dragged) return
    const { stageName: fromStage, taskIdx } = dragged
    const list = tasks[fromStage] || []
    const task = list[taskIdx]
    if (!task) { setDragged(null); return }
    setTasks((t) => {
      const next = { ...t }
      if (fromStage === targetStage) {
        const newList = [...(next[fromStage] || [])]
        newList.splice(taskIdx, 1)
        const insertAt = taskIdx < insertBeforeIndex ? insertBeforeIndex - 1 : insertBeforeIndex
        newList.splice(Math.max(0, Math.min(insertAt, newList.length)), 0, task)
        next[fromStage] = newList
      } else {
        next[fromStage] = list.filter((_, i) => i !== taskIdx)
        const targetList = [...(next[targetStage] || [])]
        targetList.splice(Math.min(insertBeforeIndex, targetList.length), 0, task)
        next[targetStage] = targetList
      }
      return next
    })
    setDragged(null)
  }, [dragged, tasks])

  const saveStageEdit = useCallback(() => {
    if (editingStage == null) return
    const newName = stageNameEdit.trim() || stages[editingStage]
    if (newName !== stages[editingStage]) {
      const old = stages[editingStage]
      setStages((s) => s.map((x, i) => (i === editingStage ? newName : x)))
      setTasks((t) => {
        const next = { ...t }
        next[newName] = next[old] || []
        delete next[old]
        return next
      })
    }
    setEditingStage(null)
  }, [editingStage, stageNameEdit, stages])

  const deleteStage = useCallback((idx) => {
    const name = stages[idx]
    setStages((s) => s.filter((_, i) => i !== idx))
    setTasks((t) => {
      const next = { ...t }
      delete next[name]
      return next
    })
    setEditingStage(null)
  }, [stages])

  const moveStage = useCallback((idx, dir) => {
    if (dir < 0 && idx <= 0) return
    if (dir > 0 && idx >= stages.length - 1) return
    const next = [...stages]
    const j = idx + dir
    ;[next[idx], next[j]] = [next[j], next[idx]]
    setStages(next)
  }, [stages])

  const reorderStages = useCallback((fromIdx, toIdx) => {
    if (fromIdx === toIdx) return
    const next = [...stages]
    const [removed] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, removed)
    const newTasks = {}
    next.forEach((s) => { newTasks[s] = tasks[s] || [] })
    setStages(next)
    setTasks(newTasks)
    setDraggedStageIndex(null)
  }, [stages, tasks])

  const handleStageDragStart = useCallback((e, stageIdx, stageName) => {
    setDraggedStageIndex(stageIdx)
    e.dataTransfer.setData('text/plain', String(stageIdx))
    e.dataTransfer.effectAllowed = 'move'
    const count = (tasks[stageName] || []).length
    const el = document.createElement('div')
    el.className = 'bpm-stage-column bpm-stage-column-drag-preview'
    el.innerHTML = `<div class="bpm-stage-header"><span class="bpm-stage-title">${stageName}</span></div><div class="bpm-stage-cards">${count} карточек</div>`
    el.style.position = 'absolute'
    el.style.top = '-9999px'
    el.style.left = '0'
    el.style.width = '220px'
    el.style.pointerEvents = 'none'
    document.body.appendChild(el)
    e.dataTransfer.setDragImage(el, 110, 24)
    setTimeout(() => document.body.removeChild(el), 0)
  }, [tasks])

  const handleStageDrop = useCallback((e, dropIdx) => {
    e.preventDefault()
    const fromIdx = draggedStageIndex
    if (fromIdx == null) return
    reorderStages(fromIdx, dropIdx)
  }, [draggedStageIndex, reorderStages])

  const addTask = useCallback((stageName) => {
    const id = `M${15000 + Math.floor(Math.random() * 85000)}`
    const d = new Date()
    const task = {
      id,
      name: 'Новая задача',
      executor: '',
      approver: '',
      deadline: d,
      status: 'в работе',
      date: new Date().toLocaleDateString('ru-RU'),
      entries: [{ system: '', input: '', output: '' }],
      scheduleEvery: 'каждые 2 дня',
      periodStart: d,
      periodEnd: d,
      inputFiles: generateInputFiles(id),
      resultFiles: generateResultFiles(id),
    }
    setTasks((t) => ({ ...t, [stageName]: [task, ...(t[stageName] || [])] }))
  }, [])

  const saveTaskEdit = useCallback((stageName, taskIdx, form) => {
    setTasks((t) => {
      const list = [...(t[stageName] || [])]
      list[taskIdx] = { ...list[taskIdx], ...form }
      return { ...t, [stageName]: list }
    })
    setEditingTask(null)
  }, [])

  const deleteTask = useCallback((stageName, taskIdx) => {
    setTasks((t) => ({
      ...t,
      [stageName]: (t[stageName] || []).filter((_, i) => i !== taskIdx),
    }))
    setEditingTask(null)
  }, [])

  const handleDragStart = useCallback((e, stageName, taskIdx) => {
    setDragged({ stageName, taskIdx })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', JSON.stringify({ stageName, taskIdx }))
  }, [])


  const iterations = useMemo(() => {
    if (stages.length < 2) return []
    const n = stages.length
    return [
      { iconEye: 'eye', iconAction: 'dash', color: 'rgb(253, 232, 204)', label: '2 итерации', startStage: 0, endStage: n, leftPct: '0%', widthPct: '100%' },
      { iconEye: 'eye-slash', iconAction: 'refresh', color: 'rgb(221, 241, 252)', label: '3 итерации', startStage: 1, endStage: Math.min(4, n), leftPct: `${(1 / n) * 100}%`, widthPct: `${(Math.min(3, n - 1) / n) * 100}%` },
      { iconEye: 'eye-slash', iconAction: 'dots', color: 'rgb(211, 243, 232)', label: '2 итерации', startStage: 0, endStage: n, leftPct: '0%', widthPct: '100%' },
    ]
  }, [stages.length])

  const analytics = useMemo(() => computeAnalytics(stages, tasks), [stages, tasks])
  const oilFlowHtml = useMemo(() => generateOilFlowHtml(stages, tasks), [stages, tasks])

  const handleStageDropWithAi = useCallback((stageName, displayIndex, e, taskIndexForDropAt) => {
    e.preventDefault()
    e.stopPropagation()
    let cardKey = null
    let fromIndex = null
    let fromStage = null
    const raw = e.dataTransfer.getData('text/plain')
    try {
      const d = JSON.parse(raw)
      if (d != null && typeof d.aiCardKey === 'number') cardKey = d.aiCardKey
    } catch (_) {}
    if (cardKey == null && draggedAiCardRef.current) {
      cardKey = draggedAiCardRef.current.cardKey
      fromIndex = draggedAiCardRef.current.fromIndex
      fromStage = draggedAiCardRef.current.stageName
    }
    if (cardKey != null) {
      setAiSuggestionCardPlacements((prev) => {
        const prevList = prev || []
        const sameStage = fromStage === stageName
        const targetHere = prevList.filter((p) => p.stageName === stageName).sort((a, b) => a.index - b.index)
        const targetOrder = targetHere.map((h) => h.cardKey)
        const targetNewOrder = targetOrder.filter((k) => k !== cardKey)
        targetNewOrder.splice(Math.min(displayIndex, targetNewOrder.length), 0, cardKey)
        const targetNewIndices = {}
        targetNewOrder.forEach((k, i) => { targetNewIndices[k] = i })
        let sourceNewIndices = null
        if (!sameStage && fromStage != null) {
          const sourceHere = prevList.filter((p) => p.stageName === fromStage).sort((a, b) => a.index - b.index)
          const sourceNewOrder = sourceHere.map((h) => h.cardKey).filter((k) => k !== cardKey)
          sourceNewIndices = {}
          sourceNewOrder.forEach((k, i) => { sourceNewIndices[k] = i })
        }
        return prevList.map((p) => {
          if (p.cardKey === cardKey) return { ...p, stageName, index: targetNewIndices[cardKey] ?? displayIndex }
          if (p.stageName === stageName) return { ...p, index: targetNewIndices[p.cardKey] ?? p.index }
          if (sourceNewIndices && p.stageName === fromStage) return { ...p, index: sourceNewIndices[p.cardKey] ?? p.index }
          return p
        })
      })
      draggedAiCardRef.current = null
      return
    }
    handleDropAt(stageName, taskIndexForDropAt != null ? taskIndexForDropAt : displayIndex)
  }, [handleDropAt])

  const getStageDisplayItems = useCallback((stageName) => {
    const list = tasks[stageName] || []
    const placements = aiSuggestionCardPlacements || []
    const here = placements.filter((p) => p.stageName === stageName).sort((a, b) => a.index - b.index)
    if (!here.length) return list.map((task, i) => ({ type: 'task', task, taskIdx: i }))
    const items = []
    let tIdx = 0
    for (let pos = 0; pos < list.length + here.length; pos++) {
      const ac = here.find((h) => h.index === pos)
      if (ac != null) items.push({ type: 'ai', cardKey: ac.cardKey })
      else {
        if (tIdx < list.length && list[tIdx] != null) items.push({ type: 'task', task: list[tIdx], taskIdx: tIdx })
        tIdx++
      }
    }
    return items
  }, [tasks, aiSuggestionCardPlacements])

  const matchesSearch = useCallback((task, q) => {
    if (!q || !String(q).trim()) return true
    const lower = String(q).toLowerCase().trim()
    const str = (t) => (t != null ? String(t).toLowerCase() : '')
    if (str(task.name).includes(lower)) return true
    if (str(task.id).includes(lower)) return true
    if (str(task.executor).includes(lower)) return true
    if (str(task.approver).includes(lower)) return true
    if (str(task.status).includes(lower)) return true
    if ((task.entries || []).some((e) => str(e.system).includes(lower))) return true
    return false
  }, [])

  const updateConnectionLines = useCallback(() => {
    if (!boardRef.current || !connections.length) {
      setConnectionLines((prev) => (prev.length ? [] : prev))
      return
    }
    const el = boardRef.current
    const boardRect = el.getBoundingClientRect()
    const cards = el.querySelectorAll('.bpm-card[data-connection-stage][data-connection-id]')
    const posMap = new Map()
    cards.forEach((card) => {
      const stage = card.getAttribute('data-connection-stage')
      const id = card.getAttribute('data-connection-id')
      if (!stage || !id) return
      const r = card.getBoundingClientRect()
      posMap.set(`${stage}\t${id}`, { x: r.left - boardRect.left + r.width / 2, y: r.top - boardRect.top + r.height / 2 })
    })
    const lines = connections
      .map((c) => {
        const from = posMap.get(`${c.fromStage}\t${c.fromId}`)
        const to = posMap.get(`${c.toStage}\t${c.toId}`)
        if (!from || !to) return null
        return { x1: from.x, y1: from.y, x2: to.x, y2: to.y }
      })
      .filter(Boolean)
    setConnectionLines(lines)
  }, [connections])

  useEffect(() => {
    if (!connectionsMode) {
      setConnectionLines([])
      return
    }
    updateConnectionLines()
    const el = boardRef.current
    if (!el) return
    const onScrollOrResize = () => updateConnectionLines()
    el.addEventListener('scroll', onScrollOrResize)
    const ro = new ResizeObserver(onScrollOrResize)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', onScrollOrResize); ro.disconnect() }
  }, [connectionsMode, connections, updateConnectionLines])

  useEffect(() => {
    if (!dragged) return
    let raf = null
    const onDragOver = (e) => {
      if (!e.clientY) return
      const threshold = 100
      if (e.clientY > window.innerHeight - threshold) {
        raf = requestAnimationFrame(() => {
          const scrollEl = document.querySelector('.app-main') || document.scrollingElement
          if (scrollEl) scrollEl.scrollTop = Math.min(scrollEl.scrollHeight, scrollEl.scrollTop + 20)
        })
      }
    }
    document.addEventListener('dragover', onDragOver)
    return () => { document.removeEventListener('dragover', onDragOver); if (raf) cancelAnimationFrame(raf) }
  }, [dragged])

  const filteredTasksByStage = useMemo(() => {
    const out = {}
    const q = (searchQuery || '').trim().toLowerCase()
    const statusNorm = (statusFilter || '').trim().toLowerCase()
    const execNorm = (executorFilter || '').trim()
    const apprNorm = (approverFilter || '').trim()
    const periodStart = periodStartFilter ? new Date(periodStartFilter) : null
    const periodEnd = periodEndFilter ? new Date(periodEndFilter) : null
    stages.forEach((stageName) => {
      let list = tasks[stageName] || []
      if (statusNorm) list = list.filter((t) => (t.status || '').toLowerCase() === statusNorm)
      if (execNorm) list = list.filter((t) => (t.executor || '').trim() === execNorm)
      if (apprNorm) list = list.filter((t) => (t.approver || '').trim() === apprNorm)
      if (periodStart || periodEnd) {
        list = list.filter((t) => {
          const start = t.periodStart instanceof Date ? t.periodStart : (t.periodStart ? new Date(t.periodStart) : null)
          const end = t.periodEnd instanceof Date ? t.periodEnd : (t.periodEnd ? new Date(t.periodEnd) : null)
          const d = start || end || (t.deadline ? new Date(t.deadline) : null)
          if (!d) return false
          if (periodStart && d < periodStart) return false
          if (periodEnd && d > periodEnd) return false
          return true
        })
      }
      if (q) list = list.filter((t) => matchesSearch(t, searchQuery))
      out[stageName] = list
    })
    return out
  }, [stages, tasks, searchQuery, statusFilter, executorFilter, approverFilter, periodStartFilter, periodEndFilter, matchesSearch])

  if (showCalculateView) {
    return (
      <div className="bpm-board-wrap">
        <CalculateGraph stages={stages} tasks={tasks} analytics={analytics} onBack={() => setShowCalculateView(false)} />
      </div>
    )
  }

  return (
    <div className="bpm-board-wrap">
      <div className="bpm-board-scroll-area">
        <div className="bpm-board-container" style={{ minWidth: `max(${stages.length * 220}px, min-content)` }}>
          <div className="bpm-board-top-in-scroll">
            <div className="bpm-board-header">
              <div className="bpm-header-left">
                {onClose && (
                  <button type="button" className="bpm-btn-icon bpm-btn-back" onClick={onClose} title="Назад">
                    <span className="bpm-icon-arrow-left" />
                  </button>
                )}
                <h2>{scenarioName}{selectedAssetName ? ` — ${selectedAssetName}` : ''}</h2>
              </div>
              <div className="bpm-header-actions">
                <button type="button" className="bpm-btn" onClick={handleDownloadBoard}>Выгрузить доску</button>
                <button type="button" className="bpm-btn" onClick={handleDownloadTemplate}>Шаблон</button>
                <button type="button" className="bpm-board-close" onClick={onClose}>Закрыть</button>
              </div>
            </div>
            <div className="bpm-board-header-divider" />
            <div className="bpm-toolbar-row">
              <button type="button" className="bpm-btn bpm-btn-ghost bpm-toolbar-add-stage" onClick={addStage} title="Добавить этап (колонку) слева на доске">
                + Этап
              </button>
              <input
                type="text"
                className="bpm-search"
                placeholder="Поиск по доске..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="button" className="bpm-btn bpm-btn-filters" onClick={() => setShowFilters(!showFilters)}>
                <span className="bpm-icon-filter" /><span>{showFilters ? 'Скрыть фильтры' : 'Фильтры'}</span>
              </button>
              {showFilters && (
                <div className="bpm-filters-panel">
                  <label className="bpm-filter-label">
                    Статус:
                    <select className="bpm-select bpm-select-inline" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                      <option value="">Все</option>
                      {['в работе', 'завершен', 'ошибка', 'пауза'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label className="bpm-filter-label">
                    Исполнитель:
                    <select className="bpm-select bpm-select-inline" value={executorFilter} onChange={(e) => setExecutorFilter(e.target.value)}>
                      <option value="">Все</option>
                      {PERSONNEL.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  <label className="bpm-filter-label">
                    Согласующий:
                    <select className="bpm-select bpm-select-inline" value={approverFilter} onChange={(e) => setApproverFilter(e.target.value)}>
                      <option value="">Все</option>
                      {PERSONNEL.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  <label className="bpm-filter-label">
                    Период с:
                    <input type="date" className="bpm-input-date" value={periodStartFilter} onChange={(e) => setPeriodStartFilter(e.target.value)} />
                  </label>
                  <label className="bpm-filter-label">
                    по:
                    <input type="date" className="bpm-input-date" value={periodEndFilter} onChange={(e) => setPeriodEndFilter(e.target.value)} />
                  </label>
                </div>
              )}
              <div className="bpm-view-toggle" role="group" aria-label="Вид">
                <span className={`bpm-toggle-label ${viewMode === 'Упрощенный вид' ? 'active' : ''}`} onClick={() => setViewMode('Упрощенный вид')}>Упрощенный</span>
                <span className="bpm-toggle-switch" onClick={() => setViewMode((m) => m === 'Упрощенный вид' ? 'Подробный вид' : 'Упрощенный вид')} role="switch" aria-checked={viewMode === 'Подробный вид'}>
                  <span className="bpm-toggle-switch-thumb" />
                </span>
                <span className={`bpm-toggle-label ${viewMode === 'Подробный вид' ? 'active' : ''}`} onClick={() => setViewMode('Подробный вид')}>Подробный</span>
              </div>
              <button type="button" className={`bpm-btn bpm-btn-ghost bpm-ai-autosvyazi-inline bpm-ai-suggestions-btn ${aiSuggestionsOn ? 'bpm-ai-suggestions-btn-on' : ''}`} onClick={() => { setAiSuggestionsOn((on) => !on); if (!aiSuggestionsOn) { setAgreedAiCardIds(new Set()); setRemovedAiCardIds(new Set()); setAiStageAgreed(false); setAiStage2Agreed(false); } }} title={aiSuggestionsOn ? 'Выключить ИИ-автопредложения' : 'Включить ИИ-автопредложения'}>ИИ-автопредложения</button>
              <button type="button" className="bpm-btn bpm-btn-primary" onClick={() => setShowCalculateView(true)} style={{ marginLeft: 'auto' }}>Рассчитать</button>
            </div>
          </div>
          <div className="bpm-toolbar-top-panel-divider-wrap">
            <div className="bpm-board-header-divider" />
            <div className="bpm-top-panel bpm-top-panel-compact bpm-top-panel-in-scroll" style={{ '--stages': stages.length }}>
            <div className="bpm-top-panel-row">
              <span className="bpm-top-panel-title">Взаимосвязи этапов</span>
              <button type="button" className="bpm-btn bpm-btn-ghost bpm-ai-autosvyazi-inline" onClick={() => setAiModalOpen(true)}>ИИ-автовзаимосвязи</button>
              <button type="button" className="bpm-top-panel-create-link" onClick={() => setConnectionsMode(true)}>+ Создать связь</button>
              <button type="button" className="bpm-btn bpm-btn-ghost bpm-top-panel-chevron" onClick={() => setConnectionsMode(!connectionsMode)} aria-label={connectionsMode ? 'Свернуть' : 'Развернуть'}>
                <span className={`bpm-card-collapse-arrow ${connectionsMode ? 'bpm-card-collapse-arrow-up' : 'bpm-card-collapse-arrow-down'}`} />
              </button>
            </div>
            {connectionsMode && iterations.length > 0 && (
              <div className="bpm-top-panel-iterations">
                <div className="bpm-top-panel-iterations-grid">
                  {iterations.map((it, i) => (
                    <div key={i} className="bpm-top-panel-iteration-row">
                      <button type="button" className="bpm-iter-icon-btn" title={it.iconEye === 'eye' ? 'Показать' : 'Скрыто'} aria-label={it.iconEye === 'eye' ? 'Показать' : 'Скрыто'}>
                        <span className={`bpm-iter-icon bpm-iter-icon-${it.iconEye}`} aria-hidden />
                      </button>
                      <button type="button" className="bpm-iter-icon-btn" title="Настройки" aria-label="Настройки">
                        <span className="bpm-iter-icon bpm-iter-icon-gear" aria-hidden />
                      </button>
                      <span className={`bpm-iter-icon bpm-iter-icon-${it.iconAction}`} title="" aria-hidden />
                      <div className="bpm-top-panel-iteration-bar-wrap">
                        <div className="bpm-top-panel-iteration" style={{ left: it.leftPct, width: it.widthPct, background: it.color }} title={it.label}>
                          <span className="bpm-top-panel-iteration-label">{it.label}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bpm-top-panel-stage-dividers" style={{ '--stages': stages.length }}>
                  {stages.slice(0, -1).map((_, i) => (
                    <div key={i} className="bpm-top-panel-stage-divider" style={{ left: `${((i + 1) / stages.length) * 100}%` }} />
                  ))}
                </div>
              </div>
            )}
            </div>
          </div>
          <div className="bpm-board-row">
          <div className="bpm-add-stage-vertical-wrap">
            <button type="button" className="bpm-add-stage-vertical" onClick={addStage} title="Добавить этап">
              + Добавить этап
            </button>
          </div>
      <div
        className={`bpm-board ${animateAiBoardReveal ? 'bpm-board--ai-reveal' : ''} ${aiRevealDone ? 'bpm-board--ai-reveal-done' : ''}`}
        ref={boardRef}
        onDragOver={(e) => e.preventDefault()}
        aria-busy={animateAiBoardReveal && !aiRevealDone}
      >
        {connectionsMode && connectionLines.length > 0 && (
          <div className="bpm-connections-overlay" aria-hidden>
            <svg className="bpm-connections-svg" width="100%" height="100%">
              {connectionLines.map((line, i) => (
                <line key={i} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="#F7BDBF" strokeWidth="2" strokeDasharray="4 2" />
              ))}
            </svg>
          </div>
        )}
        {stages.map((stageName, stageIdx) => (
          <React.Fragment key={stageName}>
          <div
            className={`bpm-stage-column ${(stageName === AI_STAGE_NAME || stageName === AI_STAGE_NAME_2) ? 'bpm-stage-ai-suggestion' : ''} ${aiCaseStageNames.has(stageName) ? 'bpm-stage-ai-suggestion' : ''} ${stageName === AI_STAGE_NAME && aiStageAgreed ? 'bpm-stage-column-agreed' : ''} ${stageName === AI_STAGE_NAME_2 && aiStage2Agreed ? 'bpm-stage-column-agreed' : ''} ${draggedStageIndex === stageIdx ? 'bpm-stage-column-dragging' : ''}`}
            style={animateAiBoardReveal ? { '--bpm-stage-reveal-delay': `${stageIdx * 125}ms` } : undefined}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
            onDrop={(e) => { e.preventDefault(); if (draggedStageIndex != null) handleStageDrop(e, stageIdx); else handleStageDropWithAi(stageName, (tasks[stageName] || []).length, e); }}
          >
            {(stageName === AI_STAGE_NAME || stageName === AI_STAGE_NAME_2) ? (
              stageName === AI_STAGE_NAME ? (
              <>
                <div className={`bpm-stage-header bpm-stage-header-ai ${aiStageAgreed ? 'bpm-stage-agreed' : ''}`} draggable onDragStart={(e) => handleStageDragStart(e, stageIdx, AI_STAGE_NAME)} onDragEnd={() => setDraggedStageIndex(null)}>
                  <span className="bpm-stage-title bpm-stage-title-clickable">ИИ-АВТОПРЕДЛОЖЕННЫЙ ЭТАП</span>
                  <span className="bpm-card-badge bpm-card-badge-in-work bpm-card-ai-agree-badge bpm-stage-agree-badge" onClick={(e) => { e.stopPropagation(); setAiStageAgreed((v) => !v); }} role="button" tabIndex={0} title="Согласовать">{aiStageAgreed ? 'СОГЛАСОВАНО' : 'СОГЛАСОВАТЬ'}</span>
                  <div className="bpm-stage-btns">
                    <button type="button" className="bpm-card-delete bpm-stage-delete" onClick={(e) => { e.stopPropagation(); setStages((prev) => prev.filter((s) => s !== AI_STAGE_NAME)); }} title="Удалить этап" aria-label="Удалить этап">🗑</button>
                  </div>
                </div>
                <button type="button" className="bpm-add-task bpm-add-task-top" onClick={() => addTask(AI_STAGE_NAME)}>+ Добавить задачу</button>
                <div className="bpm-stage-cards">
                  <div className="bpm-drop-zone bpm-drop-zone-first" onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropAt(AI_STAGE_NAME, 0); }} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.stopPropagation(); }} />
                  {((tasks[AI_STAGE_NAME] || []).map((task, taskIdx) => {
                    if (task.isAiStatic) {
                      const ad = aiCardsData[task.aiCardDataIndex]
                      if (!ad || removedAiCardIds.has(task.id)) return null
                      const aiId = task.id
                      const aiSystems = getAiCardSystems(aiId)
                      const aiInputs = getAiCardInputFiles(aiId)
                      const aiResults = getResultLinesForCard('ИИ-автопредложенная карточка', aiId)
                      const agreed = agreedAiCardIds.has(aiId)
                      return (
                        <React.Fragment key={aiId}>
                          <div className="bpm-drop-zone bpm-drop-zone-inline" onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropAt(AI_STAGE_NAME, taskIdx); }} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.stopPropagation(); }} />
                          <div className={`bpm-card bpm-card-ai-suggestion ${agreed ? 'bpm-card-ai-agreed' : ''}`} style={bpmCardRevealStyle(animateAiBoardReveal, stageIdx, taskIdx)} draggable onDragStart={(e) => handleDragStart(e, AI_STAGE_NAME, taskIdx)} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropAt(AI_STAGE_NAME, taskIdx); }} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.stopPropagation(); }}>
                            <div className="bpm-card-top-row">
                              <span className="bpm-card-id">{aiId}</span>
                              <span className="bpm-card-badge bpm-card-badge-in-work">ИИ</span>
                              <span className="bpm-card-badge bpm-card-badge-in-work bpm-card-ai-agree-badge" onClick={(e) => { e.stopPropagation(); toggleAgreedAiCard(aiId); }} role="button" tabIndex={0} title="Согласовать">{agreed ? 'Согласовано' : 'СОГЛАСОВАТЬ'}</span>
                              <button type="button" className="bpm-card-delete" onClick={(e) => { e.stopPropagation(); removeAiCard(aiId); }} title="Удалить карточку" aria-label="Удалить карточку">🗑</button>
                            </div>
                            <div className="bpm-card-name">ИИ-автопредложенная карточка</div>
                            <div className="bpm-card-meta">
                              <div className="bpm-card-meta-row">
                                <span className="bpm-card-meta-label">Исполнитель:</span>
                                {/сюндюков/i.test(ad.executor || '') ? (
                                  <img src={`${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/sanya-bodibilder.png`} alt="" className="bpm-card-avatar bpm-card-avatar-img" title={ad.executor} />
                                ) : (
                                  <span className="bpm-card-avatar bpm-card-avatar-executor" style={{ background: avatarColor(ad.executor) }} title={ad.executor}>{getInitials(ad.executor).slice(0, 1)}</span>
                                )}
                                <span className="bpm-card-meta-value" onClick={() => setRightPanel({ type: 'executor', stageName: AI_STAGE_NAME, taskIdx, role: 'executor', aiCardId: aiId })}>{ad.executor}</span>
                              </div>
                              <div className="bpm-card-meta-row">
                                <span className="bpm-card-meta-label">Согласующий:</span>
                                {/сюндюков/i.test(ad.approver || '') ? (
                                  <img src={`${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/sanya-bodibilder.png`} alt="" className="bpm-card-avatar bpm-card-avatar-img" title={ad.approver} />
                                ) : (
                                  <span className="bpm-card-avatar bpm-card-avatar-approver" style={{ background: avatarColor(ad.approver) }} title={ad.approver}>{getInitials(ad.approver).slice(0, 1)}</span>
                                )}
                                <span className="bpm-card-meta-value" onClick={() => setRightPanel({ type: 'executor', stageName: AI_STAGE_NAME, taskIdx, role: 'approver', aiCardId: aiId })}>{ad.approver}</span>
                              </div>
                              <div className="bpm-card-meta-row bpm-card-schedule-row">
                                <span className="bpm-card-meta-label bpm-card-meta-label-wrap">График<br />выполнения:</span>
                                <select className="bpm-select-inline bpm-select-tiny" defaultValue="каждые 2 дня" onClick={(e) => e.stopPropagation()}>
                                  {SCHEDULE_EVERY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                              </div>
                              <div className="bpm-card-meta-row bpm-card-period-row">
                                <span className="bpm-card-meta-label">Период выполнения:</span>
                                <div className="bpm-card-period-inputs">
                                  <input type="date" className="bpm-input-date" defaultValue={ad.periodStart} onClick={(e) => e.stopPropagation()} />
                                  <span className="bpm-card-period-sep">—</span>
                                  <input type="date" className="bpm-input-date" defaultValue={ad.periodEnd} onClick={(e) => e.stopPropagation()} />
                                </div>
                              </div>
                            </div>
                            <div className="bpm-card-body">
                              <div className="bpm-card-section-block">
                                <div role="button" tabIndex={0} className="bpm-card-section-header" onClick={() => toggleSection(aiId, 'systems')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(aiId, 'systems'); } }}>
                                  <span className={`bpm-card-collapse-arrow bpm-card-section-chevron ${getSectionOpen(aiId, 'systems') ? 'bpm-card-collapse-arrow-up' : 'bpm-card-collapse-arrow-down'}`} />
                                  <span className="bpm-card-section-title">Используемые системы</span>
                                  <span role="button" tabIndex={0} className="bpm-btn-icon bpm-add-system-btn bpm-add-system-inline" onClick={(e) => e.stopPropagation()} title="Добавить систему" aria-label="Добавить систему">+</span>
                                </div>
                                {getSectionOpen(aiId, 'systems') && (
                                  <ul className="bpm-card-systems-list">
                                    {aiSystems.map((s, i) => (
                                      <li key={i} className="bpm-card-system-item">
                                        <a href={`${typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''}#/service/${encodeURIComponent(s)}`} target="_blank" rel="noopener noreferrer" className="bpm-card-system-link"><span className="bpm-card-system-link-text">{s}</span><span className="bpm-icon-open-in-new" aria-hidden /></a>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              <div className="bpm-card-divider" />
                              <div className="bpm-card-section-block">
                                <div role="button" tabIndex={0} className="bpm-card-section-header" onClick={() => toggleSection(aiId, 'input')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(aiId, 'input'); } }}>
                                  <span className={`bpm-card-collapse-arrow bpm-card-section-chevron ${getSectionOpen(aiId, 'input') ? 'bpm-card-collapse-arrow-up' : 'bpm-card-collapse-arrow-down'}`} />
                                  <span className="bpm-card-section-title">Входные данные</span>
                                  <span role="button" tabIndex={0} className="bpm-icon-file-outline-btn" title="Загрузить в карточку" aria-label="Загрузить"><span className="bpm-icon-file-download" /></span>
                                  <span role="button" tabIndex={0} className="bpm-icon-file-outline-btn" title="Скачать" onClick={(e) => { e.stopPropagation(); e.preventDefault(); downloadInputListExcel(aiInputs); }} onKeyDown={(e) => e.key === 'Enter' && downloadInputListExcel(aiInputs)} aria-label="Скачать"><span className="bpm-icon-arrow-up" /></span>
                                </div>
                                {getSectionOpen(aiId, 'input') && (
                                  <div className="bpm-card-file-pills">
                                    {aiInputs.map((f, i) => (
                                      <div key={i} className="bpm-file-pill bpm-file-pill-minimal">
                                        <span className="bpm-icon-file-sm bpm-icon-file-ok" />
                                        <span className="bpm-file-pill-name">{f.name}</span>
                                        <span className="bpm-file-pill-date">{f.date}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="bpm-card-divider" />
                              <div className="bpm-card-section-block">
                                <div role="button" tabIndex={0} className="bpm-card-section-header" onClick={() => toggleSection(aiId, 'results')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(aiId, 'results'); } }}>
                                  <span className={`bpm-card-collapse-arrow bpm-card-section-chevron ${getSectionOpen(aiId, 'results') ? 'bpm-card-collapse-arrow-up' : 'bpm-card-collapse-arrow-down'}`} />
                                  <span className="bpm-card-section-title">Результаты расчета</span>
                                  <span role="button" tabIndex={0} className="bpm-icon-file-outline-btn" title="Загрузить в карточку" aria-label="Загрузить"><span className="bpm-icon-file-download" /></span>
                                  <span role="button" tabIndex={0} className="bpm-icon-file-outline-btn" title="Скачать" onClick={(e) => { e.stopPropagation(); e.preventDefault(); downloadResultListExcel([...aiResults, ...getSyntheticLabels(aiId)]); }} onKeyDown={(e) => e.key === 'Enter' && downloadResultListExcel([...aiResults, ...getSyntheticLabels(aiId)])} aria-label="Скачать"><span className="bpm-icon-arrow-up" /></span>
                                </div>
                                {getSectionOpen(aiId, 'results') && (
                                  <>
                                    {aiSuggestionsOn && (
                                      <button type="button" className="bpm-ai-dona-btn" onClick={(e) => { e.stopPropagation(); addSyntheticResult(aiId); }}>ИИ-донасыщение результатов расчета синтетикой</button>
                                    )}
                                    <div className="bpm-card-file-pills">
                                      {[...aiResults, ...getSyntheticLabels(aiId)].map((name, i) => {
                                        const dateStr = new Date(Date.now() - (hashStr(aiId + String(i)) % 30) * 86400000).toLocaleDateString('ru-RU')
                                        const status = ['ok', 'missing', 'warning'][hashStr(aiId + String(i)) % 3]
                                        const tooltip = { ok: 'Корректно', missing: 'Нехватка данных', warning: 'Пропуски данных' }[status]
                                        return (
                                          <div key={i} className="bpm-file-pill bpm-file-pill-minimal" title={tooltip}>
                                            <span className={`bpm-icon-file-sm bpm-icon-file-${status}`} />
                                            <span className="bpm-file-pill-name">{name}</span>
                                            <span className="bpm-file-pill-date">{dateStr}</span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      )
                    }
                    return (
                      <React.Fragment key={task.id}>
                        <div className="bpm-drop-zone bpm-drop-zone-inline" onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropAt(AI_STAGE_NAME, taskIdx); }} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.stopPropagation(); }} />
                        <div className="bpm-card" style={bpmCardRevealStyle(animateAiBoardReveal, stageIdx, taskIdx)} draggable onDragStart={(e) => handleDragStart(e, AI_STAGE_NAME, taskIdx)} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropAt(AI_STAGE_NAME, taskIdx); }} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.stopPropagation(); }}>
                          <div className="bpm-card-top-row">
                            <span className="bpm-card-id">№{task.id}</span>
                            <span className="bpm-card-badge bpm-card-badge-in-work">В РАБОТЕ</span>
                            <button type="button" className="bpm-card-delete" onClick={(ev) => { ev.stopPropagation(); deleteTask(AI_STAGE_NAME, taskIdx); }} title="Удалить карточку" aria-label="Удалить карточку">🗑</button>
                          </div>
                          <div className="bpm-card-name">{task.name || 'Новая задача'}</div>
                          <div className="bpm-card-meta">
                            <div className="bpm-card-meta-row">
                              <span className="bpm-card-meta-label">Исполнитель:</span>
                              <span className="bpm-card-meta-value" onClick={() => setRightPanel({ type: 'executor', stageName: AI_STAGE_NAME, taskIdx, role: 'executor' })}>{task.executor || '—'}</span>
                            </div>
                            <div className="bpm-card-meta-row">
                              <span className="bpm-card-meta-label">Согласующий:</span>
                              <span className="bpm-card-meta-value" onClick={() => setRightPanel({ type: 'executor', stageName: AI_STAGE_NAME, taskIdx, role: 'approver' })}>{task.approver || '—'}</span>
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    )
                  }))}
                  <div className="bpm-drop-zone bpm-drop-zone-bottom" onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropAt(AI_STAGE_NAME, (tasks[AI_STAGE_NAME] || []).length); }} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.stopPropagation(); }} />
                </div>
              </>
            ) : (
              <>
                <div className={`bpm-stage-header bpm-stage-header-ai ${aiStage2Agreed ? 'bpm-stage-agreed' : ''}`} draggable onDragStart={(e) => handleStageDragStart(e, stageIdx, AI_STAGE_NAME_2)} onDragEnd={() => setDraggedStageIndex(null)}>
                  <span className="bpm-stage-title bpm-stage-title-clickable">ИИ-АВТОПРЕДЛОЖЕННЫЙ ЭТАП 2</span>
                  <span className="bpm-card-badge bpm-card-badge-in-work bpm-card-ai-agree-badge bpm-stage-agree-badge" onClick={(e) => { e.stopPropagation(); setAiStage2Agreed((v) => !v); }} role="button" tabIndex={0} title="Согласовать">{aiStage2Agreed ? 'СОГЛАСОВАНО' : 'СОГЛАСОВАТЬ'}</span>
                  <div className="bpm-stage-btns">
                    <button type="button" className="bpm-card-delete bpm-stage-delete" onClick={(e) => { e.stopPropagation(); setStages((prev) => prev.filter((s) => s !== AI_STAGE_NAME_2)); }} title="Удалить этап" aria-label="Удалить этап">🗑</button>
                  </div>
                </div>
                <button type="button" className="bpm-add-task bpm-add-task-top" onClick={() => addTask(AI_STAGE_NAME_2)}>+ Добавить задачу</button>
                <div className="bpm-stage-cards">
                  <div className="bpm-drop-zone bpm-drop-zone-first" onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropAt(AI_STAGE_NAME_2, 0); }} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.stopPropagation(); }} />
                  {(tasks[AI_STAGE_NAME_2] || []).map((task, taskIdx) => {
                    if (task.isAiStatic) {
                      const ad = aiCardsData[task.aiCardDataIndex]
                      if (!ad || removedAiCardIds.has(task.id)) return null
                      const aiId = task.id
                      const aiSystems = getAiCardSystems(aiId)
                      const aiInputs = getAiCardInputFiles(aiId)
                      const aiResults = getResultLinesForCard('ИИ-автопредложенная карточка', aiId)
                      const agreed = agreedAiCardIds.has(aiId)
                      return (
                        <React.Fragment key={aiId}>
                          <div className="bpm-drop-zone bpm-drop-zone-inline" onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropAt(AI_STAGE_NAME_2, taskIdx); }} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.stopPropagation(); }} />
                          <div className={`bpm-card bpm-card-ai-suggestion ${agreed ? 'bpm-card-ai-agreed' : ''}`} style={bpmCardRevealStyle(animateAiBoardReveal, stageIdx, taskIdx)} draggable onDragStart={(e) => handleDragStart(e, AI_STAGE_NAME_2, taskIdx)} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropAt(AI_STAGE_NAME_2, taskIdx); }} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.stopPropagation(); }}>
                            <div className="bpm-card-top-row">
                              <span className="bpm-card-id">{aiId}</span>
                              <span className="bpm-card-badge bpm-card-badge-in-work">ИИ</span>
                              <span className="bpm-card-badge bpm-card-badge-in-work bpm-card-ai-agree-badge" onClick={(e) => { e.stopPropagation(); toggleAgreedAiCard(aiId); }} role="button" tabIndex={0} title="Согласовать">{agreed ? 'Согласовано' : 'СОГЛАСОВАТЬ'}</span>
                              <button type="button" className="bpm-card-delete" onClick={(e) => { e.stopPropagation(); removeAiCard(aiId); }} title="Удалить карточку" aria-label="Удалить карточку">🗑</button>
                            </div>
                            <div className="bpm-card-name">ИИ-автопредложенная карточка</div>
                            <div className="bpm-card-meta">
                              <div className="bpm-card-meta-row">
                                <span className="bpm-card-meta-label">Исполнитель:</span>
                                {/сюндюков/i.test(ad.executor || '') ? (
                                  <img src={`${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/sanya-bodibilder.png`} alt="" className="bpm-card-avatar bpm-card-avatar-img" title={ad.executor} />
                                ) : (
                                  <span className="bpm-card-avatar bpm-card-avatar-executor" style={{ background: avatarColor(ad.executor) }} title={ad.executor}>{getInitials(ad.executor).slice(0, 1)}</span>
                                )}
                                <span className="bpm-card-meta-value" onClick={() => setRightPanel({ type: 'executor', stageName: AI_STAGE_NAME_2, taskIdx, role: 'executor', aiCardId: aiId })}>{ad.executor}</span>
                              </div>
                              <div className="bpm-card-meta-row">
                                <span className="bpm-card-meta-label">Согласующий:</span>
                                {/сюндюков/i.test(ad.approver || '') ? (
                                  <img src={`${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/sanya-bodibilder.png`} alt="" className="bpm-card-avatar bpm-card-avatar-img" title={ad.approver} />
                                ) : (
                                  <span className="bpm-card-avatar bpm-card-avatar-approver" style={{ background: avatarColor(ad.approver) }} title={ad.approver}>{getInitials(ad.approver).slice(0, 1)}</span>
                                )}
                                <span className="bpm-card-meta-value" onClick={() => setRightPanel({ type: 'executor', stageName: AI_STAGE_NAME_2, taskIdx, role: 'approver', aiCardId: aiId })}>{ad.approver}</span>
                              </div>
                              <div className="bpm-card-meta-row bpm-card-schedule-row">
                                <span className="bpm-card-meta-label bpm-card-meta-label-wrap">График<br />выполнения:</span>
                                <select className="bpm-select-inline bpm-select-tiny" defaultValue="каждые 2 дня" onClick={(e) => e.stopPropagation()}>
                                  {SCHEDULE_EVERY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                              </div>
                              <div className="bpm-card-meta-row bpm-card-period-row">
                                <span className="bpm-card-meta-label">Период выполнения:</span>
                                <div className="bpm-card-period-inputs">
                                  <input type="date" className="bpm-input-date" defaultValue={ad.periodStart} onClick={(e) => e.stopPropagation()} />
                                  <span className="bpm-card-period-sep">—</span>
                                  <input type="date" className="bpm-input-date" defaultValue={ad.periodEnd} onClick={(e) => e.stopPropagation()} />
                                </div>
                              </div>
                            </div>
                            <div className="bpm-card-body">
                              <div className="bpm-card-section-block">
                                <div role="button" tabIndex={0} className="bpm-card-section-header" onClick={() => toggleSection(aiId, 'systems')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(aiId, 'systems'); } }}>
                                  <span className={`bpm-card-collapse-arrow bpm-card-section-chevron ${getSectionOpen(aiId, 'systems') ? 'bpm-card-collapse-arrow-up' : 'bpm-card-collapse-arrow-down'}`} />
                                  <span className="bpm-card-section-title">Используемые системы</span>
                                  <span role="button" tabIndex={0} className="bpm-btn-icon bpm-add-system-btn bpm-add-system-inline" onClick={(e) => e.stopPropagation()} title="Добавить систему" aria-label="Добавить систему">+</span>
                                </div>
                                {getSectionOpen(aiId, 'systems') && (
                                  <ul className="bpm-card-systems-list">
                                    {aiSystems.map((s, i) => (
                                      <li key={i} className="bpm-card-system-item">
                                        <a href={`${typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''}#/service/${encodeURIComponent(s)}`} target="_blank" rel="noopener noreferrer" className="bpm-card-system-link"><span className="bpm-card-system-link-text">{s}</span><span className="bpm-icon-open-in-new" aria-hidden /></a>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              <div className="bpm-card-divider" />
                              <div className="bpm-card-section-block">
                                <div role="button" tabIndex={0} className="bpm-card-section-header" onClick={() => toggleSection(aiId, 'input')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(aiId, 'input'); } }}>
                                  <span className={`bpm-card-collapse-arrow bpm-card-section-chevron ${getSectionOpen(aiId, 'input') ? 'bpm-card-collapse-arrow-up' : 'bpm-card-collapse-arrow-down'}`} />
                                  <span className="bpm-card-section-title">Входные данные</span>
                                  <span role="button" tabIndex={0} className="bpm-icon-file-outline-btn" title="Загрузить в карточку" aria-label="Загрузить"><span className="bpm-icon-file-download" /></span>
                                  <span role="button" tabIndex={0} className="bpm-icon-file-outline-btn" title="Скачать" onClick={(e) => { e.stopPropagation(); e.preventDefault(); downloadInputListExcel(aiInputs); }} onKeyDown={(e) => e.key === 'Enter' && downloadInputListExcel(aiInputs)} aria-label="Скачать"><span className="bpm-icon-arrow-up" /></span>
                                </div>
                                {getSectionOpen(aiId, 'input') && (
                                  <div className="bpm-card-file-pills">
                                    {aiInputs.map((f, i) => (
                                      <div key={i} className="bpm-file-pill bpm-file-pill-minimal">
                                        <span className="bpm-icon-file-sm bpm-icon-file-ok" />
                                        <span className="bpm-file-pill-name">{f.name}</span>
                                        <span className="bpm-file-pill-date">{f.date}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="bpm-card-divider" />
                              <div className="bpm-card-section-block">
                                <div role="button" tabIndex={0} className="bpm-card-section-header" onClick={() => toggleSection(aiId, 'results')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(aiId, 'results'); } }}>
                                  <span className={`bpm-card-collapse-arrow bpm-card-section-chevron ${getSectionOpen(aiId, 'results') ? 'bpm-card-collapse-arrow-up' : 'bpm-card-collapse-arrow-down'}`} />
                                  <span className="bpm-card-section-title">Результаты расчета</span>
                                  <span role="button" tabIndex={0} className="bpm-icon-file-outline-btn" title="Загрузить в карточку" aria-label="Загрузить"><span className="bpm-icon-file-download" /></span>
                                  <span role="button" tabIndex={0} className="bpm-icon-file-outline-btn" title="Скачать" onClick={(e) => { e.stopPropagation(); e.preventDefault(); downloadResultListExcel([...aiResults, ...getSyntheticLabels(aiId)]); }} onKeyDown={(e) => e.key === 'Enter' && downloadResultListExcel([...aiResults, ...getSyntheticLabels(aiId)])} aria-label="Скачать"><span className="bpm-icon-arrow-up" /></span>
                                </div>
                                {getSectionOpen(aiId, 'results') && (
                                  <>
                                    {aiSuggestionsOn && (
                                      <button type="button" className="bpm-ai-dona-btn" onClick={(e) => { e.stopPropagation(); addSyntheticResult(aiId); }}>ИИ-донасыщение результатов расчета синтетикой</button>
                                    )}
                                    <div className="bpm-card-file-pills">
                                      {[...aiResults, ...getSyntheticLabels(aiId)].map((name, i) => {
                                        const dateStr = new Date(Date.now() - (hashStr(aiId + String(i)) % 30) * 86400000).toLocaleDateString('ru-RU')
                                        const status = ['ok', 'missing', 'warning'][hashStr(aiId + String(i)) % 3]
                                        const tooltip = { ok: 'Корректно', missing: 'Нехватка данных', warning: 'Пропуски данных' }[status]
                                        return (
                                          <div key={i} className="bpm-file-pill bpm-file-pill-minimal" title={tooltip}>
                                            <span className={`bpm-icon-file-sm bpm-icon-file-${status}`} />
                                            <span className="bpm-file-pill-name">{name}</span>
                                            <span className="bpm-file-pill-date">{dateStr}</span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      )
                    }
                    return (
                      <React.Fragment key={task.id}>
                        <div className="bpm-drop-zone bpm-drop-zone-inline" onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropAt(AI_STAGE_NAME_2, taskIdx); }} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.stopPropagation(); }} />
                        <div className="bpm-card" style={bpmCardRevealStyle(animateAiBoardReveal, stageIdx, taskIdx)} draggable onDragStart={(e) => handleDragStart(e, AI_STAGE_NAME_2, taskIdx)} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropAt(AI_STAGE_NAME_2, taskIdx); }} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.stopPropagation(); }}>
                          <div className="bpm-card-top-row">
                            <span className="bpm-card-id">№{task.id}</span>
                            <span className="bpm-card-badge bpm-card-badge-in-work">В РАБОТЕ</span>
                            <button type="button" className="bpm-card-delete" onClick={(ev) => { ev.stopPropagation(); deleteTask(AI_STAGE_NAME_2, taskIdx); }} title="Удалить карточку" aria-label="Удалить карточку">🗑</button>
                          </div>
                          <div className="bpm-card-name">{task.name || 'Задача'}</div>
                          <div className="bpm-card-meta">
                            <div className="bpm-card-meta-row">
                              <span className="bpm-card-meta-label">Исполнитель:</span>
                              <span className="bpm-card-meta-value" onClick={() => setRightPanel({ type: 'executor', stageName: AI_STAGE_NAME_2, taskIdx, role: 'executor' })}>{task.executor || '—'}</span>
                            </div>
                            <div className="bpm-card-meta-row">
                              <span className="bpm-card-meta-label">Согласующий:</span>
                              <span className="bpm-card-meta-value" onClick={() => setRightPanel({ type: 'executor', stageName: AI_STAGE_NAME_2, taskIdx, role: 'approver' })}>{task.approver || '—'}</span>
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    )
                  })}
                  <div className="bpm-drop-zone bpm-drop-zone-bottom" onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropAt(AI_STAGE_NAME_2, (tasks[AI_STAGE_NAME_2] || []).length); }} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.stopPropagation(); }} />
                </div>
              </>
            )
            ) : (
              <>
                <div
                  className="bpm-stage-header"
                  draggable
                  onDragStart={(e) => handleStageDragStart(e, stageIdx, stageName)}
                  onDragEnd={() => setDraggedStageIndex(null)}
                >
                  {editingStage === stageIdx ? (
                    <input value={stageNameEdit} onChange={(e) => setStageNameEdit(e.target.value)} className="bpm-input" onKeyDown={(e) => { if (e.key === 'Enter') saveStageEdit(); }} onBlur={saveStageEdit} autoFocus />
                  ) : (
                    <>
                      <span className="bpm-stage-title bpm-stage-title-clickable" onClick={() => { setEditingStage(stageIdx); setStageNameEdit(stageName) }} title="Нажмите для редактирования">{stageName}</span>
                      <div className="bpm-stage-btns">
                        <button type="button" className="bpm-card-delete bpm-stage-delete" onClick={(ev) => { ev.stopPropagation(); deleteStage(stageIdx); }} title="Удалить этап" aria-label="Удалить этап">🗑</button>
                      </div>
                    </>
                  )}
                </div>
                <button type="button" className="bpm-add-task bpm-add-task-top" onClick={() => addTask(stageName)}>+ Добавить задачу</button>
                <div className="bpm-stage-cards">
                  <div className="bpm-drop-zone bpm-drop-zone-first" onDrop={(e) => handleStageDropWithAi(stageName, 0, e)} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.stopPropagation(); }} />
                  {(() => {
                const list = aiSuggestionsOn && aiSuggestionCardPlacements?.length ? getStageDisplayItems(stageName) : (filteredTasksByStage[stageName] || []).map((task) => ({ type: 'task', task, taskIdx: (tasks[stageName] || []).findIndex((t) => t.id === task.id) }))
                return list.map((item, i) => {
                  const dropTaskIdx = list.slice(0, i).filter((x) => x.type === 'task').length
                  if (item.type === 'ai') {
                    const ad = aiCardsData[item.cardKey + 1]
                    if (!ad) return null
                    const displayId = `ai-inline-${item.cardKey}`
                    if (removedAiCardIds.has(displayId)) return null
                    const aiSystems = getAiCardSystems(displayId)
                    const aiInputs = getAiCardInputFiles(displayId)
                    const aiResults = getResultLinesForCard('ИИ-автопредложенная карточка', displayId)
                    const agreed = agreedAiCardIds.has(displayId)
                    return (
                      <React.Fragment key={`ai-${item.cardKey}-${stageName}`}>
                        <div className="bpm-drop-zone bpm-drop-zone-inline" onDrop={(e) => handleStageDropWithAi(stageName, i, e)} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.stopPropagation(); }} />
                        <div className={`bpm-card bpm-card-ai-suggestion ${agreed ? 'bpm-card-ai-agreed' : ''}`} style={bpmCardRevealStyle(animateAiBoardReveal, stageIdx, i)} draggable onDragStart={(e) => { draggedAiCardRef.current = { stageName, fromIndex: i, cardKey: item.cardKey }; e.dataTransfer.setData('text/plain', JSON.stringify({ stageName, taskIdx: i, aiCardKey: item.cardKey })); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { draggedAiCardRef.current = null; }} onDrop={(e) => handleStageDropWithAi(stageName, i, e)} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.stopPropagation(); }}>
                          <div className="bpm-card-top-row">
                            <span className="bpm-card-id">{displayId}</span>
                            <span className="bpm-card-badge bpm-card-badge-in-work">ИИ</span>
                            <span className="bpm-card-badge bpm-card-badge-in-work bpm-card-ai-agree-badge" onClick={(e) => { e.stopPropagation(); toggleAgreedAiCard(displayId); }} role="button" tabIndex={0} title="Согласовать">{agreed ? 'Согласовано' : 'СОГЛАСОВАТЬ'}</span>
                            <button type="button" className="bpm-card-delete" onClick={(e) => { e.stopPropagation(); removeAiCard(displayId); }} title="Удалить карточку" aria-label="Удалить карточку">🗑</button>
                          </div>
                          {editingAiCardId === displayId ? (
                            <input className="bpm-card-name-input" defaultValue={aiStaticCardOverrides[displayId]?.name || 'ИИ-автопредложенная карточка'} onBlur={(e) => { const v = e.target.value.trim(); if (v) setAiStaticCardOverrides((p) => ({ ...p, [displayId]: { ...p[displayId], name: v } })); setEditingAiCardId(null); }} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} onClick={(ev) => ev.stopPropagation()} autoFocus />
                          ) : (
                            <div className="bpm-card-name" onClick={(ev) => { ev.stopPropagation(); setEditingAiCardId(displayId); }} title="Нажмите для редактирования">{aiStaticCardOverrides[displayId]?.name || 'ИИ-автопредложенная карточка'}</div>
                          )}
                          <div className="bpm-card-meta">
                            <div className="bpm-card-meta-row">
                              <span className="bpm-card-meta-label">Исполнитель:</span>
                              {/сюндюков/i.test(ad.executor || '') ? (
                                <img src={`${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/sanya-bodibilder.png`} alt="" className="bpm-card-avatar bpm-card-avatar-img" title={ad.executor} />
                              ) : (
                                <span className="bpm-card-avatar bpm-card-avatar-executor" style={{ background: avatarColor(ad.executor) }} title={ad.executor}>{getInitials(ad.executor).slice(0, 1)}</span>
                              )}
                              <span className="bpm-card-meta-value" onClick={() => setRightPanel({ type: 'executor', stageName, taskIdx: i, role: 'executor', aiCardId: displayId })}>{ad.executor}</span>
                            </div>
                            <div className="bpm-card-meta-row">
                              <span className="bpm-card-meta-label">Согласующий:</span>
                              {/сюндюков/i.test(ad.approver || '') ? (
                                <img src={`${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/sanya-bodibilder.png`} alt="" className="bpm-card-avatar bpm-card-avatar-img" title={ad.approver} />
                              ) : (
                                <span className="bpm-card-avatar bpm-card-avatar-approver" style={{ background: avatarColor(ad.approver) }} title={ad.approver}>{getInitials(ad.approver).slice(0, 1)}</span>
                              )}
                              <span className="bpm-card-meta-value" onClick={() => setRightPanel({ type: 'executor', stageName, taskIdx: i, role: 'approver', aiCardId: displayId })}>{ad.approver}</span>
                            </div>
                            <div className="bpm-card-meta-row bpm-card-schedule-row">
                              <span className="bpm-card-meta-label bpm-card-meta-label-wrap">График<br />выполнения:</span>
                              <select className="bpm-select-inline bpm-select-tiny" defaultValue="каждые 2 дня" onClick={(e) => e.stopPropagation()}>
                                {SCHEDULE_EVERY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            <div className="bpm-card-meta-row bpm-card-period-row">
                              <span className="bpm-card-meta-label">Период выполнения:</span>
                              <div className="bpm-card-period-inputs">
                                <input type="date" className="bpm-input-date" defaultValue={ad.periodStart} onClick={(e) => e.stopPropagation()} />
                                <span className="bpm-card-period-sep">—</span>
                                <input type="date" className="bpm-input-date" defaultValue={ad.periodEnd} onClick={(e) => e.stopPropagation()} />
                              </div>
                            </div>
                          </div>
                          <div className="bpm-card-body">
                            <div className="bpm-card-section-block">
                              <div role="button" tabIndex={0} className="bpm-card-section-header" onClick={() => toggleSection(displayId, 'systems')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(displayId, 'systems'); } }}>
                                <span className={`bpm-card-collapse-arrow bpm-card-section-chevron ${getSectionOpen(displayId, 'systems') ? 'bpm-card-collapse-arrow-up' : 'bpm-card-collapse-arrow-down'}`} />
                                <span className="bpm-card-section-title">Используемые системы</span>
                                <span role="button" tabIndex={0} className="bpm-btn-icon bpm-add-system-btn bpm-add-system-inline" onClick={(e) => e.stopPropagation()} title="Добавить систему" aria-label="Добавить систему">+</span>
                              </div>
                              {getSectionOpen(displayId, 'systems') && (
                                <ul className="bpm-card-systems-list">
                                  {aiSystems.map((s, idx) => (
                                    <li key={idx} className="bpm-card-system-item">
                                      <a href={`${typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''}#/service/${encodeURIComponent(s)}`} target="_blank" rel="noopener noreferrer" className="bpm-card-system-link"><span className="bpm-card-system-link-text">{s}</span><span className="bpm-icon-open-in-new" aria-hidden /></a>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div className="bpm-card-divider" />
                            <div className="bpm-card-section-block">
                              <div role="button" tabIndex={0} className="bpm-card-section-header" onClick={() => toggleSection(displayId, 'input')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(displayId, 'input'); } }}>
                                <span className={`bpm-card-collapse-arrow bpm-card-section-chevron ${getSectionOpen(displayId, 'input') ? 'bpm-card-collapse-arrow-up' : 'bpm-card-collapse-arrow-down'}`} />
                                <span className="bpm-card-section-title">Входные данные</span>
                                <span role="button" tabIndex={0} className="bpm-icon-file-outline-btn" title="Загрузить в карточку" aria-label="Загрузить"><span className="bpm-icon-file-download" /></span>
                                <span role="button" tabIndex={0} className="bpm-icon-file-outline-btn" title="Скачать" onClick={(e) => { e.stopPropagation(); e.preventDefault(); downloadInputListExcel(aiInputs); }} onKeyDown={(e) => e.key === 'Enter' && downloadInputListExcel(aiInputs)} aria-label="Скачать"><span className="bpm-icon-arrow-up" /></span>
                              </div>
                              {getSectionOpen(displayId, 'input') && (
                                <div className="bpm-card-file-pills">
                                  {aiInputs.map((f, idx) => (
                                    <div key={idx} className="bpm-file-pill bpm-file-pill-minimal">
                                      <span className="bpm-icon-file-sm bpm-icon-file-ok" />
                                      <span className="bpm-file-pill-name">{f.name}</span>
                                      <span className="bpm-file-pill-date">{f.date}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="bpm-card-divider" />
                            <div className="bpm-card-section-block">
                              <div role="button" tabIndex={0} className="bpm-card-section-header" onClick={() => toggleSection(displayId, 'results')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(displayId, 'results'); } }}>
                                <span className={`bpm-card-collapse-arrow bpm-card-section-chevron ${getSectionOpen(displayId, 'results') ? 'bpm-card-collapse-arrow-up' : 'bpm-card-collapse-arrow-down'}`} />
                                <span className="bpm-card-section-title">Результаты расчета</span>
                                <span role="button" tabIndex={0} className="bpm-icon-file-outline-btn" title="Загрузить в карточку" aria-label="Загрузить"><span className="bpm-icon-file-download" /></span>
                                <span role="button" tabIndex={0} className="bpm-icon-file-outline-btn" title="Скачать" onClick={(e) => { e.stopPropagation(); e.preventDefault(); downloadResultListExcel([...aiResults, ...getSyntheticLabels(displayId)]); }} onKeyDown={(e) => e.key === 'Enter' && downloadResultListExcel([...aiResults, ...getSyntheticLabels(displayId)])} aria-label="Скачать"><span className="bpm-icon-arrow-up" /></span>
                              </div>
                              {getSectionOpen(displayId, 'results') && (
                                <div className="bpm-card-file-pills">
                                  {[...aiResults, ...getSyntheticLabels(displayId)].map((name, idx) => {
                                    const dateStr = new Date(Date.now() - (hashStr(displayId + String(idx)) % 30) * 86400000).toLocaleDateString('ru-RU')
                                    const status = ['ok', 'missing', 'warning'][hashStr(displayId + String(idx)) % 3]
                                    const tooltip = { ok: 'Корректно', missing: 'Нехватка данных', warning: 'Пропуски данных' }[status]
                                    return (
                                      <div key={idx} className="bpm-file-pill bpm-file-pill-minimal" title={tooltip}>
                                        <span className={`bpm-icon-file-sm bpm-icon-file-${status}`} />
                                        <span className="bpm-file-pill-name">{name}</span>
                                        <span className="bpm-file-pill-date">{dateStr}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    )
                  }
                  const task = item.task
                  const taskIdx = item.taskIdx
                  if (!task || taskIdx < 0) return null
                const isAiCaseCard = aiCaseCardIds.has(task.id)
                const agreedAiCase = agreedAiCaseCardIds.has(task.id)
                const isHighlight = cardMatchesHighlight(task.name, highlightCardName)
                const key = `${stageIdx}-${taskIdx}`
                const cardKey = `${stageName}-${task.id}`
                const isExp = viewMode === 'Упрощенный вид' ? true : (expanded[task.id] !== false)
                const isEdit = editingTask?.stageName === stageName && editingTask?.taskIdx === taskIdx
                const isEditingName = editingCardName?.stageName === stageName && editingCardName?.taskIdx === taskIdx
                const isShortView = viewMode === 'Упрощенный вид'
                const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') + '/'
                return (
                  <React.Fragment key={cardKey}>
                    <div className="bpm-drop-zone bpm-drop-zone-inline" onDrop={(e) => handleStageDropWithAi(stageName, i, e, dropTaskIdx)} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.stopPropagation(); }} />
                    <div
                      className={`bpm-card ${isAiCaseCard ? 'bpm-card-ai-suggestion ' + (agreedAiCase ? 'bpm-card-ai-agreed' : '') : ''} ${isHighlight ? 'bpm-card-highlight' : ''} ${(task.name || '').trim() === 'Реинжениринг' ? 'bpm-card-reinjing' : ''} ${connectionFrom && connectionFrom.stageName === stageName && connectionFrom.taskId === task.id ? 'bpm-card-connection-from' : ''}`}
                      style={bpmCardRevealStyle(animateAiBoardReveal, stageIdx, i)}
                      data-connection-stage={stageName}
                      data-connection-id={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, stageName, taskIdx)}
                      onDrop={(e) => handleStageDropWithAi(stageName, i + 1, e, dropTaskIdx + 1)}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.stopPropagation(); }}
                      onClick={connectionsMode ? (ev) => { ev.stopPropagation(); if (connectionFrom) { if (connectionFrom.stageName !== stageName || connectionFrom.taskId !== task.id) { setConnections((c) => [...c, { fromStage: connectionFrom.stageName, fromId: connectionFrom.taskId, toStage: stageName, toId: task.id }]); } setConnectionFrom(null); } else { setConnectionFrom({ stageName, taskId: task.id }); } } : undefined}
                    >
                      <div className="bpm-card-top-row">
                        <span className="bpm-card-id">№{task.id}</span>
                        {isAiCaseCard && (
                          <span className="bpm-card-badge bpm-card-badge-in-work bpm-card-ai-agree-badge" onClick={(e) => { e.stopPropagation(); setAgreedAiCaseCardIds((prev) => { const n = new Set(prev); if (n.has(task.id)) n.delete(task.id); else n.add(task.id); return n; }); }} role="button" tabIndex={0} title="Согласовать">{agreedAiCase ? 'Согласовано' : 'СОГЛАСОВАТЬ'}</span>
                        )}
                        <span className={'bpm-card-badge bpm-card-badge-' + ({ 'в работе': 'in-work', 'завершен': 'success', 'ошибка': 'error', 'пауза': 'pause' }[task.status] || 'in-work')}>
                          {(task.status || 'в работе').toUpperCase()}
                        </span>
                        <button type="button" className="bpm-card-delete" onClick={(ev) => { ev.stopPropagation(); deleteTask(stageName, taskIdx); }} title="Удалить карточку" aria-label="Удалить карточку">🗑</button>
                      </div>
                      {isEditingName ? (
                        <input
                          className="bpm-card-name-input"
                          value={cardNameEdit}
                          onChange={(e) => setCardNameEdit(e.target.value)}
                          onBlur={() => { if (editingCardName) saveTaskEdit(editingCardName.stageName, editingCardName.taskIdx, { name: cardNameEdit.trim() || task.name }); setEditingCardName(null); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { saveTaskEdit(stageName, taskIdx, { name: cardNameEdit.trim() || task.name }); setEditingCardName(null); e.target.blur(); } }}
                          onClick={(ev) => ev.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <div className="bpm-card-name" onClick={(ev) => { if (!isShortView) { ev.stopPropagation(); setEditingCardName({ stageName, taskIdx }); setCardNameEdit(task.name || 'Новая задача'); } else toggleExpanded(task.id); }} title={!isShortView ? 'Нажмите для редактирования названия' : ''}>{task.name || 'Без названия'}</div>
                      )}
                      {isShortView && (task.name || '').trim() === 'Реинжениринг' && (
                        <div className="bpm-card-body bpm-card-body-short">
                          <ul className="bpm-card-systems-list">
                            <li className="bpm-card-system-item">
                              {onOpenPlanningWithScenario ? (
                                <button type="button" className="bpm-card-system-link bpm-card-system-link-btn" onClick={(ev) => { ev.stopPropagation(); onOpenPlanningWithScenario({ name: 'Проактивное управление ремонтами и приоритетами' }); }}><span className="bpm-card-system-link-text">Процесс 1</span><span className="bpm-icon-open-in-new" aria-hidden /></button>
                              ) : (
                                <a href={`${typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''}#planning`} className="bpm-card-system-link" onClick={(ev) => ev.stopPropagation()}><span className="bpm-card-system-link-text">Процесс 1</span><span className="bpm-icon-open-in-new" aria-hidden /></a>
                              )}
                            </li>
                          </ul>
                        </div>
                      )}
                      {!isShortView && (
                        <>
                          <div className="bpm-card-meta">
                            <div className="bpm-card-meta-row">
                              <span className="bpm-card-meta-label">Исполнитель:</span>
                              {(task.executor || '').trim() ? (
                                <>
                                  {/сюндюков/i.test(task.executor || '') ? (
                                    <img src={`${base}sanya-bodibilder.png`} alt="" className="bpm-card-avatar bpm-card-avatar-img" title={task.executor} />
                                  ) : (
                                    <span className="bpm-card-avatar bpm-card-avatar-executor" style={{ background: avatarColor(task.executor) }} title={task.executor}>{getInitials(task.executor).slice(0, 1)}</span>
                                  )}
                                  <span className="bpm-card-meta-value" onClick={() => setRightPanel({ type: 'executor', stageName, taskIdx, role: 'executor' })}>{task.executor}</span>
                                </>
                              ) : (
                                <span className="bpm-card-meta-value bpm-card-meta-placeholder" onClick={() => setRightPanel({ type: 'executor', stageName, taskIdx, role: 'executor' })}>Выберите…</span>
                              )}
                            </div>
                            <div className="bpm-card-meta-row">
                              <span className="bpm-card-meta-label">Согласующий:</span>
                              {(task.approver || '').trim() ? (
                                <>
                                  {/сюндюков/i.test(task.approver || '') ? (
                                    <img src={`${base}sanya-bodibilder.png`} alt="" className="bpm-card-avatar bpm-card-avatar-img" title={task.approver} />
                                  ) : (
                                    <span className="bpm-card-avatar bpm-card-avatar-approver" style={{ background: avatarColor(task.approver) }} title={task.approver}>{getInitials(task.approver).slice(0, 1)}</span>
                                  )}
                                  <span className="bpm-card-meta-value" onClick={() => setRightPanel({ type: 'executor', stageName, taskIdx, role: 'approver' })}>{task.approver}</span>
                                </>
                              ) : (
                                <span className="bpm-card-meta-value bpm-card-meta-placeholder" onClick={() => setRightPanel({ type: 'executor', stageName, taskIdx, role: 'approver' })}>Выберите…</span>
                              )}
                            </div>
                            <div className="bpm-card-meta-row bpm-card-schedule-row">
                              <span className="bpm-card-meta-label bpm-card-meta-label-wrap">График<br />выполнения:</span>
                              <select className="bpm-select-inline bpm-select-tiny" value={task.scheduleEvery || 'каждые 2 дня'} onChange={(e) => saveTaskEdit(stageName, taskIdx, { scheduleEvery: e.target.value })} onClick={(ev) => ev.stopPropagation()}>
                                {SCHEDULE_EVERY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            <div className="bpm-card-meta-row bpm-card-period-row">
                              <span className="bpm-card-meta-label">Период выполнения:</span>
                              <div className="bpm-card-period-inputs">
                                <input type="date" className="bpm-input-date" value={task.periodStart ? (task.periodStart instanceof Date ? task.periodStart.toISOString().slice(0, 10) : task.periodStart) : (task.deadline instanceof Date ? task.deadline.toISOString().slice(0, 10) : '')} onChange={(e) => saveTaskEdit(stageName, taskIdx, { periodStart: e.target.value ? new Date(e.target.value) : task.deadline })} onClick={(ev) => ev.stopPropagation()} />
                                <span className="bpm-card-period-sep">—</span>
                                <input type="date" className="bpm-input-date" value={task.periodEnd ? (task.periodEnd instanceof Date ? task.periodEnd.toISOString().slice(0, 10) : task.periodEnd) : (task.deadline instanceof Date ? task.deadline.toISOString().slice(0, 10) : '')} onChange={(e) => saveTaskEdit(stageName, taskIdx, { periodEnd: e.target.value ? new Date(e.target.value) : task.deadline })} onClick={(ev) => ev.stopPropagation()} />
                              </div>
                            </div>
                          </div>
                          {isExp && (
                            <div className="bpm-card-body">
                              <div className="bpm-card-section-block">
                                <div role="button" tabIndex={0} className="bpm-card-section-header" onClick={() => toggleSection(task.id, 'systems')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(task.id, 'systems'); } }}>
                                  <span className={`bpm-card-collapse-arrow bpm-card-section-chevron ${getSectionOpen(task.id, 'systems') ? 'bpm-card-collapse-arrow-up' : 'bpm-card-collapse-arrow-down'}`} />
                                  <span className="bpm-card-section-title">{(task.name || '').trim() === 'Реинжениринг' ? 'Взаимосвязанный бизнес-процесс' : 'Используемые системы'}</span>
                                  {(task.name || '').trim() !== 'Реинжениринг' && (
                                    <button type="button" className="bpm-btn-icon bpm-add-system-btn bpm-add-system-inline" onClick={(ev) => { ev.stopPropagation(); setRightPanel({ type: 'systems', stageName, taskIdx }); }} title="Добавить систему">+</button>
                                  )}
                                </div>
                                {getSectionOpen(task.id, 'systems') && (
                                  <>
                                    {(task.name || '').trim() === 'Реинжениринг' ? (
                                      <ul className="bpm-card-systems-list">
                                        <li className="bpm-card-system-item">
                                          {onOpenPlanningWithScenario ? (
                                            <button type="button" className="bpm-card-system-link bpm-card-system-link-btn" onClick={() => onOpenPlanningWithScenario({ name: 'Проактивное управление ремонтами и приоритетами' })}>
                                              <span className="bpm-card-system-link-text">Процесс 1</span><span className="bpm-icon-open-in-new" aria-hidden />
                                            </button>
                                          ) : (
                                            <a href={`${typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''}#planning`} className="bpm-card-system-link"><span className="bpm-card-system-link-text">Процесс 1</span><span className="bpm-icon-open-in-new" aria-hidden /></a>
                                          )}
                                        </li>
                                      </ul>
                                    ) : (
                                      <>
                                        <ul className="bpm-card-systems-list">
                                          {(task.entries || []).filter((e) => e.system).map((e, i) => (
                                            <li key={i} className="bpm-card-system-item">
                                              <a href={`${typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''}#/service/${encodeURIComponent(e.system)}`} target="_blank" rel="noopener noreferrer" className="bpm-card-system-link"><span className="bpm-card-system-link-text">{e.system}</span><span className="bpm-icon-open-in-new" aria-hidden /></a>
                                            </li>
                                          ))}
                                        </ul>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                              <div className="bpm-card-divider" />
                              <div className="bpm-card-section-block">
                                <div role="button" tabIndex={0} className="bpm-card-section-header" onClick={() => toggleSection(task.id, 'input')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(task.id, 'input'); } }}>
                                  <span className={`bpm-card-collapse-arrow bpm-card-section-chevron ${getSectionOpen(task.id, 'input') ? 'bpm-card-collapse-arrow-up' : 'bpm-card-collapse-arrow-down'}`} />
                                  <span className="bpm-card-section-title">Входные данные</span>
                                  <button type="button" className="bpm-icon-file-outline-btn" title="Загрузить в карточку" aria-label="Загрузить"><span className="bpm-icon-file-download bpm-icon-arrow-down" aria-hidden /></button>
                                  <button type="button" className="bpm-icon-file-outline-btn" title="Скачать" onClick={(ev) => { ev.stopPropagation(); downloadInputListExcel(getTaskInputFiles(task)); }} aria-label="Скачать список данных"><span className="bpm-icon-arrow-up" aria-hidden /></button>
                                </div>
                                {getSectionOpen(task.id, 'input') && (
                                  <>
                                    {aiMode && (
                                      <button type="button" className="bpm-ai-dona-btn" onClick={(ev) => { ev.stopPropagation(); applyInputDona(task.id); }}>ИИ-донасыщение входных данных синтетикой</button>
                                    )}
                                    <div className="bpm-card-file-pills">
                                      {getTaskInputFiles(task).map((f, i) => {
                                        const status = f.status || ['ok', 'missing', 'warning'][hashStr(task.id + String(i)) % 3]
                                        const dateStr = f.date || new Date().toLocaleDateString('ru-RU')
                                        const tooltip = { ok: 'Корректно', missing: 'Нехватка данных', warning: 'Пропуски данных' }[status]
                                        return (
                                        <div key={i} className={`bpm-file-pill bpm-file-pill-minimal ${f.aiChanged ? 'bpm-file-pill-ai' : ''}`} title={f.aiComment || tooltip}>
                                          <button type="button" className={`bpm-icon-file-sm bpm-icon-file-${status}`} title={f.aiComment || tooltip} onClick={(ev) => { ev.stopPropagation(); downloadEmptyExcel(f.name || 'Название данных'); }} aria-label="Скачать" />
                                          <span className="bpm-file-pill-name">{f.name || 'Название данных'}</span>
                                          <span className="bpm-file-pill-date">{dateStr}</span>
                                          {f.aiChanged && <span className="bpm-file-pill-ai-icon" title={f.aiComment} aria-hidden />}
                                        </div>
                                        )
                                      })}
                                    </div>
                                  </>
                                )}
                              </div>
                              <div className="bpm-card-divider" />
                              <div className="bpm-card-section-block">
                                <div role="button" tabIndex={0} className="bpm-card-section-header" onClick={() => toggleSection(task.id, 'results')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(task.id, 'results'); } }}>
                                  <span className={`bpm-card-collapse-arrow bpm-card-section-chevron ${getSectionOpen(task.id, 'results') ? 'bpm-card-collapse-arrow-up' : 'bpm-card-collapse-arrow-down'}`} />
                                  <span className="bpm-card-section-title">Результаты расчета</span>
                                  <button type="button" className="bpm-icon-file-outline-btn" title="Загрузить в карточку" aria-label="Загрузить"><span className="bpm-icon-file-download bpm-icon-arrow-down" aria-hidden /></button>
                                  <button type="button" className="bpm-icon-file-outline-btn" title="Скачать" onClick={(ev) => { ev.stopPropagation(); downloadResultListExcel(getTaskResultFiles(task)); }} aria-label="Скачать результаты"><span className="bpm-icon-arrow-up" aria-hidden /></button>
                                </div>
                                {getSectionOpen(task.id, 'results') && (
                                  <>
                                    {aiMode && (
                                      <button type="button" className="bpm-ai-dona-btn" onClick={(ev) => { ev.stopPropagation(); addSyntheticResult(task.id); }}>ИИ-донасыщение результатов расчета синтетикой</button>
                                    )}
                                    <div className="bpm-card-file-pills">
                                      {[...getTaskResultFiles(task), ...getSyntheticLabels(task.id).map((name) => ({ name }))].map((f, i) => {
                                        const dateStr = f.date != null ? (typeof f.date === 'string' ? f.date : new Date(f.date).toLocaleDateString('ru-RU')) : new Date(Date.now() - (hashStr(task.id + String(i)) % 30) * 86400000).toLocaleDateString('ru-RU')
                                        const status = f.status || ['ok', 'missing', 'warning'][hashStr(task.id + String(i)) % 3]
                                        const tooltip = f.aiComment || { ok: 'Корректно', missing: 'Нехватка данных', warning: 'Пропуски данных' }[status]
                                        return (
                                          <div key={i} className={`bpm-file-pill bpm-file-pill-minimal ${f.aiChanged ? 'bpm-file-pill-ai' : ''}`} title={tooltip}>
                                            <span className={`bpm-icon-file-sm bpm-icon-file-${status}`} title={tooltip} />
                                            <span className="bpm-file-pill-name">{f.name || 'Результат расчета'}</span>
                                            <span className="bpm-file-pill-date">{dateStr}</span>
                                            {f.aiChanged && <span className="bpm-file-pill-ai-icon" title={f.aiComment} aria-hidden />}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      {isShortView && (
                        <div className="bpm-card-body">
                          <div className="bpm-card-data-list">
                            {(task.entries || []).filter((e) => e.system).length > 0 ? (
                              <ul className="bpm-card-data-items">
                                {(task.entries || []).filter((e) => e.system).map((e, i) => (
                                  <li key={i} className="bpm-card-data-item">
                                    <a href={`${typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''}#/service/${encodeURIComponent(e.system)}`} target="_blank" rel="noopener noreferrer" className="bpm-card-system-link" onClick={(ev) => ev.stopPropagation()}><span className="bpm-card-system-link-text">{e.system}</span><span className="bpm-icon-open-in-new" aria-hidden /></a>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="bpm-card-data-empty">Нет данных</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                )
                })
                })()}
              <div className="bpm-drop-zone bpm-drop-zone-bottom" onDrop={(e) => handleStageDropWithAi(stageName, list.length, e, (tasks[stageName] || []).length)} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.stopPropagation(); }} />
                </div>
              </>
            )}
          </div>
          </React.Fragment>
        ))}
      </div>
          </div>
        </div>
      </div>
      {rightPanel && (
        <>
          <div className="bpm-right-panel-overlay" onClick={() => setRightPanel(null)} />
          <div className="bpm-right-panel-wrap">
            {rightPanel.type === 'systems' && (() => {
              const taskId = (tasks[rightPanel.stageName]?.[rightPanel.taskIdx]?.id) || ''
              const priorityIndices = (taskId && aiAutoselectByTaskId[taskId]) || []
              return (
              <BPMRightPanelSystems
                key={taskId}
                aiMode={aiMode}
                hasUsedAiAutoselect={priorityIndices.length > 0}
                onUsedAiAutoselect={(indices) => {
                  if (!taskId || !Array.isArray(indices)) return
                  setAiAutoselectByTaskId((prev) => ({ ...prev, [taskId]: indices }))
                }}
                priorityIndices={priorityIndices}
                onClose={() => setRightPanel(null)}
                taskName={(tasks[rightPanel.stageName]?.[rightPanel.taskIdx]?.name) || ''}
                taskId={taskId}
                existingSystems={(tasks[rightPanel.stageName]?.[rightPanel.taskIdx]?.entries || []).map((e) => e.system).filter(Boolean)}
                onSelectSystem={(system) => {
                  setTasks((t) => {
                    const list = [...(t[rightPanel.stageName] || [])]
                    const task = list[rightPanel.taskIdx]
                    if (!task) return t
                    const entries = [...(task.entries || []), { system, input: '', output: '' }]
                    list[rightPanel.taskIdx] = { ...task, entries }
                    return { ...t, [rightPanel.stageName]: list }
                  })
                }}
                onSelectSystems={(systems) => {
                  setTasks((t) => {
                    const list = [...(t[rightPanel.stageName] || [])]
                    const task = list[rightPanel.taskIdx]
                    if (!task) return t
                    const entries = [...(task.entries || []), ...(systems || []).map((s) => ({ system: s, input: '', output: '' }))]
                    list[rightPanel.taskIdx] = { ...task, entries }
                    return { ...t, [rightPanel.stageName]: list }
                  })
                }}
                onDeselectSystem={(system) => {
                  setTasks((t) => {
                    const list = [...(t[rightPanel.stageName] || [])]
                    const task = list[rightPanel.taskIdx]
                    if (!task) return t
                    const entries = (task.entries || []).filter((e) => e.system !== system)
                    list[rightPanel.taskIdx] = { ...task, entries }
                    return { ...t, [rightPanel.stageName]: list }
                  })
                }}
              />
            ); })()}
            {rightPanel.type === 'executor' && (
              <BPMRightPanelExecutor
                aiMode={aiMode}
                customPersonnel={customPersonnelList}
                onAddCustomPerson={(name) => setCustomPersonnelList((prev) => (prev.includes(name) ? prev : [...prev, name]))}
                onClose={() => setRightPanel(null)}
                roleLabel={rightPanel.role === 'approver' ? 'Согласующий' : 'Исполнитель'}
                currentValue={rightPanel.aiCardId ? (rightPanel.role === 'executor' ? (aiStaticCardOverrides[rightPanel.aiCardId]?.executor) : (aiStaticCardOverrides[rightPanel.aiCardId]?.approver)) : (rightPanel.role === 'executor' ? (tasks[rightPanel.stageName]?.[rightPanel.taskIdx]?.executor) : (tasks[rightPanel.stageName]?.[rightPanel.taskIdx]?.approver))}
                onSelect={(name) => {
                  if (rightPanel.aiCardId) {
                    setAiStaticCardOverrides((prev) => ({ ...prev, [rightPanel.aiCardId]: { ...prev[rightPanel.aiCardId], [rightPanel.role === 'executor' ? 'executor' : 'approver']: name } }))
                  } else {
                    setTasks((t) => {
                      const list = [...(t[rightPanel.stageName] || [])]
                      const task = list[rightPanel.taskIdx]
                      if (!task) return t
                      if (rightPanel.role === 'executor') list[rightPanel.taskIdx] = { ...task, executor: name }
                      else list[rightPanel.taskIdx] = { ...task, approver: name }
                      return { ...t, [rightPanel.stageName]: list }
                    })
                  }
                  setEditingTask(null)
                }}
              />
            )}
          </div>
        </>
      )}
      {connectionFrom && (
        <div className="bpm-connection-hint">Выберите целевую карточку для связи</div>
      )}
      {aiModalOpen && (
        <div className="bpm-modal-overlay" onClick={() => setAiModalOpen(false)}>
          <div className="bpm-modal bpm-modal-autosvyazi" onClick={(e) => e.stopPropagation()}>
            <h3 className="bpm-modal-title">НАСТРОЙКА ИИ-АВТОВЗАИМОСВЯЗЕЙ</h3>
            <div className="bpm-modal-section">
              <label className="bpm-modal-label">Учитывать регламенты ПАО Газпромнефть:</label>
              <ul className="bpm-modal-regulations-list">
                <li className="bpm-modal-regulation-item">
                  <input type="checkbox" id="reg-1" defaultChecked className="bpm-modal-regulation-cb" />
                  <a href="https://ir.gazprom-neft.ru/disclosure/internal-regulations/#polozheniya" target="_blank" rel="noopener noreferrer" className="bpm-modal-regulation-link">Внутренние документы и политики</a>
                </li>
                <li className="bpm-modal-regulation-item">
                  <input type="checkbox" id="reg-2" defaultChecked className="bpm-modal-regulation-cb" />
                  <a href="https://rspp.ru/upload/uf/83f/gpn_codex_2019.pdf" target="_blank" rel="noopener noreferrer" className="bpm-modal-regulation-link">Корпоративный кодекс</a>
                </li>
                <li className="bpm-modal-regulation-item">
                  <input type="checkbox" id="reg-3" defaultChecked className="bpm-modal-regulation-cb" />
                  <a href="https://gazpromneft-sm.ru/uploads/editor/3f/42/Politika_proizvodstvennoj_bezopasnosti.pdf" target="_blank" rel="noopener noreferrer" className="bpm-modal-regulation-link">Политика производственной безопасности</a>
                </li>
                <li className="bpm-modal-regulation-item">
                  <input type="checkbox" id="reg-4" defaultChecked className="bpm-modal-regulation-cb" />
                  <a href="https://zakupki.gazprom-neft.ru/upload/instructions/%D0%A0%D0%B5%D0%B3%D0%BB%D0%B0%D0%BC%D0%B5%D0%BD%D1%82%20%D0%B4%D0%BB%D1%8F%20%D0%A3%D1%87%D0%B0%D1%81%D1%82%D0%BD%D0%B8%D0%BA%D0%BE%D0%B2.pdf" target="_blank" rel="noopener noreferrer" className="bpm-modal-regulation-link">Регламент участия в конкурентном отборе</a>
                </li>
              </ul>
              <label className="bpm-modal-add-reg-label">
                <input type="file" accept=".pdf,.doc,.docx" className="bpm-modal-file-input" onChange={(e) => e.target.value = ''} />
                <span className="bpm-modal-add-reg-btn">+ Добавить свой регламент</span>
              </label>
            </div>
            <div className="bpm-modal-section">
              <label className="bpm-modal-label">Промпт</label>
              <textarea className="bpm-modal-prompt" placeholder="Введите свой промпт" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} rows={3} />
            </div>
            <div className="bpm-modal-actions">
              <button type="button" className="bpm-btn bpm-btn-primary" onClick={() => { setAiModalOpen(false); setAiPrompt(''); }}>Запустить</button>
              <button type="button" className="bpm-btn" onClick={() => { setAiModalOpen(false); setAiPrompt(''); }}>Отменить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TaskEditForm({ task, onSave, onCancel, onDelete }) {
  const [name, setName] = useState(task.name)
  const [executor, setExecutor] = useState(task.executor)
  const [approver, setApprover] = useState(task.approver)
  const [deadline, setDeadline] = useState(task.deadline instanceof Date ? task.deadline.toISOString().slice(0, 10) : task.deadline)
  const [status, setStatus] = useState(task.status)
  const [entries, setEntries] = useState(task.entries?.length ? task.entries : [{ system: '', input: '', output: '' }])

  const addEntry = () => setEntries((e) => [...e, { system: '', input: '', output: '' }])
  const removeEntry = (i) => setEntries((e) => e.filter((_, j) => j !== i))
  const updateEntry = (i, field, value) => setEntries((e) => e.map((x, j) => (j === i ? { ...x, [field]: value } : x)))

  const handleSave = () => {
    onSave({
      name,
      executor,
      approver,
      deadline: new Date(deadline),
      status,
      entries: entries.filter((e) => e.system?.trim()),
    })
  }

  return (
    <div className="bpm-task-edit">
      <label>Название <input className="bpm-input" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>Исполнитель
        <select className="bpm-select" value={executor} onChange={(e) => setExecutor(e.target.value)}>
          {PERSONNEL.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>
      <label>Согласующий
        <select className="bpm-select" value={approver} onChange={(e) => setApprover(e.target.value)}>
          {PERSONNEL.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>
      <label>Срок <input type="date" className="bpm-input" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
      <label>Статус
        <select className="bpm-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          {['в работе', 'завершен', 'ошибка', 'пауза'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <div className="bpm-entries">
        <strong>Системы / Вход / Выход</strong>
        {entries.map((ent, i) => (
          <div key={i} className="bpm-entry-row">
            <input placeholder="Система" value={ent.system} onChange={(e) => updateEntry(i, 'system', e.target.value)} />
            <input placeholder="Вход" value={ent.input} onChange={(e) => updateEntry(i, 'input', e.target.value)} />
            <input placeholder="Выход" value={ent.output} onChange={(e) => updateEntry(i, 'output', e.target.value)} />
            <button type="button" className="bpm-btn-icon" onClick={() => removeEntry(i)}>✕</button>
          </div>
        ))}
        <button type="button" className="bpm-btn-sm" onClick={addEntry}>+ Строка</button>
      </div>
      <div className="bpm-edit-actions">
        <button type="button" className="bpm-btn-sm" onClick={handleSave}>Сохранить</button>
        <button type="button" className="bpm-btn-sm" onClick={onCancel}>Отмена</button>
        <button type="button" className="bpm-btn-sm bpm-btn-danger" onClick={onDelete}>Удалить</button>
      </div>
    </div>
  )
}

export default BPMBoard
