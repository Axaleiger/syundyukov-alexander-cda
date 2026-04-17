import React from 'react'
import {
  kpiRows,
  recommendations,
  SCENARIO_BRANCH_COUNT,
  OPTIMAL_SCENARIO_VARIANT,
} from '../lib/scenarioGraphData'
import dash from './ScenarioAnalysisDashboard.module.css'

function DashboardIconRow({ icon, children, isNewDemo = false, iconMuted = false }) {
  if (isNewDemo) {
    const orbClass = iconMuted ? `${dash.iconOrb} ${dash.iconOrbMuted}` : dash.iconOrb
    return (
      <div className={dash.insightRow}>
        <div className={orbClass} aria-hidden>
          {icon}
        </div>
        <div className={dash.insightPanel}>{children}</div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center" aria-hidden>
        {icon}
      </div>
      <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-100" style={{ padding: '5px 10px' }}>
        {children}
      </div>
    </div>
  )
}

function NumberedRecommendationList({ items, isNewDemo = false }) {
  if (isNewDemo) {
    return (
      <ul className={dash.bulletList}>
        {items.map((item, i) => (
          <li key={item} className={dash.bulletRow}>
            <span className={dash.bulletIndex}>{i + 1}.</span>
            <span className={dash.bulletText}>{item}</span>
          </li>
        ))}
      </ul>
    )
  }
  return (
    <ul className="m-0 list-none space-y-2 p-0 text-xs leading-relaxed text-slate-700">
      {items.map((item, i) => (
        <li key={item} className="flex items-start gap-2">
          <span className="w-6 shrink-0 pt-px text-right tabular-nums text-slate-500">{i + 1}.</span>
          <span className="min-w-0 wrap-break-word">{item}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * @param {{ title: string, bullets: string[] } | null} [primaryCard]
 * @param {{ title: string, bullets: string[] } | null} [secondaryCard]
 * @param {typeof kpiRows} [kpiRowsData]
 * @param {string} [headlineLine] — полная первая строка сводки (если задана, подставляется вместо шаблона «N целей»)
 */
function ScenarioAnalysisDashboard({
  visible = false,
  isNewDemo = false,
  scenarioBranchCount = SCENARIO_BRANCH_COUNT,
  optimalVariant = OPTIMAL_SCENARIO_VARIANT,
  primaryCard = null,
  secondaryCard = null,
  kpiRowsData = null,
  headlineLine = null,
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

  const checkIconNew = <span aria-hidden>✓</span>
  const checkIconLegacy = (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700">✓</div>
  )

  const chartIconNew = (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" aria-hidden>
      <path d="M4 19V5" strokeLinecap="round" />
      <path d="M4 19H20" strokeLinecap="round" />
      <path d="M8 15l2-2 3 3 6-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  const chartIconLegacy = (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200/70 text-slate-700">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19V5" />
        <path d="M4 19H20" />
        <path d="M8 15l2-2 3 3 6-8" />
      </svg>
    </span>
  )

  const sectionClass = isNewDemo
    ? `${dash.section} transition-all duration-700 ease-out ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`
    : `grid gap-4 p-2 transition-all duration-700 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`

  return (
    <section className={sectionClass}>
      <DashboardIconRow icon={isNewDemo ? checkIconNew : checkIconLegacy} isNewDemo={isNewDemo}>
        <p
          className={
            isNewDemo
              ? dash.insightTitle
              : 'm-0 text-sm font-semibold leading-5 text-slate-700'
          }
        >
          {headlineLine?.trim()
            ? headlineLine.trim()
            : `Проанализировано ${scenarioBranchCount} целей. Оптимальная — Цель ${optimalVariant}`}
        </p>
      </DashboardIconRow>

      <div className={isNewDemo ? dash.recoGrid : 'grid gap-4 md:grid-cols-2'}>
        <article
          className={
            isNewDemo
              ? `${dash.recoCard} ${dash.recoCardPrimary}`
              : 'rounded-lg border border-slate-200 bg-slate-100 p-4 transition-colors duration-200 hover:bg-slate-200/80'
          }
        >
          <div className={isNewDemo ? dash.recoCardHead : 'mb-3 flex items-start gap-2'}>
            {!isNewDemo ? <span className="h-8 w-1 shrink-0 rounded-full bg-emerald-400" /> : null}
            <h5
              className={
                isNewDemo
                  ? dash.recoCardTitle
                  : 'text-sm font-semibold leading-5 text-emerald-800'
              }
            >
              {pCard.title}
            </h5>
          </div>
          <NumberedRecommendationList items={pCard.bullets} isNewDemo={isNewDemo} />
        </article>

        <article
          className={
            isNewDemo
              ? `${dash.recoCard} ${dash.recoCardSecondary}`
              : 'rounded-lg border border-slate-200 bg-slate-100 p-4 transition-colors duration-200 hover:bg-slate-200/80'
          }
        >
          <div className={isNewDemo ? dash.recoCardHead : 'mb-3 flex items-start gap-2'}>
            {!isNewDemo ? <span className="h-8 w-1 shrink-0 rounded-full bg-sky-400" /> : null}
            <h5
              className={
                isNewDemo ? dash.recoCardTitle : 'text-sm font-semibold leading-5 text-sky-800'
              }
            >
              {sCard.title}
            </h5>
          </div>
          <NumberedRecommendationList items={sCard.bullets} isNewDemo={isNewDemo} />
        </article>
      </div>

      <DashboardIconRow icon={isNewDemo ? chartIconNew : chartIconLegacy} isNewDemo={isNewDemo} iconMuted>
        {isNewDemo ? (
          <p className={dash.kpiSectionTitle}>Ключевые показатели эффективности</p>
        ) : (
          <p className="m-0 text-sm font-semibold text-slate-700">Ключевые показатели эффективности</p>
        )}
      </DashboardIconRow>

      {isNewDemo ? (
        <div className={dash.kpiFrame}>
          <div className={dash.kpiList}>
            {rows.map((row) => {
              const meta = metricMeta[row.metric] || { label: row.metric, higherIsGood: true }
              const isPositiveDelta = String(row.delta || '').trim().startsWith('+')
              const isGood = isPositiveDelta ? meta.higherIsGood : !meta.higherIsGood
              return (
                <div key={row.metric} className={dash.kpiRow}>
                  <div className={dash.kpiMetric}>{meta.label}</div>
                  <div className={dash.kpiValue}>{row.value}</div>
                  <div className={isGood ? dash.deltaGood : dash.deltaBad}>{row.delta}</div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-100 p-4">
          <div className="space-y-2">
            {rows.map((row) => {
              const meta = metricMeta[row.metric] || { label: row.metric, higherIsGood: true }
              const isPositiveDelta = String(row.delta || '').trim().startsWith('+')
              const isGood = isPositiveDelta ? meta.higherIsGood : !meta.higherIsGood
              const deltaClass = isGood ? 'text-emerald-700' : 'text-rose-700'
              return (
                <div
                  key={row.metric}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(6.8rem,auto)_minmax(5.8rem,auto)] items-center gap-x-3 rounded-lg border border-slate-200/80 bg-white/30 px-[10px] py-[5px]"
                  style={{ padding: '5px 10px' }}
                >
                  <div className="min-w-0 wrap-break-word font-medium text-slate-800">{meta.label}</div>
                  <div className="text-right font-semibold tabular-nums text-slate-700">{row.value}</div>
                  <div className={`text-right font-semibold tabular-nums ${deltaClass}`}>{row.delta}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

export default ScenarioAnalysisDashboard
