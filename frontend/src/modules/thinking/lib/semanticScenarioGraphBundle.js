/**
 * Подмена узлов графа мышления по результату prompt-pipeline:
 * запрос → цели → причины по каждой цели (из prompt_deep_causes) → гипотезы по каждой цели (влияния).
 * Топология пресета (рёбра userQuery → scenario-k → cause → hyp) сохраняется; тексты ставятся на узлы,
 * привязанные к соответствующей ветке цели.
 *
 * Число причин/гипотез на ветку совпадает с длинами массивов в prompt_deep_causes (как formalizator).
 */

import {
	getScenarioGraphBundleForAiPreset,
	SCENARIO_BRANCH_COUNT,
	computeOptimalScenarioClosure,
	getOptimalVariantForAiPreset,
} from "./scenarioGraphData.js"
import {
	applyWorkflowLayout,
	clampSemanticNodesToThinkingXBounds,
	clampThinkingGridNodesIntoStageBands,
	finalizeThinkingLayout,
	normalizeGraphBounds,
	measureGraphBounds,
	nudgeCdNodesIntoEqualStageBands,
	pinThinkingGridPillarSeamXs,
	relaxGraphNodeCollisions,
	relayoutScenarioOutcomeBalls,
	repelCdNodesFromPillarBodies,
	repelNodesFromChordEdges,
	repelScenarioOutcomeBallsAwayFromGraphNodes,
} from "./scenarioGraphLayout.js"
import {
	CH_TWIN_LONG_DESCRIPTION,
	formatChEdgeBusinessLines,
} from "./causeHypTwinDocumentation.js"
import {
	buildPerGoalCauseHypothesisPanels,
	pickHeavyTextIndices,
} from "../../promptPipeline/semanticState.js"
import {
	capitalizeFirstRu,
	formatFormalizatorObjectiveDetailBody,
} from "../../promptPipeline/formatFormalizatorObjectiveNodeLabel.js"
import {
	formatDigitalTwinBallLabel,
	pickDigitalTwinsCauseHyp,
	pickDigitalTwinsHypScenario,
} from "./digitalTwinPickers.js"

function deepCloneBundle(bundle) {
	/** JSON-клон ломает `Set` (optimalEdgeKeys / optimalNodeIds) → пустой объект и `.has` нет. */
	return structuredClone(bundle)
}

function numericSuffix(id, prefix) {
	const m = new RegExp(`^${prefix}-(\\d+)$`).exec(id)
	return m ? parseInt(m[1], 10) : 0
}

/** Тело раскрытия: без префикса «Причина N» / «Гипотеза N», с заглавной буквы. */
function normalizeCauseHypDetailLine(raw) {
	let s = String(raw ?? "").trim()
	if (!s) return "—"
	s = s.replace(/^(Причина|Гипотеза)\s*\d+\s*[.:]\s*/i, "").trim()
	return capitalizeFirstRu(s)
}

function outcomeDetailTextForRank() {
	return capitalizeFirstRu("Моделирование исхода по связанной гипотезе.")
}

/** Сквозная нумерация по визуальному порядку сверху вниз. */
function assignDenseCauseHypLabels(bundle) {
	const causes = bundle.nodes.filter((n) => /^cause-\d+$/.test(n.id))
	causes.sort((a, b) => a.y - b.y || a.x - b.x)
	causes.forEach((n, i) => {
		n.label = `Причина ${i + 1}`
	})
	const hyps = bundle.nodes.filter((n) => /^hyp-\d+$/.test(n.id))
	hyps.sort((a, b) => a.y - b.y || a.x - b.x)
	hyps.forEach((n, i) => {
		n.label = `Гипотеза ${i + 1}`
	})
}

/** Сценарии (шары): Сценарий 1…K по положению на холсте, без дыр в номерах. */
function assignDenseScenarioOutcomeLabels(bundle) {
	const outs = bundle.nodes.filter(
		(n) => n.type === "outcome" && /^out-scenario-\d+$/.test(n.id),
	)
	outs.sort((a, b) => a.y - b.y || a.x - b.x)
	outs.forEach((n, i) => {
		const rank = i + 1
		n.label = `Сценарий ${rank}`
		n.detailText = outcomeDetailTextForRank()
	})
}

function assignCdLabels(bundle) {
	for (const n of bundle.nodes) {
		if (!/^cd-\d+$/.test(n.id)) continue
		const seg = n.cdSegment === "hs" ? "hs" : "ch"
		const codes = Array.isArray(n.cdTwinSlots) ? n.cdTwinSlots : []
		n.label = formatDigitalTwinBallLabel(seg, codes)
	}
}

/** Пояснения для ЦД первого перегона: описание типа + блок сквозных процессов при совпадении кодов на ребре. */
function assignCauseHypTwinDetailTexts(bundle) {
	const byEdge = new Map()
	for (const n of bundle.nodes) {
		if (!/^cd-\d+$/.test(n.id) || n.cdSegment !== "ch") continue
		const k = n.cdEdgePair
		if (!k) continue
		if (!byEdge.has(k)) byEdge.set(k, [])
		byEdge.get(k).push(n)
	}
	for (const nodes of byEdge.values()) {
		const unionCodes = [
			...new Set(nodes.flatMap((x) => (Array.isArray(x.cdTwinSlots) ? x.cdTwinSlots : []))),
		]
		const biz = formatChEdgeBusinessLines(unionCodes)
		for (const n of nodes) {
			const slots = Array.isArray(n.cdTwinSlots) ? n.cdTwinSlots : []
			const code = slots[0]
			const main = code ? CH_TWIN_LONG_DESCRIPTION[code] : ""
			n.detailText = [main, biz].filter(Boolean).join("\n\n")
		}
	}
}

function buildIncomingAdjacency(edges) {
	const incoming = new Map()
	for (const e of edges || []) {
		if (!incoming.has(e.to)) incoming.set(e.to, [])
		incoming.get(e.to).push(e.from)
	}
	return incoming
}

function extractScenarioOrdinalFromId(id) {
	const m = /^out-scenario-(\d+)$/.exec(String(id || ""))
	return m ? parseInt(m[1], 10) : 1
}

function inferActionPackFromHypotheses(hypDetails, ordinal) {
	const text = hypDetails.join(" ").toLowerCase()
	const isGtm = text.includes("гтм")
	const isPpd = text.includes("ппд") || text.includes("заводнен")
	const isRepair = text.includes("опз") || text.includes("ремонт")
	const grps = (isGtm ? 3 : 2) + (ordinal % 2)
	const ppd = (isPpd ? 2 : 1) + (ordinal % 2 === 0 ? 0 : 1)
	const opz = (isRepair ? 3 : 2) + (ordinal % 3 === 0 ? 1 : 0)
	return { grps, ppd, opz }
}

function buildScenarioSimulationSummary({ ordinal, hypotheses, twinLabels }) {
	const hypCount = Math.max(1, hypotheses.length)
	const { grps, ppd, opz } = inferActionPackFromHypotheses(hypotheses, ordinal)
	const oilDelta = 7 + ordinal * 2 + hypCount
	const waterDelta = 1 + (ordinal % 3)
	const pressureDelta = 4 + ordinal + Math.floor(hypCount / 2)
	const annualRevenue = Math.round(oilDelta * 78)
	const annualFcf = Math.round(annualRevenue * 0.62)
	const npvDelta = Math.round(annualFcf * 2.4)
	const twins = twinLabels.length ? twinLabels.join(", ") : "ЦД пласта, ЦД скважины"
	return [
		`Сценарий ${ordinal}: смоделирована связка гипотез (${hypCount}) на цифровых двойниках объектов: ${twins}.`,
		`В расчётном контуре выполнены ${grps} ГРП, ${ppd} перевода в ППД и ${opz} ОПЗ.`,
		`Итог моделирования: прирост добычи нефти +${oilDelta} т/сут, снижение темпов обводнённости на ${waterDelta}% и рост пластового давления на ${pressureDelta} атм.`,
		`Экономический эффект: дополнительный денежный поток +${annualFcf} млн руб/год (выручка +${annualRevenue} млн руб/год), прирост NPV +${npvDelta} млн руб.`,
	].join("\n")
}

function assignOutcomeScenarioSimulationSummaries(bundle) {
	const nodesById = new Map((bundle.nodes || []).map((n) => [n.id, n]))
	const incoming = buildIncomingAdjacency(bundle.edges || [])
	for (const outNode of bundle.nodes || []) {
		if (!/^out-scenario-\d+$/.test(String(outNode.id || ""))) continue
		const ordinal = extractScenarioOrdinalFromId(outNode.id)
		const preds = incoming.get(outNode.id) || []
		const hypIds = new Set()
		const twinLabels = []
		for (const pid of preds) {
			if (/^hyp-\d+$/.test(pid)) {
				hypIds.add(pid)
				continue
			}
			const cdNode = nodesById.get(pid)
			if (cdNode?.cdSegment === "hs") {
				const label = String(cdNode.label || "").trim()
				if (label) twinLabels.push(label)
				for (const maybeHyp of incoming.get(pid) || []) {
					if (/^hyp-\d+$/.test(maybeHyp)) hypIds.add(maybeHyp)
				}
			}
		}
		const hypotheses = [...hypIds]
			.map((id) => String(nodesById.get(id)?.detailText || "").trim())
			.filter(Boolean)
		const uniqTwins = [...new Set(twinLabels)]
		outNode.detailText = buildScenarioSimulationSummary({
			ordinal,
			hypotheses,
			twinLabels: uniqTwins,
		})
	}
}

/**
 * Как в prompt-builder `buildMermaidFromPanel`: «тяжёлые» причины/гипотезы — активные;
 * остальные помечаются `semanticChainActive: false` (на new-demo — красное угасание).
 */
function assignSemanticChainUiFlags(bundle, goalKeys) {
	const perGoal = buildPerGoalCauseHypothesisPanels(goalKeys)
	const edges = bundle.edges || []

	for (let k = 1; k <= SCENARIO_BRANCH_COUNT; k++) {
		const sid = `scenario-${k}`
		const causeTos = [
			...new Set(
				edges.filter((e) => e.from === sid && /^cause-\d+$/.test(e.to)).map((e) => e.to),
			),
		].sort((a, b) => numericSuffix(a, "cause") - numericSuffix(b, "cause"))

		const pg = perGoal[k - 1] || { causes: [], hyps: [] }
		const heavyC = pickHeavyTextIndices(pg.causes, 2)
		const heavyH = pickHeavyTextIndices(pg.hyps, 2)

		for (let i = 0; i < causeTos.length; i++) {
			const node = bundle.nodes.find((x) => x.id === causeTos[i])
			if (node) node.semanticChainActive = heavyC.includes(i)
		}

		const hypIdSet = new Set()
		for (const cid of causeTos) {
			for (const e of edges) {
				if (e.from === cid && /^hyp-\d+$/.test(e.to)) hypIdSet.add(e.to)
			}
		}
		const hypTos = [...hypIdSet].sort(
			(a, b) => numericSuffix(a, "hyp") - numericSuffix(b, "hyp"),
		)
		for (let j = 0; j < hypTos.length; j++) {
			const node = bundle.nodes.find((x) => x.id === hypTos[j])
			if (node) node.semanticChainActive = heavyH.includes(j)
		}
	}

	bundle.semanticUiChain = true
}

function assignSemanticChainFlagsForCdNodes(bundle) {
	const edges = bundle.edges || []
	const chPairRe = /^(cause-\d+)-(hyp-\d+)$/
	for (const n of bundle.nodes) {
		if (!/^cd-\d+$/.test(n.id)) continue
		if (n.cdSegment === "ch" && n.cdEdgePair) {
			const m = chPairRe.exec(String(n.cdEdgePair))
			if (!m) continue
			const cNode = bundle.nodes.find((x) => x.id === m[1])
			const hNode = bundle.nodes.find((x) => x.id === m[2])
			n.semanticChainActive = Boolean(
				cNode?.semanticChainActive && hNode?.semanticChainActive,
			)
		} else if (n.cdSegment === "hs") {
			const preds = edges.filter((e) => e.to === n.id).map((e) => e.from)
			const hypId = preds.find((id) => /^hyp-\d+$/.test(id))
			const hypNode = hypId ? bundle.nodes.find((x) => x.id === hypId) : null
			n.semanticChainActive =
				hypNode && hypNode.semanticChainActive === false ? false : true
		}
	}
}

function chainOffsetHash(fromId, toId, cid) {
	let h = 2166136261 >>> 0
	const s = `${fromId}|${toId}|${cid}`
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i)
		h = Math.imul(h, 16777619)
	}
	return h >>> 0
}

function layoutTwinChains(bundle, chains) {
	const byId = new Map(bundle.nodes.map((n) => [n.id, n]))
	for (const { fromId, toId, cdIds } of chains) {
		const a = byId.get(fromId)
		const b = byId.get(toId)
		if (!a || !b || !cdIds.length) continue
		const k = cdIds.length + 1
		const dx = b.x - a.x
		const dy = b.y - a.y
		const len = Math.hypot(dx, dy) || 1
		const px = -dy / len
		const py = dx / len
		cdIds.forEach((cid, idx) => {
			const cn = byId.get(cid)
			if (!cn) return
			const t = (idx + 1) / k
			let x = a.x + dx * t
			let y = a.y + dy * t
			const mid = (cdIds.length - 1) / 2
			const stagger = (idx - mid) * 26
			const h = chainOffsetHash(fromId, toId, cid)
			const side = (h % 2 === 0 ? 1 : -1) * (0.85 + ((h >>> 3) % 100) / 400)
			x += px * stagger * side
			y += py * stagger * side
			const pad = 22
			let loX = Math.min(a.x, b.x) + pad
			let hiX = Math.max(a.x, b.x) - pad
			if (loX > hiX) {
				const mx = (a.x + b.x) / 2
				loX = mx - 6
				hiX = mx + 6
			}
			let loY = Math.min(a.y, b.y) + pad * 0.45
			let hiY = Math.max(a.y, b.y) - pad * 0.45
			if (loY > hiY) {
				const my = (a.y + b.y) / 2
				loY = my - 6
				hiY = my + 6
			}
			cn.x = Math.round(Math.min(hiX, Math.max(loX, x)))
			cn.y = Math.round(Math.min(hiY, Math.max(loY, y)))
		})
	}
}

/**
 * Разбивает рёбра причина→гипотеза и гипотеза→сценарий, вставляет шары ЦД.
 * @returns {{ chChains: Array<{fromId:string,toId:string,cdIds:string[]}>, hsChains: same }}
 */
function injectDigitalTwinChains(bundle) {
	const edges = bundle.edges || []
	const outEdges = []
	const newNodes = []
	let cdSeq = 0
	const chChains = []
	const hsChains = []
	const byId = new Map(bundle.nodes.map((n) => [n.id, n]))
	const templateCd = bundle.nodes.find((n) => n.type === "outcome")

	for (const e of edges) {
		const from = e.from
		const to = e.to
		const isCH = /^cause-\d+$/.test(from) && /^hyp-\d+$/.test(to)
		const isHS = /^hyp-\d+$/.test(from) && /^out-scenario-\d+$/.test(to)

		if (isCH) {
			const causeText = String(byId.get(from)?.detailText ?? "")
			const hypText = String(byId.get(to)?.detailText ?? "")
			const slots = pickDigitalTwinsCauseHyp(causeText, hypText)
			const cdIds = []
			let prev = from
			const cdEdgePair = `${from}-${to}`
			for (const slot of slots) {
				cdSeq++
				const id = `cd-${cdSeq}`
				cdIds.push(id)
				newNodes.push({
					id,
					label: "",
					detailText: "",
					type: "outcome",
					x: 0,
					y: 0,
					level: 0,
					revealWave: templateCd?.revealWave ?? 0,
					cdTwinSlots: slot.codes,
					cdSegment: "ch",
					cdEdgePair,
				})
				outEdges.push({ from: prev, to: id })
				prev = id
			}
			outEdges.push({ from: prev, to: to })
			chChains.push({ fromId: from, toId: to, cdIds })
			continue
		}

		if (isHS) {
			const hypText = String(byId.get(from)?.detailText ?? "")
			const scText = String(byId.get(to)?.detailText ?? "")
			const slots = pickDigitalTwinsHypScenario(hypText, scText)
			const cdIds = []
			let prev = from
			for (const slot of slots) {
				cdSeq++
				const id = `cd-${cdSeq}`
				cdIds.push(id)
				newNodes.push({
					id,
					label: "",
					detailText: "",
					type: "outcome",
					x: 0,
					y: 0,
					level: 0,
					revealWave: templateCd?.revealWave ?? 0,
					cdTwinSlots: slot.codes,
					cdSegment: "hs",
				})
				outEdges.push({ from: prev, to: id })
				prev = id
			}
			outEdges.push({ from: prev, to: to })
			hsChains.push({ fromId: from, toId: to, cdIds })
			continue
		}

		outEdges.push(e)
	}

	bundle.edges = outEdges
	bundle.nodes.push(...newNodes)
	return { chChains, hsChains }
}

/** Добавляет узлы cause-i / hyp-j, если базовый пресет содержит меньше заготовок. */
function ensureCauseHypNodesExist(bundle, totalCauses, totalHyps) {
	const byId = new Set(bundle.nodes.map((n) => n.id))
	const templateCause = bundle.nodes.find((n) => /^cause-\d+$/.test(n.id))
	const templateHyp = bundle.nodes.find((n) => /^hyp-\d+$/.test(n.id))
	for (let i = 1; i <= totalCauses; i++) {
		const id = `cause-${i}`
		if (!byId.has(id)) {
			bundle.nodes.push({
				id,
				label: "",
				detailText: templateCause?.detailText ?? "Причина",
				type: "step",
				x: 0,
				y: 0,
				level: 0,
			})
			byId.add(id)
		}
	}
	for (let i = 1; i <= totalHyps; i++) {
		const id = `hyp-${i}`
		if (!byId.has(id)) {
			bundle.nodes.push({
				id,
				label: "",
				detailText: templateHyp?.detailText ?? "Гипотеза",
				type: "step",
				x: 0,
				y: 0,
				level: 0,
			})
			byId.add(id)
		}
	}
}

/**
 * Непересекающиеся слоты по веткам: для ветки k только свои cause-/hyp- индексы,
 * суммарная нумерация по порядку веток (под любое число причин/гипотез из каталога).
 */
function rewriteBundleToDisjointScenarioTopology(bundle, preset, perGoal) {
	const edges = bundle.edges || []
	const kept = edges.filter((e) => {
		if (/^scenario-\d+$/.test(e.from) && /^cause-\d+$/.test(e.to)) return false
		if (/^cause-\d+$/.test(e.from) && /^hyp-\d+$/.test(e.to)) return false
		return true
	})

	let causeOffset = 0
	let hypOffset = 0
	const next = [...kept]

	for (let k = 1; k <= SCENARIO_BRANCH_COUNT; k++) {
		const pg = perGoal[k - 1] || { causes: [], hyps: [] }
		const nc = pg.causes.length
		const nh = pg.hyps.length
		const sid = `scenario-${k}`
		const causeIds = []
		for (let i = 0; i < nc; i++) {
			causeIds.push(`cause-${causeOffset + i + 1}`)
		}
		const hypIds = []
		for (let j = 0; j < nh; j++) {
			hypIds.push(`hyp-${hypOffset + j + 1}`)
		}
		causeOffset += nc
		hypOffset += nh

		for (const cid of causeIds) next.push({ from: sid, to: cid })
		for (const cid of causeIds) {
			for (const hid of hypIds) next.push({ from: cid, to: hid })
		}
	}

	ensureCauseHypNodesExist(bundle, causeOffset, hypOffset)

	bundle.edges = next
	const dim = applyWorkflowLayout(bundle.nodes, next)
	bundle.dimensions = { width: dim.width, height: dim.height }
	const optVar = getOptimalVariantForAiPreset(preset)
	const opt = computeOptimalScenarioClosure(next, `scenario-${optVar}`)
	bundle.optimalNodeIds = opt.nodeIds
	bundle.optimalEdgeKeys = opt.edgeKeys
}

/**
 * Оставляет только активные ветки с полным подграфом; лишние цели — красные «тупики»:
 * узел scenario-k + ребро userQuery→scenario-k без дальнейшего развития (как отсечённые ветки в prompt-builder).
 */
function pruneBundleToActiveScenarioBranches(bundle, preset, activeRealGoals) {
	if (activeRealGoals >= SCENARIO_BRANCH_COUNT || activeRealGoals < 1) return

	const stubScenarioIds = new Set()
	for (let k = activeRealGoals + 1; k <= SCENARIO_BRANCH_COUNT; k++) {
		stubScenarioIds.add(`scenario-${k}`)
	}

	const edges = [...(bundle.edges || [])].filter((e) => {
		if (stubScenarioIds.has(e.from)) return false
		if (stubScenarioIds.has(e.to) && e.from !== "userQuery") return false
		return true
	})
	for (const sid of stubScenarioIds) {
		if (!edges.some((e) => e.from === "userQuery" && e.to === sid)) {
			edges.push({ from: "userQuery", to: sid })
		}
	}
	bundle.edges = edges

	for (const n of bundle.nodes) {
		const m = /^scenario-(\d+)$/.exec(n.id)
		if (!m) continue
		const k = parseInt(m[1], 10)
		n.scenarioSlotUnused = k > activeRealGoals
	}

	const adj = new Map()
	for (const e of bundle.edges) {
		if (!adj.has(e.from)) adj.set(e.from, [])
		adj.get(e.from).push(e.to)
	}
	const seen = new Set(["userQuery"])
	const q = ["userQuery"]
	while (q.length) {
		const u = q.shift()
		for (const v of adj.get(u) || []) {
			if (!seen.has(v)) {
				seen.add(v)
				q.push(v)
			}
		}
	}

	bundle.nodes = (bundle.nodes || []).filter((n) => seen.has(n.id))
	bundle.edges = (bundle.edges || []).filter(
		(e) => seen.has(e.from) && seen.has(e.to),
	)

	const dim = applyWorkflowLayout(bundle.nodes, bundle.edges)
	bundle.dimensions = { width: dim.width, height: dim.height }
	bundle.maxRevealWave = Math.max(
		0,
		...bundle.nodes.map((n) => Number(n.revealWave) || 0),
	)

	const optVarRaw = getOptimalVariantForAiPreset(preset)
	const optVar = Math.min(optVarRaw, activeRealGoals)
	const opt = computeOptimalScenarioClosure(
		bundle.edges,
		`scenario-${Math.max(1, optVar)}`,
	)
	bundle.optimalNodeIds = opt.nodeIds
	bundle.optimalEdgeKeys = opt.edgeKeys
}

/**
 * @param {string} preset — base_drilling | fcf_no_drill | opex_reduction
 * @param {object} pipeline — результат `runPromptPipeline` / шаблона (goals, goalKeys, summaryLine, …)
 */
export function buildSemanticScenarioGraphBundle(preset, pipeline) {
	const base = getScenarioGraphBundleForAiPreset(preset)
	const out = deepCloneBundle(base)

	const goals = pipeline.goals || []
	const gk = Array.isArray(pipeline.goalKeys) ? [...pipeline.goalKeys] : []
	const hasRealGoalKey = gk.some(
		(id) => typeof id === "string" && /^G\d+$/i.test(id),
	)
	let objectiveIdsByBranch = hasRealGoalKey
		? gk
		: goals.map((g) =>
				typeof g?.id === "string" && /^G\d+$/i.test(g.id) ? g.id : null,
			)
	while (objectiveIdsByBranch.length < SCENARIO_BRANCH_COUNT) objectiveIdsByBranch.push(null)
	objectiveIdsByBranch = objectiveIdsByBranch.slice(0, SCENARIO_BRANCH_COUNT)
	const keysForPanels = objectiveIdsByBranch
	const perGoal = buildPerGoalCauseHypothesisPanels(keysForPanels)

	rewriteBundleToDisjointScenarioTopology(out, preset, perGoal)

	const rawUser = String(pipeline.userQueryText ?? "").trim()
	const fallbackLine = String(pipeline.summaryLine || pipeline.normText || "").trim()
	const userDetail = rawUser || fallbackLine || "—"

	for (const n of out.nodes) {
		if (n.id === "userQuery") {
			n.label = "Пользовательский запрос"
			n.detailText = userDetail
			continue
		}
		const sm = /^scenario-(\d+)$/.exec(n.id)
		if (sm) {
			const branchNum = parseInt(sm[1], 10)
			const idx = branchNum - 1
			const oid = objectiveIdsByBranch[idx]
			n.label = `Цель ${branchNum}`
			if (oid) {
				n.detailText = formatFormalizatorObjectiveDetailBody(branchNum, oid)
			} else {
				n.detailText =
					"Уточните формулировку цели в запросе (выберите цель из каталога)."
			}
			continue
		}
	}

	const activeRealGoals = keysForPanels.filter(Boolean).length

	const edges = out.edges || []

	for (let k = 1; k <= SCENARIO_BRANCH_COUNT; k++) {
		const sid = `scenario-${k}`
		const causeTos = [
			...new Set(
				edges.filter((e) => e.from === sid && /^cause-\d+$/.test(e.to)).map((e) => e.to),
			),
		].sort((a, b) => numericSuffix(a, "cause") - numericSuffix(b, "cause"))

		const pg = perGoal[k - 1] || { causes: [], hyps: [] }
		for (let i = 0; i < causeTos.length; i++) {
			const node = out.nodes.find((x) => x.id === causeTos[i])
			if (!node) continue
			const rawCause = pg.causes[i] ?? "Причина"
			node.detailText = normalizeCauseHypDetailLine(rawCause)
		}

		const hypIdSet = new Set()
		for (const cid of causeTos) {
			for (const e of edges) {
				if (e.from === cid && /^hyp-\d+$/.test(e.to)) hypIdSet.add(e.to)
			}
		}
		const hypTos = [...hypIdSet].sort(
			(a, b) => numericSuffix(a, "hyp") - numericSuffix(b, "hyp"),
		)
		for (let j = 0; j < hypTos.length; j++) {
			const node = out.nodes.find((x) => x.id === hypTos[j])
			if (!node) continue
			const rawHyp = pg.hyps[j] ?? "Гипотеза"
			node.detailText = normalizeCauseHypDetailLine(rawHyp)
		}
	}

	pruneBundleToActiveScenarioBranches(out, preset, activeRealGoals)
	assignSemanticChainUiFlags(out, keysForPanels)

	assignDenseCauseHypLabels(out)
	const twinMeta = injectDigitalTwinChains(out)
	layoutTwinChains(out, twinMeta.chChains)
	relayoutScenarioOutcomeBalls(out.nodes)
	layoutTwinChains(out, twinMeta.hsChains)

	assignDenseScenarioOutcomeLabels(out)
	assignCdLabels(out)
	assignSemanticChainFlagsForCdNodes(out)
	assignCauseHypTwinDetailTexts(out)
	assignOutcomeScenarioSimulationSummaries(out)

	relaxGraphNodeCollisions(out.nodes, { iterations: 72, margin: 46 })
	repelNodesFromChordEdges(out.nodes, out.edges, { passes: 16, minClear: 58, strength: 0.58 })
	clampSemanticNodesToThinkingXBounds(out.nodes)
	relaxGraphNodeCollisions(out.nodes, { iterations: 36, margin: 36 })
	repelNodesFromChordEdges(out.nodes, out.edges, { passes: 8, minClear: 52, strength: 0.45 })
	repelCdNodesFromPillarBodies(out.nodes, { passes: 32, margin: 54 })
	repelScenarioOutcomeBallsAwayFromGraphNodes(out.nodes, { passes: 36 })
	clampThinkingGridNodesIntoStageBands(out.nodes)
	clampSemanticNodesToThinkingXBounds(out.nodes)

	const dimFinal = finalizeThinkingLayout(out.nodes, out.edges)
	const pinOptsTail = { scenarioJitterMax: 0, edgeInset: 52 }
	pinThinkingGridPillarSeamXs(out.nodes, { viewWidth: dimFinal.width, ...pinOptsTail })
	relayoutScenarioOutcomeBalls(out.nodes, dimFinal.width)
	const dimAfterPin = normalizeGraphBounds(out.nodes)
	nudgeCdNodesIntoEqualStageBands(out.nodes, dimAfterPin.width)
	clampSemanticNodesToThinkingXBounds(out.nodes)
	const dimOut = normalizeGraphBounds(out.nodes)
	pinThinkingGridPillarSeamXs(out.nodes, { viewWidth: dimOut.width, ...pinOptsTail })
	relayoutScenarioOutcomeBalls(out.nodes, dimOut.width)
	layoutTwinChains(out, twinMeta.hsChains)
	repelCdNodesFromPillarBodies(out.nodes, { passes: 36, margin: 56 })
	repelScenarioOutcomeBallsAwayFromGraphNodes(out.nodes, { passes: 54 })
	layoutTwinChains(out, twinMeta.hsChains)
	const m = measureGraphBounds(out.nodes)
	out.dimensions = {
		width: dimOut.width,
		height: Math.max(dimOut.height, m.height),
	}
	out.maxRevealWave = Math.max(
		0,
		...out.nodes.map((n) => Number(n.revealWave) || 0),
	)

	const optVarRaw = getOptimalVariantForAiPreset(preset)
	const optVar = Math.min(optVarRaw, activeRealGoals)
	const opt = computeOptimalScenarioClosure(
		out.edges,
		`scenario-${Math.max(1, optVar)}`,
	)
	out.optimalNodeIds = opt.nodeIds
	out.optimalEdgeKeys = opt.edgeKeys

	return out
}