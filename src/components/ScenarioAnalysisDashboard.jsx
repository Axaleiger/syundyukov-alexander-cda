import React from 'react'
import {
  kpiRows,
  recommendations,
  SCENARIO_BRANCH_COUNT,
  OPTIMAL_SCENARIO_VARIANT,
} from '../lib/scenarioGraphData'

function ScenarioAnalysisDashboard({ visible = false }) {
  return (
    <section
      className={`mt-4 grid gap-4 transition-all duration-700 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <div className="rounded-2xl border border-emerald-500/30 bg-slate-900 p-4 shadow-[0_14px_40px_rgba(2,6,23,0.55)]">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">✓</div>
          <p className="text-sm font-semibold text-slate-100">
            Проанализировано {SCENARIO_BRANCH_COUNT} сценариев. Оптимальный — Вариант{' '}
            {OPTIMAL_SCENARIO_VARIANT}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-emerald-500/20 bg-slate-900 p-4 shadow-[0_12px_30px_rgba(2,6,23,0.45)] transition-transform duration-200 hover:-translate-y-1">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-8 w-1 rounded-full bg-emerald-400" />
            <h5 className="text-sm font-semibold text-emerald-300">ВНС/ЗБС</h5>
          </div>
          <ol className="list-decimal space-y-2 pl-5 text-xs leading-relaxed text-slate-300">
            {recommendations.vnsZbs.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </article>

        <article className="rounded-2xl border border-sky-500/20 bg-slate-900 p-4 shadow-[0_12px_30px_rgba(2,6,23,0.45)] transition-transform duration-200 hover:-translate-y-1">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-8 w-1 rounded-full bg-sky-400" />
            <h5 className="text-sm font-semibold text-sky-300">ГТМ</h5>
          </div>
          <ol className="list-decimal space-y-2 pl-5 text-xs leading-relaxed text-slate-300">
            {recommendations.gtm.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </article>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-[0_12px_30px_rgba(2,6,23,0.5)]">
        <h5 className="mb-3 text-sm font-semibold text-slate-100">KPI</h5>
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2 text-xs">
          <div className="font-semibold text-slate-400">Метрика</div>
          <div className="font-semibold text-slate-400">Значение</div>
          <div className="text-right font-semibold text-slate-400">Изменение</div>
          {kpiRows.map((row) => {
            const positive = row.delta.startsWith('+') || row.metric === 'DPP' || row.metric === 'CAPEX'
            const color = positive ? 'text-emerald-400' : 'text-rose-400'
            return (
              <React.Fragment key={row.metric}>
                <div className="text-slate-200">{row.metric}</div>
                <div className="text-slate-300">{row.value}</div>
                <div className={`text-right font-semibold ${color}`}>{row.delta}</div>
              </React.Fragment>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default ScenarioAnalysisDashboard