/**
 * Загрузка и выгрузка доски BPM в формате Excel (как в Streamlit app).
 */
import * as XLSX from 'xlsx'

const REQUIRED_COLUMNS = [
  'Этап Название', 'Карточка ID', 'Карточка Название', 'Исполнитель', 'Согласующий', 'Срок сдачи',
  'Статус', 'Дата создания', 'Используемые системы', 'Входные данные', 'Выходные данные',
]

const EXCEL_EPOCH = new Date(1899, 11, 30)

function serialToDate(serial) {
  if (serial == null || serial === '') return new Date()
  const n = Number(serial)
  if (Number.isNaN(n)) return new Date()
  const d = new Date(EXCEL_EPOCH)
  d.setDate(d.getDate() + n)
  return d
}

function dateToSerial(date) {
  const d = date instanceof Date ? date : new Date(date)
  return Math.floor((d - EXCEL_EPOCH) / (24 * 60 * 60 * 1000))
}

export function parseBoardFromExcel(arrayBuffer) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws)
  if (!rows.length) return { stages: [], tasks: {} }

  const first = rows[0]
  const missing = REQUIRED_COLUMNS.filter((c) => !(c in first))
  if (missing.length) throw new Error(`Не хватает колонок: ${missing.join(', ')}`)

  const stages = []
  const tasks = {}
  const seenStages = new Set()
  const seenTasks = {} // stage -> Set of card_id

  for (const row of rows) {
    let stage = row['Этап Название']
    if (stage == null || String(stage).trim() === '') continue
    stage = String(stage).trim()

    if (!seenStages.has(stage)) {
      seenStages.add(stage)
      stages.push(stage)
      tasks[stage] = []
      seenTasks[stage] = new Set()
    }

    let cardId = row['Карточка ID']
    if (cardId == null || String(cardId).trim() === '') continue
    cardId = String(cardId).trim()

    if (!seenTasks[stage].has(cardId)) {
      seenTasks[stage].add(cardId)
      const deadline = serialToDate(row['Срок сдачи'])
      tasks[stage].push({
        id: cardId,
        name: row['Карточка Название'] != null ? String(row['Карточка Название']).trim() : '',
        executor: row['Исполнитель'] != null ? String(row['Исполнитель']).trim() : '',
        approver: row['Согласующий'] != null ? String(row['Согласующий']).trim() : '',
        deadline: deadline,
        status: row['Статус'] != null ? String(row['Статус']).trim() : 'в работе',
        date: row['Дата создания'] != null ? String(row['Дата создания']) : '',
        entries: [],
      })
    }

    const task = tasks[stage].find((t) => t.id === cardId)
    let system = row['Используемые системы']
    if (system == null) system = ''
    else system = String(system).trim()
    if (system === '') continue
    const input = row['Входные данные'] != null ? String(row['Входные данные']).trim() : ''
    const output = row['Выходные данные'] != null ? String(row['Выходные данные']).trim() : ''
    task.entries.push({ system, input, output })
  }

  return { stages, tasks }
}

const COL_ALIASES = {
  'Этап Название': ['Этап Название', 'Этап', 'Название этапа', 'Stage'],
  'Карточка ID': ['Карточка ID', 'Карточка ID', 'ID', 'Card ID'],
  'Карточка Название': ['Карточка Название', 'Карточка', 'Название', 'Card Name'],
  'Исполнитель': ['Исполнитель', 'Executor'],
  'Согласующий': ['Согласующий', 'Approver'],
  'Срок сдачи': ['Срок сдачи', 'Срок', 'Deadline'],
  'Статус': ['Статус', 'Status'],
  'Дата создания': ['Дата создания', 'Дата', 'Date'],
  'Используемые системы': ['Используемые системы', 'Системы', 'Systems'],
  'Входные данные': ['Входные данные', 'Вход', 'Input'],
  'Выходные данные': ['Выходные данные', 'Выход', 'Output'],
}

function getCol(row, key) {
  const aliases = COL_ALIASES[key]
  for (const a of aliases) {
    if (row[a] !== undefined && row[a] !== null) return row[a]
  }
  return row[key]
}

export function parseBoardFromExcelLenient(arrayBuffer) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws)
  if (!rows.length) return { stages: [], tasks: {} }
  const first = rows[0]
  const keys = Object.keys(first)
  const stageKey = keys.find((k) => /этап|stage|название/i.test(k)) || keys[0]
  const cardIdKey = keys.find((k) => /id|карточка|card/i.test(k) && !/создан|date/i.test(k)) || keys[1] || keys[0]
  const cardNameKey = keys.find((k) => /название|name|карточка/i.test(k) && k !== stageKey) || keys[2] || cardIdKey
  const stages = []
  const tasks = {}
  const seenStages = new Set()
  const seenTasks = {}
  for (const row of rows) {
    let stage = row[stageKey]
    if (stage == null || String(stage).trim() === '') continue
    stage = String(stage).trim()
    if (!seenStages.has(stage)) {
      seenStages.add(stage)
      stages.push(stage)
      tasks[stage] = []
      seenTasks[stage] = new Set()
    }
    let cardId = row[cardIdKey]
    if (cardId == null || String(cardId).trim() === '') continue
    cardId = String(cardId).trim()
    if (!seenTasks[stage].has(cardId)) {
      seenTasks[stage].add(cardId)
      tasks[stage].push({
        id: cardId,
        name: (row[cardNameKey] != null ? String(row[cardNameKey]).trim() : '') || cardId,
        executor: '',
        approver: '',
        deadline: new Date(),
        status: 'в работе',
        date: '',
        entries: [],
      })
    }
  }
  return { stages, tasks }
}

export function generateBoardExcel(stages, tasks) {
  const rows = []
  for (const stage of stages) {
    for (const task of tasks[stage] || []) {
      if (task.entries && task.entries.length > 0) {
        for (const entry of task.entries) {
          rows.push({
            'Этап Название': stage,
            'Карточка ID': task.id,
            'Карточка Название': task.name,
            'Исполнитель': task.executor || '',
            'Согласующий': task.approver || '',
            'Срок сдачи': dateToSerial(task.deadline),
            'Статус': task.status || 'в работе',
            'Дата создания': task.date || '',
            'Используемые системы': entry.system || '',
            'Входные данные': entry.input || '',
            'Выходные данные': entry.output || '',
          })
        }
      } else {
        rows.push({
          'Этап Название': stage,
          'Карточка ID': task.id,
          'Карточка Название': task.name,
          'Исполнитель': task.executor || '',
          'Согласующий': task.approver || '',
          'Срок сдачи': dateToSerial(task.deadline),
          'Статус': task.status || 'в работе',
          'Дата создания': task.date || '',
          'Используемые системы': '',
          'Входные данные': '',
          'Выходные данные': '',
        })
      }
    }
  }
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Доска')
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
}

export function generateTemplateExcel() {
  const ws = XLSX.utils.json_to_sheet([], { header: REQUIRED_COLUMNS })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Шаблон')
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
}

export function generateOntologyExcel(edges) {
  const rows = edges.map(([a, b]) => ({ Узел_1: a, Узел_2: b }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Связи')
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
}
