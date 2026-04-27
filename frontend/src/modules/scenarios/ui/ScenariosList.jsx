import React, { useMemo, useState } from "react"
import { useRepositories } from '../../../app/providers/DataRepositoriesProvider'
import { useScenariosData } from '../model/useScenariosData'
import { API_V1_PREFIX, apiFetch } from "../../../core/data/repositories/http/httpClient.js"
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

  const [savingScenarioId, setSavingScenarioId] = useState(null)
  const [scenarioSaveError, setScenarioSaveError] = useState(null)
  const [formMode, setFormMode] = useState(null) // 'create' | 'edit' | null
  const [editingRow, setEditingRow] = useState(null)
  const [formData, setFormData] = useState({
    name: "",
    authorName: "",
  })

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
  const canCreateScenario = typeof scenariosRepo.createScenario === "function"
  const canDeleteScenario = typeof scenariosRepo.deleteScenario === "function"

  const resetForm = () => {
    setFormMode(null)
    setEditingRow(null)
    setScenarioSaveError(null)
    setFormData({
      name: "",
      authorName: "",
    })
  }

  const openCreateScenario = () => {
    if (!canCreateScenario) return
    setFormMode("create")
    setEditingRow(null)
    setScenarioSaveError(null)
    setFormData({
      name: "",
      authorName: "",
    })
  }

  const openEditScenario = (row) => {
    if (!row?.scenarioId || !canPatchScenario) return
    setFormMode("edit")
    setEditingRow(row)
    setScenarioSaveError(null)
    setFormData({
      name: row.name || "",
      authorName: row.author || "",
    })
  }

  const saveScenario = async () => {
    if (savingScenarioId) return
    const trimmedName = formData.name.trim()
    if (!trimmedName) {
      setScenarioSaveError("Введите название сценария")
      return
    }
    const payload = {
      name: trimmedName,
      authorName: formData.authorName.trim() || null,
    }
    setScenarioSaveError(null)
    setSavingScenarioId(formMode === "edit" ? editingRow?.scenarioId : "new")
    try {
      if (formMode === "create") {
        const created = await scenariosRepo.createScenario(payload)
        const createdScenarioId = created?.id ? String(created.id) : null
        if (createdScenarioId) {
          await apiFetch(`${API_V1_PREFIX}/planning/cases`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scenarioId: createdScenarioId,
              assetId: created.assetId || null,
            }),
          })
          onScenarioClick?.({
            name: trimmedName,
            scenarioId: createdScenarioId,
          })
        }
      } else if (formMode === "edit" && editingRow?.scenarioId) {
        await scenariosRepo.patchScenario(editingRow.scenarioId, payload)
      }
      await refetchScenarios()
      resetForm()
    } catch (e) {
      setScenarioSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingScenarioId(null)
    }
  }

  const removeScenario = async (row) => {
    if (!canDeleteScenario || !row?.scenarioId) return
    const ok = window.confirm(
      `Удалить сценарий "${row.name}" и связанные кейсы планирования безвозвратно?`,
    )
    if (!ok) return
    setScenarioSaveError(null)
    setSavingScenarioId(row.scenarioId)
    try {
      await scenariosRepo.deleteScenario(row.scenarioId)
      await refetchScenarios()
    } catch (e) {
      setScenarioSaveError(e instanceof Error ? e.message : String(e))
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
          <button
            type="button"
            className="scenarios-create-btn"
            onClick={openCreateScenario}
            disabled={!canCreateScenario}
            title={
              canCreateScenario
                ? "Создать сценарий"
                : "Создание доступно только в API-режиме"
            }
          >
            Создать сценарий
          </button>
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
                          <div className="scenarios-name-cell">
                            <button type="button" className="scenarios-name-link" onClick={() => onScenarioClick?.(row)}>
                              {scenarioDisplayName(row.name)}
                            </button>
                            {canPatchScenario && row.scenarioId && (
                              <button
                                type="button"
                                className="scenarios-edit-name"
                                title="Редактировать сценарий"
                                aria-label="Редактировать сценарий"
                                onClick={() => openEditScenario(row)}
                              >
                                ✎
                              </button>
                            )}
                            {canDeleteScenario && row.scenarioId && (
                              <button
                                type="button"
                                className="scenarios-delete"
                                title="Удалить сценарий"
                                aria-label="Удалить сценарий"
                                disabled={savingScenarioId === row.scenarioId}
                                onClick={() => {
                                  void removeScenario(row)
                                }}
                              >
                                🗑
                              </button>
                            )}
                          </div>
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
      {formMode && (
        <div className="scenarios-modal-backdrop" role="dialog" aria-modal="true">
          <div className="scenarios-modal">
            <h3 className="scenarios-modal-title">
              {formMode === "create" ? "Создать сценарий" : "Редактировать сценарий"}
            </h3>
            <label className="scenarios-form-row">
              <span>Название</span>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Введите название сценария"
              />
            </label>
            <label className="scenarios-form-row">
              <span>Автор</span>
              <input
                type="text"
                value={formData.authorName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, authorName: e.target.value }))
                }
                placeholder="Введите автора вручную"
              />
            </label>
            {scenarioSaveError && (
              <div className="scenarios-name-save-error" role="alert">
                {scenarioSaveError}
              </div>
            )}
            <div className="scenarios-form-actions">
              <button
                type="button"
                className="scenarios-name-save-btn"
                onClick={() => {
                  void saveScenario()
                }}
                disabled={Boolean(savingScenarioId)}
              >
                {formMode === "create" ? "Создать" : "Сохранить"}
              </button>
              <button
                type="button"
                className="scenarios-name-cancel-btn"
                onClick={resetForm}
                disabled={Boolean(savingScenarioId)}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ScenariosList
