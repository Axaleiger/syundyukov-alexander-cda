import React, { useMemo, useState } from 'react'
import { SCENARIO_STAGE_FILTERS, PERIOD_OPTIONS, generateScenarios } from '../data/scenariosData'
import './ScenariosList.css'

const ALL_SCENARIOS = generateScenarios()

function ScenariosList({ activeStageFilter, stageFilters: controlledFilters, onStageFilterToggle, onScenarioClick }) {
  const [internalFilters, setInternalFilters] = useState(() => SCENARIO_STAGE_FILTERS.reduce((acc, name) => ({ ...acc, [name]: true }), {}))
  const stageFilters = controlledFilters != null ? controlledFilters : internalFilters
  const setStageFilters = onStageFilterToggle != null ? (name) => onStageFilterToggle(name) : (name) => setInternalFilters((prev) => ({ ...prev, [name]: !prev[name] }))
  const [period, setPeriod] = useState('1m')
  const [customPeriod, setCustomPeriod] = useState('')

  const effectiveFilters = useMemo(() => {
    const next = { ...stageFilters }
    if (activeStageFilter) {
      SCENARIO_STAGE_FILTERS.forEach((name) => { next[name] = name === activeStageFilter })
    }
    return next
  }, [stageFilters, activeStageFilter])

  const filteredScenarios = useMemo(() => {
    const anyActive = Object.values(effectiveFilters).some(Boolean)
    if (!anyActive) return []
    return ALL_SCENARIOS.filter((s) => effectiveFilters[s.stageType])
  }, [effectiveFilters])

  return (
    <div className="scenarios-list">
      <h1 className="scenarios-title">Список сценариев</h1>

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
          <div className="scenarios-user">
            <span className="scenarios-user-name">Сюндюков А.В. · Ведущий эксперт</span>
            <img src={`${import.meta.env.BASE_URL || '/'}emblem.png`} alt="" className="scenarios-user-avatar" />
          </div>
        </div>
      </div>

      <button type="button" className="scenarios-create-btn">Создать сценарий</button>

      <div className="scenarios-subcategory">
        <h2 className="scenarios-subcategory-title">Название подкатегории</h2>
        <div className="scenarios-table-wrap">
          <table className="scenarios-table">
            <thead>
              <tr>
                <th>Название сценария</th>
                <th>ID сценария</th>
                <th>Этапы</th>
                <th>ДО</th>
                <th>Месторождение</th>
                <th>Статус</th>
                <th>Утвержден</th>
                <th>Дата создания</th>
                <th>Время расчета</th>
                <th>Срок обновления</th>
                <th>Автор</th>
              </tr>
            </thead>
            <tbody>
              {filteredScenarios.map((row) => (
                <tr key={row.id}>
                  <td>
                    <button
                      type="button"
                      className="scenarios-name-link"
                      onClick={() => onScenarioClick?.(row)}
                    >
                      {row.name}
                    </button>
                  </td>
                  <td>{row.id}</td>
                  <td>{row.stages}</td>
                  <td>{row.do}</td>
                  <td>{row.field}</td>
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
      </div>
        </div>
      </div>
    </div>
  )
}

export default ScenariosList
