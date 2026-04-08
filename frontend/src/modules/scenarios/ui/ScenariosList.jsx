import React, { useMemo, useState } from 'react'
import { useRepositories } from '../../../app/providers/DataRepositoriesProvider'
import { useScenariosData } from '../model/useScenariosData'
import './ScenariosList.css'

const SUBCATEGORY_TITLES = ['Название подкатегории', 'Название подкатегории', 'Название подкатегории', 'Название подкатегории']

function scenarioDisplayName(name) {
  if (!name || typeof name !== 'string') return name
  return name.replace(/\s*\(раздел\s*"[^"]*"\)\s*$/i, '').trim() || name
}

function ScenariosList({ activeStageFilter, stageFilters: controlledFilters, onStageFilterToggle, onScenarioClick }) {
  const { scenarios: scenariosRepo } = useRepositories()
  const {
    scenarioStageFilters: SCENARIO_STAGE_FILTERS,
    periodOptions: PERIOD_OPTIONS,
    scenarioDirections: SCENARIO_DIRECTIONS,
    allScenarios: ALL_SCENARIOS,
    filterScenariosByPeriod,
    scenariosLoading,
    scenariosError,
    refetchScenarios,
  } = useScenariosData()

  const [editingScenarioId, setEditingScenarioId] = useState(null)
  const [editNameValue, setEditNameValue] = useState('')
  const [editNameBaseline, setEditNameBaseline] = useState('')
  const [savingScenarioId, setSavingScenarioId] = useState(null)
  const [nameSaveError, setNameSaveError] = useState(null)

  const [internalFilters, setInternalFilters] = useState(() => SCENARIO_STAGE_FILTERS.reduce((acc, name) => ({ ...acc, [name]: true }), {}))
  const stageFilters = controlledFilters != null ? controlledFilters : internalFilters
  const setStageFilters = onStageFilterToggle != null ? (name) => onStageFilterToggle(name) : (name) => setInternalFilters((prev) => ({ ...prev, [name]: !prev[name] }))
  const [period, setPeriod] = useState('1m')
  const [customPeriod, setCustomPeriod] = useState('')
  const [collapsed, setCollapsed] = useState(() => SUBCATEGORY_TITLES.reduce((acc, t, i) => ({ ...acc, [i]: i !== 0 }), {}))
  const [directionFilter, setDirectionFilter] = useState(null) // выбор подраздела без фильтрации таблицы

  const effectiveFilters = useMemo(() => {
    const next = { ...stageFilters }
    if (activeStageFilter) {
      SCENARIO_STAGE_FILTERS.forEach((name) => { next[name] = name === activeStageFilter })
    }
    return next
  }, [stageFilters, activeStageFilter])

  const filteredByStage = useMemo(() => {
    const anyOn = Object.keys(effectiveFilters).some((k) => effectiveFilters[k])
    if (!anyOn) return ALL_SCENARIOS
    return ALL_SCENARIOS.filter((s) => {
      const sel = effectiveFilters[s.stageType]
      if (sel === undefined) return true
      return Boolean(sel)
    })
  }, [effectiveFilters, ALL_SCENARIOS])

  const filteredByPeriod = useMemo(
    () => filterScenariosByPeriod(filteredByStage, period),
    [filteredByStage, period, filterScenariosByPeriod],
  )
  const filteredScenarios = useMemo(() => filteredByPeriod, [filteredByPeriod])

  const canPatchScenario = typeof scenariosRepo.patchScenario === 'function'

  const startEditName = (row) => {
    if (!row?.scenarioId || !canPatchScenario) return
    setNameSaveError(null)
    setEditingScenarioId(row.scenarioId)
    setEditNameBaseline(row.name || '')
    setEditNameValue(row.name || '')
  }

  const cancelEditName = () => {
    setEditingScenarioId(null)
    setEditNameValue('')
    setEditNameBaseline('')
    setNameSaveError(null)
  }

  const commitEditName = async () => {
    if (!editingScenarioId || !canPatchScenario) return
    if (savingScenarioId) return
    const trimmed = editNameValue.trim()
    if (!trimmed) {
      setNameSaveError('Введите непустое название')
      return
    }
    if (trimmed === (editNameBaseline || '').trim()) {
      cancelEditName()
      return
    }
    setNameSaveError(null)
    setSavingScenarioId(editingScenarioId)
    try {
      await scenariosRepo.patchScenario(editingScenarioId, { name: trimmed })
      cancelEditName()
      await refetchScenarios()
    } catch (e) {
      setNameSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingScenarioId(null)
    }
  }

  return (
    <div className="scenarios-list">
      <h1 className="scenarios-title">Список сценариев</h1>
      {scenariosError && (
        <div className="scenarios-api-error" role="alert">
          Не удалось загрузить сценарии: {scenariosError}
        </div>
      )}

      <div className="scenarios-layout">
        <div className="scenarios-main">
      <div className="scenarios-toolbar">
        <div className="scenarios-toolbar-right">
          <select
            className="scenarios-period-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {period === 'custom' && (
            <input
              type="text"
              className="scenarios-custom-period"
              placeholder="Настраиваемый период"
              value={customPeriod}
              onChange={(e) => setCustomPeriod(e.target.value)}
            />
          )}
          <button type="button" className="scenarios-create-btn">Создать сценарий</button>
        </div>
      </div>

      <div className="scenarios-direction-grid-wrap">
        <div className="scenarios-capability-bar">Бизнес способности Разведки и добычи</div>
        <div className="scenarios-direction-grid">
          {SCENARIO_DIRECTIONS.map((dir) => (
            <button key={dir} type="button" className={`scenarios-direction-tile ${directionFilter === dir ? 'active' : ''}`} onClick={() => setDirectionFilter(directionFilter === dir ? null : dir)} title={dir}>
              {dir}
            </button>
          ))}
        </div>
      </div>

      {SUBCATEGORY_TITLES.map((title, idx) => (
        <div key={idx} className="scenarios-subcategory">
          <h2 className="scenarios-subcategory-title" onClick={() => setCollapsed((c) => ({ ...c, [idx]: !c[idx] }))} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setCollapsed((c) => ({ ...c, [idx]: !c[idx] }))}>
            <span className={`scenarios-subcategory-chevron ${collapsed[idx] ? 'collapsed' : ''}`}>▾</span>
            {title}
          </h2>
          {!collapsed[idx] && (
            <div className="scenarios-table-wrap">
              <table className="scenarios-table">
                <thead>
                  <tr>
                    <th>Название сценария</th>
                    <th>ID сценария</th>
                    <th>Этапы</th>
                    <th>ДО</th>
                    <th>Месторождение</th>
                    <th>Направление бизнеса</th>
                    <th>Статус</th>
                    <th>Утвержден</th>
                    <th>Дата создания</th>
                    <th>Время расчета</th>
                    <th>Срок обновления</th>
                    <th>Автор</th>
                  </tr>
                </thead>
                <tbody>
                  {idx === 0 && scenariosLoading && (
                    <tr>
                      <td colSpan={12}>Загрузка…</td>
                    </tr>
                  )}
                  {(idx === 0 ? filteredScenarios : []).map((row) => (
                    <tr key={row.id}>
                      <td>
                        {editingScenarioId === row.scenarioId ? (
                          <div className="scenarios-name-edit">
                            <input
                              type="text"
                              className="scenarios-name-input"
                              value={editNameValue}
                              disabled={savingScenarioId === row.scenarioId}
                              onChange={(e) => setEditNameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  void commitEditName()
                                }
                                if (e.key === 'Escape') {
                                  e.preventDefault()
                                  cancelEditName()
                                }
                              }}
                              autoFocus
                              aria-label="Название сценария"
                            />
                            <div className="scenarios-name-edit-actions">
                              <button
                                type="button"
                                className="scenarios-name-save-btn"
                                disabled={savingScenarioId === row.scenarioId}
                                onClick={() => { void commitEditName() }}
                              >
                                Готово
                              </button>
                              <button
                                type="button"
                                className="scenarios-name-cancel-btn"
                                disabled={savingScenarioId === row.scenarioId}
                                onClick={cancelEditName}
                              >
                                Отмена
                              </button>
                            </div>
                            {nameSaveError && editingScenarioId === row.scenarioId && (
                              <span className="scenarios-name-save-error" role="alert">{nameSaveError}</span>
                            )}
                          </div>
                        ) : (
                          <div className="scenarios-name-cell">
                            <button type="button" className="scenarios-name-link" onClick={() => onScenarioClick?.(row)}>
                              {scenarioDisplayName(row.name)}
                            </button>
                            {canPatchScenario && row.scenarioId && (
                              <button
                                type="button"
                                className="scenarios-edit-name"
                                title="Изменить название"
                                aria-label="Изменить название"
                                onClick={() => startEditName(row)}
                              >
                                ✎
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td>{row.id}</td>
                      <td>{row.stages}</td>
                      <td>{row.do}</td>
                      <td>{row.field}</td>
                      <td>{row.direction || '—'}</td>
                      <td>{row.status}</td>
                      <td>{row.approved ? '✓' : '✗'}</td>
                      <td>{row.dateCreated}</td>
                      <td>{row.timeCalc}</td>
                      <td>{row.dateUpdated}</td>
                      <td>{row.author}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
        </div>
      </div>
    </div>
  )
}

export default ScenariosList
