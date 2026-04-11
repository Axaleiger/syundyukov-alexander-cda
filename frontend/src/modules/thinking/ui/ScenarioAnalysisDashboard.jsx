import React from 'react'
import {
  kpiRows,
  recommendations,
  SCENARIO_BRANCH_COUNT,
  OPTIMAL_SCENARIO_VARIANT,
} from '../lib/scenarioGraphData'

function DashboardIconRow({ icon, children, isNewDemo = false }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center"
        aria-hidden
      >
        {icon}
      </div>
      <div
        className={`min-w-0 flex-1 rounded-lg ${isNewDemo ? "border border-sky-400/35 bg-slate-900/35" : "border border-slate-200 bg-slate-100"}`}
        style={{ padding: "5px 10px" }}
      >
        {children}
      </div>
    </div>
  )
}

function NumberedRecommendationList({ items, isNewDemo = false }) {
  return (
    <ul
      className={`m-0 list-none p-0 leading-relaxed ${
        isNewDemo ? "space-y-1.5 text-[13px] text-slate-300/95" : "space-y-2 text-xs text-slate-700"
      }`}
    >
      {items.map((item, i) => (
        <li key={item} className="flex items-start gap-2">
          <span
            className={`w-6 shrink-0 pt-px text-right tabular-nums ${
              isNewDemo ? "text-sky-200/70" : "text-slate-500"
            }`}
          >
            {i + 1}.
          </span>
          <span className={`min-w-0 ${isNewDemo ? "wrap-break-word" : "wrap-break-word"}`}>{item}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * @param {{ title: string, bullets: string[] } | null} [primaryCard]
 * @param {{ title: string, bullets: string[] } | null} [secondaryCard]
 * @param {typeof kpiRows} [kpiRowsData]
 */
function ScenarioAnalysisDashboard({
  visible = false,
  isNewDemo = false,
  scenarioBranchCount = SCENARIO_BRANCH_COUNT,
  optimalVariant = OPTIMAL_SCENARIO_VARIANT,
  primaryCard = null,
  secondaryCard = null,
  kpiRowsData = null,
}) {
  const metricMeta = {
    NPV: { label: 'Чистая приведённая стоимость портфеля (NPV)', higherIsGood: true },
    IRR: { label: 'Внутренняя норма доходности проекта (IRR)', higherIsGood: true },
    PI: { label: 'Индекс прибыльности (PI)', higherIsGood: true },
    DPP: { label: 'Дисконтированный срок окупаемости (DPP)', higherIsGood: false },
    CAPEX: { label: 'Капитальные затраты (CAPEX)', higherIsGood: false },
    OPEX: { label: 'Операционные затраты (OPEX)', higherIsGood: false },
  }

  const pCard = primaryCard ?? {
    title: 'Ввод новых скважин/Зарезка боковых стволов скважин',
    bullets: recommendations.vnsZbs,
  }
  const sCard = secondaryCard ?? {
    title: 'Геолого-технические мероприятия',
    bullets: recommendations.gtm,
  }
  const rows = kpiRowsData ?? kpiRows

  const checkIcon = (
    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isNewDemo ? "bg-sky-400/20 text-sky-200" : "bg-emerald-500/15 text-emerald-700"}`}>
      ✓
    </div>
  )

  const chartIcon = (
    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${isNewDemo ? "bg-slate-800/65 text-sky-200" : "bg-slate-200/70 text-slate-700"}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19V5" />
        <path d="M4 19H20" />
        <path d="M8 15l2-2 3 3 6-8" />
      </svg>
    </span>
  )

  return (
    <section
      className={`grid gap-4 transition-all duration-700 p-2  ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <DashboardIconRow icon={checkIcon} isNewDemo={isNewDemo}>
        <p className={`m-0 text-sm font-semibold leading-5 ${isNewDemo ? "text-slate-100" : "text-slate-700"}`}>
          Проанализировано {scenarioBranchCount} сценариев. Оптимальный — Вариант {optimalVariant}
        </p>
      </DashboardIconRow>

      <div className={`grid ${isNewDemo ? "gap-3" : "gap-4"} md:grid-cols-2`}>
        <article className={`rounded-lg border transition-colors duration-200 ${isNewDemo ? "border-sky-400/30 bg-slate-900/35 p-4 hover:bg-slate-900/55" : "border-slate-200 bg-slate-100 p-4 hover:bg-slate-200/80"}`}>
          <div className={`flex items-start gap-2 ${isNewDemo ? "mb-2.5" : "mb-3"}`}>
            <span className="h-8 w-1 shrink-0 rounded-full bg-emerald-400" />
            <h5 className={`text-sm font-semibold leading-5 ${isNewDemo ? "text-slate-100" : "text-emerald-800"}`}>{pCard.title}</h5>
          </div>
          <NumberedRecommendationList items={pCard.bullets} isNewDemo={isNewDemo} />
        </article>

        <article className={`rounded-lg border transition-colors duration-200 ${isNewDemo ? "border-sky-400/30 bg-slate-900/35 p-4 hover:bg-slate-900/55" : "border-slate-200 bg-slate-100 p-4 hover:bg-slate-200/80"}`}>
          <div className={`flex items-start gap-2 ${isNewDemo ? "mb-2.5" : "mb-3"}`}>
            <span className="h-8 w-1 shrink-0 rounded-full bg-sky-400" />
            <h5 className={`text-sm font-semibold leading-5 ${isNewDemo ? "text-slate-100" : "text-sky-800"}`}>{sCard.title}</h5>
          </div>
          <NumberedRecommendationList items={sCard.bullets} isNewDemo={isNewDemo} />
        </article>
      </div>

      <DashboardIconRow icon={chartIcon} isNewDemo={isNewDemo}>
        <p className={`m-0 text-sm font-semibold ${isNewDemo ? "text-slate-100" : "text-slate-700"}`}>Ключевые показатели эффективности</p>
      </DashboardIconRow>

      <div className={`rounded-lg border ${isNewDemo ? "border-sky-400/30 bg-slate-900/35 p-4" : "border-slate-200 bg-slate-100 p-4"}`}>
        <div className={isNewDemo ? "space-y-1.5" : "space-y-2"}>
          {rows.map((row) => {
            const meta = metricMeta[row.metric] || { label: row.metric, higherIsGood: true }
            const isPositiveDelta = String(row.delta || '').trim().startsWith('+')
            const isGood = isPositiveDelta ? meta.higherIsGood : !meta.higherIsGood
            const deltaClass = isGood ? 'text-emerald-700' : 'text-rose-700'

            return (
              <div
                key={row.metric}
                className={`grid grid-cols-[minmax(0,1fr)_minmax(6.8rem,auto)_minmax(5.8rem,auto)] items-center gap-x-3 rounded-lg border ${isNewDemo ? "border-sky-400/25 bg-slate-800/40 px-[10px] py-[5px]" : "border-slate-200/80 bg-white/30 px-[10px] py-[5px]"}`}
                style={{ padding: "5px 10px" }}
              >
                <div className={`min-w-0 ${isNewDemo ? "wrap-break-word text-[16px] font-medium leading-5 text-slate-100" : "wrap-break-word font-medium text-slate-800"}`}>{meta.label}</div>
                <div className={`text-right font-semibold tabular-nums ${isNewDemo ? "text-[17px] leading-5 text-slate-200" : "text-slate-700"}`}>{row.value}</div>
                <div className={`text-right font-semibold tabular-nums ${isNewDemo ? "text-[17px] leading-5" : ""} ${deltaClass}`}>{row.delta}</div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default ScenarioAnalysisDashboard
