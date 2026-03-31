import React from 'react'
import {
  kpiRows,
  recommendations,
  SCENARIO_BRANCH_COUNT,
  OPTIMAL_SCENARIO_VARIANT,
} from '../lib/scenarioGraphData'

function DashboardIconRow({ icon, children }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center"
        aria-hidden
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-100 px-4 py-4">
        {children}
      </div>
    </div>
  )
}

function NumberedRecommendationList({ items }) {
  return (
    <ul className="m-0 list-none space-y-2 p-0 text-xs leading-relaxed text-slate-700">
      {items.map((item, i) => (
        <li key={item} className="flex gap-2">
          <span className="w-6 shrink-0 pt-px text-right tabular-nums text-slate-500">{i + 1}.</span>
          <span className="min-w-0 break-words">{item}</span>
        </li>
      ))}
    </ul>
  )
}

function ScenarioAnalysisDashboard({ visible = false }) {
  const metricMeta = {
    NPV: { label: 'Чистая приведённая стоимость портфеля (NPV)', higherIsGood: true },
    IRR: { label: 'Внутренняя норма доходности проекта (IRR)', higherIsGood: true },
    PI: { label: 'Индекс прибыльности (PI)', higherIsGood: true },
    DPP: { label: 'Дисконтированный срок окупаемости (DPP)', higherIsGood: false },
    CAPEX: { label: 'Капитальные затраты (CAPEX)', higherIsGood: false },
    OPEX: { label: 'Операционные затраты (OPEX)', higherIsGood: false },
  }

  const checkIcon = (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700">
      ✓
    </div>
  )

  const chartIcon = (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200/70 text-slate-700">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19V5" />
        <path d="M4 19H20" />
        <path d="M8 15l2-2 3 3 6-8" />
      </svg>
    </span>
  )

  return (
    <section
      className={`grid gap-4 transition-all duration-700 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <DashboardIconRow icon={checkIcon}>
        <p className="m-0 text-sm font-semibold text-slate-700">
          Проанализировано {SCENARIO_BRANCH_COUNT} сценариев. Оптимальный — Вариант {OPTIMAL_SCENARIO_VARIANT}
        </p>
      </DashboardIconRow>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-slate-100 p-4 transition-colors duration-200 hover:bg-slate-200/80">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-8 w-1 shrink-0 rounded-full bg-emerald-400" />
            <h5 className="text-sm font-semibold text-emerald-800">Ввод новых скважин/Зарезка боковых стволов скважин</h5>
          </div>
          <NumberedRecommendationList items={recommendations.vnsZbs} />
        </article>

        <article className="rounded-lg border border-slate-200 bg-slate-100 p-4 transition-colors duration-200 hover:bg-slate-200/80">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-8 w-1 shrink-0 rounded-full bg-sky-400" />
            <h5 className="text-sm font-semibold text-sky-800">Геолого-технические мероприятия</h5>
          </div>
          <NumberedRecommendationList items={recommendations.gtm} />
        </article>
      </div>

      <DashboardIconRow icon={chartIcon}>
        <p className="m-0 text-sm font-semibold text-slate-700">Ключевые показатели эффективности</p>
      </DashboardIconRow>

      <div className="rounded-lg border border-slate-200 bg-slate-100 p-4">
        <div className="space-y-2">
          {kpiRows.map((row) => {
            const meta = metricMeta[row.metric] || { label: row.metric, higherIsGood: true }
            const isPositiveDelta = String(row.delta || '').trim().startsWith('+')
            const isGood = isPositiveDelta ? meta.higherIsGood : !meta.higherIsGood
            const deltaClass = isGood ? 'text-emerald-700' : 'text-rose-700'

            return (
              <div
                key={row.metric}
                className="grid grid-cols-[minmax(0,1fr)_minmax(6.5rem,auto)_minmax(5.5rem,auto)] items-center gap-x-3 rounded-lg border border-slate-200/80 bg-white/30 px-3 py-2"
              >
                <div className="min-w-0 break-words font-medium text-slate-800">{meta.label}</div>
                <div className="text-right font-semibold tabular-nums text-slate-700">{row.value}</div>
                <div className={`text-right font-semibold tabular-nums ${deltaClass}`}>{row.delta}</div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default ScenarioAnalysisDashboard
