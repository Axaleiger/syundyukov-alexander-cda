import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { BPM_STAGES, BPM_CARDS_BY_STAGE, PERSONNEL, cardMatchesHighlight, getInitialBoard } from '../data/bpmData'
import { parseBoardFromExcel, parseBoardFromExcelLenient, generateBoardExcel, generateTemplateExcel, generateOntologyExcel } from '../data/bpmExcel'
import './BPMBoard.css'

function toTask(card) {
  return {
    id: card.id,
    name: card.name,
    executor: PERSONNEL[0],
    approver: PERSONNEL[0],
    deadline: new Date(),
    status: 'в работе',
    date: new Date().toLocaleDateString('ru-RU'),
    entries: [{ system: '', input: '', output: '' }],
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
  return {
    nodeCount: g.nodes.length,
    edgeCount: g.edges.length,
    byType,
    avgByType,
    topNodes,
  }
}

function BPMBoard({ initialBoardId = 'hantos', selectedAssetName, highlightCardName, onClose }) {
  const boardData = useMemo(() => getInitialBoard(initialBoardId) || { stages: BPM_STAGES, tasks: initialTasks() }, [initialBoardId])
  const [stages, setStages] = useState(() => boardData.stages)
  const [tasks, setTasks] = useState(() => boardData.tasks)
  const [viewMode, setViewMode] = useState('Подробный вид')
  const [expanded, setExpanded] = useState({})
  const [editingTask, setEditingTask] = useState(null)
  const [editingStage, setEditingStage] = useState(null)
  const [stageNameEdit, setStageNameEdit] = useState('')
  const [dragged, setDragged] = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const [showCalculateView, setShowCalculateView] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [draggedStageIndex, setDraggedStageIndex] = useState(null)
  const [excelLoaded, setExcelLoaded] = useState(initialBoardId !== 'hantos')

  useEffect(() => {
    const data = getInitialBoard(initialBoardId)
    if (data) {
      setStages(data.stages)
      setTasks(data.tasks)
    }
    setExcelLoaded(initialBoardId !== 'hantos')
  }, [initialBoardId])

  useEffect(() => {
    if (initialBoardId !== 'hantos') return
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') + '/'
    const delayMs = 400
    const t1 = setTimeout(() => {
      fetch(`${base}hantos.xlsx`)
        .then((r) => r.ok ? r.arrayBuffer() : Promise.reject(new Error('Файл не найден')))
        .then((arrayBuffer) => {
          const doParse = () => {
            try {
              const { stages: s, tasks: t } = parseBoardFromExcel(arrayBuffer)
              setStages(s)
              setTasks(t)
            } catch {
              const { stages: s, tasks: t } = parseBoardFromExcelLenient(arrayBuffer)
              setStages(s)
              setTasks(t)
            }
            setUploadError(null)
            setExcelLoaded(true)
          }
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(doParse, { timeout: 800 })
          } else {
            setTimeout(doParse, 50)
          }
        })
        .catch(() => setExcelLoaded(true))
    }, delayMs)
    return () => clearTimeout(t1)
  }, [initialBoardId])

  const toggleExpanded = useCallback((key) => {
    setExpanded((e) => ({ ...e, [key]: !e[key] }))
  }, [])

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const { stages: s, tasks: t } = parseBoardFromExcel(ev.target.result)
        setStages(s)
        setTasks(t)
      } catch (err) {
        setUploadError(err.message || 'Ошибка загрузки')
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }, [])

  const handleDownloadBoard = useCallback(() => {
    const buf = generateBoardExcel(stages, tasks)
    downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'tasks_board.xlsx')
  }, [stages, tasks])

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
    const name = 'Новый этап'
    setStages((s) => [name, ...s])
    setTasks((t) => ({ ...t, [name]: [] }))
    setEditingStage(0)
    setStageNameEdit(name)
  }, [])

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
    const task = {
      id,
      name: 'Новая задача',
      executor: PERSONNEL[0],
      approver: PERSONNEL[0],
      deadline: new Date(),
      status: 'в работе',
      date: new Date().toLocaleDateString('ru-RU'),
      entries: [{ system: '', input: '', output: '' }],
    }
    setTasks((t) => ({ ...t, [stageName]: [...(t[stageName] || []), task] }))
    setEditingTask({ stageName, taskIdx: (tasks[stageName] || []).length })
  }, [tasks])

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

  const handleDrop = useCallback((e, targetStage) => {
    e.preventDefault()
    if (!dragged) return
    const { stageName: fromStage, taskIdx } = dragged
    const list = tasks[fromStage] || []
    const task = list[taskIdx]
    if (!task || fromStage === targetStage) {
      setDragged(null)
      return
    }
    setTasks((t) => {
      const next = { ...t }
      next[fromStage] = list.filter((_, i) => i !== taskIdx)
      next[targetStage] = [...(next[targetStage] || []), task]
      return next
    })
    setDragged(null)
  }, [dragged, tasks])

  const iterations = useMemo(() => {
    if (stages.length < 2) return []
    const stageWidth = 220
    const its = []
    const n = stages.length
    if (n >= 2) its.push({ label: '2 итерация', left: 20, width: Math.max(260, 2 * stageWidth - 100), color: '#4ECDC4', top: 20 })
    if (n >= 3) its.push({ label: '3 итерация', left: 20 + stageWidth, width: Math.max(300, 3 * stageWidth - 100), color: '#FFD166', top: 80 })
    if (n >= 2) its.push({ label: '2 итерация', left: Math.max(0, (n - 2) * stageWidth - 40), width: Math.max(260, 2 * stageWidth - 100), color: '#FF6B6B', top: 140 })
    return its
  }, [stages.length])

  const analytics = useMemo(() => computeAnalytics(stages, tasks), [stages, tasks])
  const oilFlowHtml = useMemo(() => generateOilFlowHtml(stages, tasks), [stages, tasks])

  if (initialBoardId === 'hantos' && !excelLoaded) {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') + '/'
    return (
      <div className="bpm-board-wrap bpm-loading-wrap">
        <img src={`${base}gif.gif`} alt="Загрузка…" className="bpm-loading-gif" />
        <div className="bpm-loading-text">Загрузка данных доски…</div>
      </div>
    )
  }

  if (showCalculateView) {
    return (
      <div className="bpm-board-wrap bpm-calculate-wrap">
        <div className="bpm-board-header">
          <h2>Рассчитать — граф и аналитика</h2>
          <button type="button" className="bpm-btn bpm-btn-primary" onClick={() => setShowCalculateView(false)}>Назад к доске</button>
        </div>
        <div className="bpm-calculate-layout">
          <div className="bpm-calculate-graph">
            <iframe title="OilFlow граф" srcDoc={oilFlowHtml} />
          </div>
          <div className="bpm-calculate-analytics">
            <h3>Аналитика графа</h3>
            <div className="bpm-analytics-row"><span>Узлов:</span> <strong>{analytics.nodeCount}</strong></div>
            <div className="bpm-analytics-row"><span>Рёбер:</span> <strong>{analytics.edgeCount}</strong></div>
            <h4>Узлы по типам</h4>
            <div className="bpm-analytics-row">Этап: <strong>{analytics.byType.Этап}</strong></div>
            <div className="bpm-analytics-row">Карточка: <strong>{analytics.byType.Карточка}</strong></div>
            <div className="bpm-analytics-row">Система: <strong>{analytics.byType.Система}</strong></div>
            <h4>Среднее связей по типу</h4>
            <div className="bpm-analytics-row">Этап: <strong>{analytics.avgByType.Этап}</strong></div>
            <div className="bpm-analytics-row">Карточка: <strong>{analytics.avgByType.Карточка}</strong></div>
            <div className="bpm-analytics-row">Система: <strong>{analytics.avgByType.Система}</strong></div>
            <h4>Топ узлов по степени</h4>
            <ul className="bpm-analytics-top">
              {analytics.topNodes.map(({ label, degree }, i) => (
                <li key={i}><span className="bpm-analytics-label">{label.length > 40 ? label.slice(0, 37) + '...' : label}</span> <strong>{degree}</strong></li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bpm-board-wrap">
      <div className="bpm-board-header">
        <h2>Планирование{selectedAssetName ? ` — ${selectedAssetName}` : ''}</h2>
        <div className="bpm-header-actions">
          <label className="bpm-upload-btn">
            Загрузить из Excel
            <input type="file" accept=".xlsx" onChange={handleFileUpload} hidden />
          </label>
          <button type="button" className="bpm-btn" onClick={handleDownloadBoard}>Выгрузить доску</button>
          <button type="button" className="bpm-btn" onClick={handleDownloadTemplate}>Шаблон</button>
          <button type="button" className="bpm-board-close" onClick={onClose}>Закрыть</button>
        </div>
      </div>
      {uploadError && <div className="bpm-error">{uploadError}</div>}
      <div className="bpm-toolbar">
        <input
          type="text"
          className="bpm-search"
          placeholder="Поиск по доске..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button type="button" className="bpm-btn" onClick={() => setShowFilters(!showFilters)}>
          {showFilters ? 'Скрыть фильтры' : 'Фильтры'}
        </button>
        <label className="bpm-radio">
          <input type="radio" name="view" checked={viewMode === 'Упрощенный вид'} onChange={() => setViewMode('Упрощенный вид')} />
          Упрощенный вид
        </label>
        <label className="bpm-radio">
          <input type="radio" name="view" checked={viewMode === 'Подробный вид'} onChange={() => setViewMode('Подробный вид')} />
          Подробный вид
        </label>
        <button type="button" className="bpm-btn bpm-btn-primary" onClick={() => setShowCalculateView(true)}>Рассчитать</button>
        <button type="button" className="bpm-btn bpm-btn-primary" onClick={addStage}>+ Добавить этап</button>
      </div>
      <div className="bpm-board" onDragOver={(e) => e.preventDefault()}>
        {stages.map((stageName, stageIdx) => (
          <div
            key={stageName}
            className={`bpm-stage-column ${draggedStageIndex === stageIdx ? 'bpm-stage-column-dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
            onDrop={(e) => { e.preventDefault(); if (draggedStageIndex != null) handleStageDrop(e, stageIdx); else handleDrop(e, stageName); }}
          >
            <div
              className="bpm-stage-header"
              draggable
              onDragStart={(e) => handleStageDragStart(e, stageIdx, stageName)}
              onDragEnd={() => setDraggedStageIndex(null)}
            >
              {editingStage === stageIdx ? (
                <>
                  <input value={stageNameEdit} onChange={(e) => setStageNameEdit(e.target.value)} className="bpm-input" />
                  <button type="button" className="bpm-btn-sm" onClick={saveStageEdit}>OK</button>
                </>
              ) : (
                <>
                  <span className="bpm-stage-title">{stageName}</span>
                  <div className="bpm-stage-btns">
                    <button type="button" className="bpm-btn-icon" onClick={() => { setEditingStage(stageIdx); setStageNameEdit(stageName) }} title="Редактировать">Ред.</button>
                    <button type="button" className="bpm-btn-icon" onClick={() => deleteStage(stageIdx)} title="Удалить">Удал.</button>
                  </div>
                </>
              )}
            </div>
            <div className="bpm-stage-cards">
              {(tasks[stageName] || []).map((task, taskIdx) => {
                const isHighlight = cardMatchesHighlight(task.name, highlightCardName)
                const key = `${stageIdx}-${taskIdx}`
                const isExp = viewMode === 'Подробный вид' || expanded[key]
                const isEdit = editingTask?.stageName === stageName && editingTask?.taskIdx === taskIdx
                return (
                  <div
                    key={task.id}
                    className={`bpm-card ${isHighlight ? 'bpm-card-highlight' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, stageName, taskIdx)}
                  >
                    <div className="bpm-card-head" onClick={() => toggleExpanded(key)}>
                      <span className="bpm-card-id">{task.id}</span>
                      <span className="bpm-card-name">{task.name}</span>
                    </div>
                    {isExp && (
                      <div className="bpm-card-body">
                        {isEdit ? (
                          <TaskEditForm
                            task={task}
                            onSave={(form) => saveTaskEdit(stageName, taskIdx, form)}
                            onCancel={() => setEditingTask(null)}
                            onDelete={() => deleteTask(stageName, taskIdx)}
                          />
                        ) : (
                          <>
                            <p><strong>Статус:</strong> <span style={{ color: task.status === 'завершен' ? 'green' : task.status === 'ошибка' ? 'red' : '#2d5a87' }}>{task.status}</span></p>
                            <p><strong>Срок:</strong> {task.deadline instanceof Date ? task.deadline.toLocaleDateString('ru-RU') : task.deadline}</p>
                            <p><strong>Исполнитель:</strong> {task.executor}</p>
                            <p><strong>Согласующий:</strong> {task.approver}</p>
                            {(task.entries || []).filter((e) => e.system).length > 0 && (
                              <p><strong>Системы:</strong> {(task.entries || []).filter((e) => e.system).map((e) => e.system).join(', ')}</p>
                            )}
                            <button type="button" className="bpm-btn-sm" onClick={() => setEditingTask({ stageName, taskIdx })}>Редактировать</button>
                            <button type="button" className="bpm-btn-sm bpm-btn-danger" onClick={() => deleteTask(stageName, taskIdx)}>Удалить</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <button type="button" className="bpm-add-task" onClick={() => addTask(stageName)}>+ Добавить задачу</button>
          </div>
        ))}
      </div>
      {iterations.length > 0 && (
        <div className="bpm-iterations">
          <h4>Итерации</h4>
          {iterations.map((it, i) => (
            <div key={i} className="bpm-iteration-bar" style={{ left: it.left, width: it.width, top: it.top, background: it.color }}>{it.label}</div>
          ))}
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
