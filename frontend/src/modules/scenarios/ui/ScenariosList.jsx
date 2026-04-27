import React, { useCallback, useEffect, useMemo, useState } from "react"
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
  const [users, setUsers] = useState([])
  const [assets, setAssets] = useState([])
  const [stageOptions, setStageOptions] = useState([])
  const [directionOptions, setDirectionOptions] = useState([])
  const [lookupsLoading, setLookupsLoading] = useState(false)
  const [lookupsError, setLookupsError] = useState(null)
  const [formData, setFormData] = useState({
    name: "",
    status: "в работе",
    productionStageId: "",
    businessDirectionId: "",
    assetId: "",
    authorUserId: "",
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

  const resetForm = useCallback(() => {
    setFormMode(null)
    setEditingRow(null)
    setScenarioSaveError(null)
    setFormData({
      name: "",
      status: "в работе",
      productionStageId: "",
      businessDirectionId: "",
      assetId: "",
      authorUserId: "",
    })
  }, [])

  const ensureLookups = useCallback(async () => {
    if (lookupsLoading) return
    setLookupsLoading(true)
    setLookupsError(null)
    try {
      const [usersResp, assetsResp, stagesResp, directionsResp] = await Promise.all([
        apiFetch(`${API_V1_PREFIX}/users?limit=200`),
        apiFetch(`${API_V1_PREFIX}/assets`),
        apiFetch(`${API_V1_PREFIX}/taxonomy/production-stages`),
        apiFetch(`${API_V1_PREFIX}/taxonomy/business-directions`),
      ])
      setUsers(Array.isArray(usersResp) ? usersResp : [])
      setAssets(Array.isArray(assetsResp) ? assetsResp : [])
      setStageOptions(Array.isArray(stagesResp) ? stagesResp : [])
      setDirectionOptions(Array.isArray(directionsResp) ? directionsResp : [])
    } catch (e) {
      setLookupsError(e instanceof Error ? e.message : String(e))
    } finally {
      setLookupsLoading(false)
    }
  }, [lookupsLoading])

  useEffect(() => {
    if (!formMode) return
    void ensureLookups()
  }, [formMode, ensureLookups])

  const openCreateScenario = () => {
    if (!canCreateScenario) return
    setFormMode("create")
    setEditingRow(null)
    setScenarioSaveError(null)
    setFormData({
      name: "",
      status: "в работе",
      productionStageId: stageOptions[0]?.id ? String(stageOptions[0].id) : "",
      businessDirectionId: "",
      assetId: assets[0]?.id ? String(assets[0].id) : "",
      authorUserId: users[0]?.id ? String(users[0].id) : "",
    })
  }

  const openEditScenario = (row) => {
    if (!row?.scenarioId || !canPatchScenario) return
    setFormMode("edit")
    setEditingRow(row)
    setScenarioSaveError(null)
    setFormData({
      name: row.name || "",
      status: row.status || "в работе",
      productionStageId: row.productionStageId || "",
      businessDirectionId: row.businessDirectionId || "",
      assetId: row.assetId || "",
      authorUserId: row.authorUserId || "",
    })
  }

  const saveScenario = async () => {
    if (savingScenarioId) return
    const trimmedName = formData.name.trim()
    if (!trimmedName) {
      setScenarioSaveError("Введите название сценария")
      return
    }
    if (!formData.productionStageId) {
      setScenarioSaveError("Выберите этап производства")
      return
    }
    if (!formData.assetId) {
      setScenarioSaveError("Выберите месторождение")
      return
    }
    const payload = {
      name: trimmedName,
      status: formData.status?.trim() || "в работе",
      productionStageId: formData.productionStageId || null,
      businessDirectionId: formData.businessDirectionId || null,
      assetId: formData.assetId || null,
      authorUserId: formData.authorUserId || null,
      isApproved: false,
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
              assetId: formData.assetId,
              createdByUserId: formData.authorUserId || null,
              updatedByUserId: formData.authorUserId || null,
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
            {lookupsError && (
              <div className="scenarios-api-error" role="alert">
                Ошибка загрузки справочников: {lookupsError}
              </div>
            )}
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
              <select
                value={formData.authorUserId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, authorUserId: e.target.value }))
                }
                disabled={lookupsLoading}
              >
                <option value="">Не выбран</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="scenarios-form-row">
              <span>Месторождение</span>
              <select
                value={formData.assetId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, assetId: e.target.value }))
                }
                disabled={lookupsLoading}
              >
                <option value="">Выберите месторождение</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="scenarios-form-row">
              <span>Этап</span>
              <select
                value={formData.productionStageId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, productionStageId: e.target.value }))
                }
                disabled={lookupsLoading}
              >
                <option value="">Выберите этап</option>
                {stageOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.labelFull}
                  </option>
                ))}
              </select>
            </label>
            <label className="scenarios-form-row">
              <span>Направление</span>
              <select
                value={formData.businessDirectionId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, businessDirectionId: e.target.value }))
                }
                disabled={lookupsLoading}
              >
                <option value="">Не выбрано</option>
                {directionOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="scenarios-form-row">
              <span>Статус</span>
              <input
                type="text"
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                placeholder="в работе"
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
