import React, { useMemo, useState } from 'react'
import { SCENARIO_STAGE_FILTERS, PERIOD_OPTIONS, generateScenarios, filterScenariosByPeriod, SCENARIO_DIRECTIONS } from '../data/scenariosData'
import './ScenariosList.css'

const ALL_SCENARIOS = generateScenarios()

const SUBCATEGORY_TITLES = ['Название подкатегории', 'Название подкатегории', 'Название подкатегории', 'Название подкатегории']

function scenarioDisplayName(name) {
  if (!name || typeof name !== 'string') return name
  return name.replace(/\s*\(раздел\s*"[^"]*"\)\s*$/i, '').trim() || name
}

function ScenariosList({ activeStageFilter, stageFilters: controlledFilters, onStageFilterToggle, onScenarioClick }) {
  const [internalFilters, setInternalFilters] = useState(() => SCENARIO_STAGE_FILTERS.reduce((acc, name) => ({ ...acc, [name]: true }), {}))
  const stageFilters = controlledFilters != null ? controlledFilters : internalFilters
  const setStageFilters = onStageFilterToggle != null ? (name) => onStageFilterToggle(name) : (name) => setInternalFilters((prev) => ({ ...prev, [name]: !prev[name] }))
  const [period, setPeriod] = useState('1m')
  const [customPeriod, setCustomPeriod] = useState('')
  const [collapsed, setCollapsed] = useState(() => SUBCATEGORY_TITLES.reduce((acc, t, i) => ({ ...acc, [i]: i !== 0 }), {}))
  const [directionFilter, setDirectionFilter] = useState(null)

  const effectiveFilters = useMemo(() => {
    const next = { ...stageFilters }
    if (activeStageFilter) {
      SCENARIO_STAGE_FILTERS.forEach((name) => { next[name] = name === activeStageFilter })
    }
    return next
  }, [stageFilters, activeStageFilter])

  const filteredByStage = useMemo(() => {
    const anyActive = Object.values(effectiveFilters).some(Boolean)
    if (!anyActive) return []
    return ALL_SCENARIOS.filter((s) => effectiveFilters[s.stageType])
  }, [effectiveFilters])

  const filteredByPeriod = useMemo(() => filterScenariosByPeriod(filteredByStage, period), [filteredByStage, period])
  const filteredScenarios = useMemo(() => {
    if (!directionFilter) return filteredByPeriod
    return filteredByPeriod.filter((s) => s.direction === directionFilter)
  }, [filteredByPeriod, directionFilter])

  return (
    <div className="scenarios-list">
      <h1 className="scenarios-title">Список сценариев</h1>

      <div className="scenarios-layout">
        <div className="scenarios-main">
      <div className="scenarios-toolbar">
        <div className="scenarios-toolbar-right">
          <span className="scenarios-capability-bar">Бизнес способности Разведки и добычи</span>
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
        <div className="scenarios-direction-grid">
          {SCENARIO_DIRECTIONS.map((dir) => (
            <button key={dir} type="button" className={`scenarios-direction-tile ${directionFilter === dir ? 'active' : ''}`} onClick={() => setDirectionFilter(directionFilter === dir ? null : dir)} title={dir}>
              {dir.length > 28 ? dir.slice(0, 27) + '…' : dir}
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
                    <th>Статус</th>
                    <th>Утвержден</th>
                    <th>Дата создания</th>
                    <th>Время расчета</th>
                    <th>Срок обновления</th>
                    <th>Автор</th>
                  </tr>
                </thead>
                <tbody>
                  {(idx === 0 ? filteredScenarios : []).map((row) => (
                    <tr key={row.id}>
                      <td>
                        <button type="button" className="scenarios-name-link" onClick={() => onScenarioClick?.(row)}>
                          {scenarioDisplayName(row.name)}
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
          )}
        </div>
      ))}
        </div>
      </div>
    </div>
  )
}

export default ScenariosList
