import promptDeepCauses from '../data/formalizator/prompt_deep_causes.json'
import hypothesisExactPhrase from '../data/formalizator/hypothesis_exact_phrase.json'

const MAX_LABEL_LEN = 220

const LETTER_ORDER = { G: 0, C: 1, L: 2 }

function sortDeepCauseKeys(keys) {
  return [...keys].sort((a, b) => {
    const ma = /^([GCL])(\d+)$/.exec(a)
    const mb = /^([GCL])(\d+)$/.exec(b)
    if (!ma && !mb) return a.localeCompare(b)
    if (!ma) return 1
    if (!mb) return -1
    const oa = LETTER_ORDER[ma[1]] ?? 9
    const ob = LETTER_ORDER[mb[1]] ?? 9
    if (oa !== ob) return oa - ob
    return parseInt(ma[2], 10) - parseInt(mb[2], 10)
  })
}

function trimCap(s, maxLen) {
  const t = String(s ?? '').trim()
  if (!t) return ''
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen - 1)}…`
}

function dedupeStrings(items, maxLen = MAX_LABEL_LEN) {
  const seen = new Set()
  const out = []
  for (const raw of items) {
    const s = trimCap(raw, maxLen)
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

function mapInfluence(phrase, phraseMap) {
  const p = String(phrase ?? '').trim()
  if (!p) return ''
  const mapped = phraseMap[p]
  if (typeof mapped === 'string' && mapped.trim()) return mapped.trim()
  return p
}

function collectRows(promptDeep) {
  const keys = sortDeepCauseKeys(Object.keys(promptDeep))
  const intros = []
  const situations = []
  const causesFlat = []
  const influencesRaw = []

  for (const key of keys) {
    const row = promptDeep[key]
    if (!row || typeof row !== 'object') continue

    const intro = String(row.introduction ?? '').trim()
    if (intro) intros.push(intro)

    const sit = String(row.situation ?? '').trim()
    if (sit) situations.push(sit)

    const causes = Array.isArray(row.causes) ? row.causes : []
    for (const c of causes) {
      const t = String(c ?? '').trim()
      if (t) causesFlat.push(t)
    }

    const influences = Array.isArray(row.influences) ? row.influences : []
    for (const inf of influences) {
      const t = String(inf ?? '').trim()
      if (t) influencesRaw.push(t)
    }
  }

  return { intros, situations, causesFlat, influencesRaw }
}

/**
 * Строит пулы строк для scenarioGraphData из formalizator JSON.
 * Пустые массивы допустимы — в scenarioGraphData остаётся fallback на литералы.
 */
export function buildFormalizatorScenarioPools(
  promptDeep = promptDeepCauses,
  phraseMap = hypothesisExactPhrase
) {
  const { intros, situations, causesFlat, influencesRaw } = collectRows(promptDeep)
  const mapObj = phraseMap && typeof phraseMap === 'object' ? phraseMap : {}

  const poolContext = dedupeStrings([...causesFlat, ...intros, ...situations])

  let poolAnalysisA = dedupeStrings(causesFlat.filter((_, i) => i % 2 === 0))
  let poolAnalysisB = dedupeStrings(causesFlat.filter((_, i) => i % 2 === 1))
  if (poolAnalysisB.length === 0 && causesFlat.length > 1) {
    const all = dedupeStrings(causesFlat)
    const mid = Math.ceil(all.length / 2)
    poolAnalysisA = all.slice(0, mid)
    poolAnalysisB = all.slice(mid)
  }

  const poolMilestone = dedupeStrings(situations)

  const mappedInfluences = dedupeStrings(influencesRaw.map((raw) => mapInfluence(raw, mapObj)))
  const poolSynth = dedupeStrings(mappedInfluences.map((m) => `Сводка ветки: ${m}`))
  const poolFinal = dedupeStrings(mappedInfluences.map((m) => `Итог сценария: ${m}`))

  return {
    context: poolContext,
    analysisA: poolAnalysisA,
    analysisB: poolAnalysisB,
    milestone: poolMilestone,
    synth: poolSynth,
    final: poolFinal,
  }
}
