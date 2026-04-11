/**
 * Генерирует JSON доски BPM из xlsx (docs/scenario_exports).
 * Запуск: node scripts/generateAiBoardsFromXlsx.mjs
 */
import XLSX from "xlsx"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOCS = path.resolve(__dirname, "../../../docs/scenario_exports")
const OUT = path.resolve(__dirname, "../src/modules/planning/data/generated/aiBoardsFromXlsx.json")

function excelSerialToDate(serial) {
	if (serial == null || serial === "") return new Date()
	const n = Number(serial)
	if (!Number.isFinite(n)) return new Date()
	const utcDays = Math.floor(n - 25569)
	const utcValue = utcDays * 86400
	const dateInfo = new Date(utcValue * 1000)
	const fractionalDay = n - Math.floor(n) + 1e-12
	let totalSeconds = Math.floor(86400 * fractionalDay)
	const seconds = totalSeconds % 60
	totalSeconds -= seconds
	const hours = Math.floor(totalSeconds / (60 * 60))
	const minutes = Math.floor(totalSeconds / 60) % 60
	dateInfo.setHours(hours, minutes, seconds, 0)
	return dateInfo
}

function sheetToBoard(rows) {
	if (!rows?.length) return { stages: [], tasks: {}, connections: [] }
	const header = rows[0].map((c) => String(c || "").trim())
	const idx = {
		stage: header.findIndex((h) => h.includes("Этап") && h.includes("Название")),
		id: header.findIndex((h) => h.includes("Карточка ID")),
		name: header.findIndex((h) => h === "Карточка Название" || (h.includes("Карточка") && h.includes("Название"))),
		exec: header.findIndex((h) => h.includes("Исполнитель")),
		appr: header.findIndex((h) => h.includes("Согласующий")),
		deadline: header.findIndex((h) => h.includes("Срок")),
		status: header.findIndex((h) => h.includes("Статус")),
		date: header.findIndex((h) => h.includes("Дата создания")),
	}

	const tasks = {}
	const stageOrder = []
	const seen = new Set()

	for (let r = 1; r < rows.length; r += 1) {
		const row = rows[r]
		if (!row || !row.length) continue
		const stageName = String(row[idx.stage] ?? "").trim()
		const cardName = String(row[idx.name] ?? "").trim()
		if (!stageName || !cardName) continue
		if (!seen.has(stageName)) {
			seen.add(stageName)
			stageOrder.push(stageName)
		}
		const id = String(row[idx.id] ?? `R${r}`).trim()
		const deadline = excelSerialToDate(row[idx.deadline])
		const created = excelSerialToDate(row[idx.date])
		const task = {
			id,
			name: cardName,
			executor: String(row[idx.exec] ?? "").trim() || "—",
			approver: String(row[idx.appr] ?? "").trim() || "—",
			deadline,
			status: String(row[idx.status] ?? "в работе").trim(),
			date: created.toLocaleDateString("ru-RU"),
			entries: [{ system: "", input: "", output: "" }],
			scheduleEvery: "каждые 2 дня",
			periodStart: created,
			periodEnd: deadline,
		}
		if (!tasks[stageName]) tasks[stageName] = []
		tasks[stageName].push(task)
	}

	return { stages: stageOrder, tasks, connections: [] }
}

const FILES = {
	base_drilling: "Управление добычей с учетом ближайшего бурения.xlsx",
	fcf_no_drill: "tasks_board_fcf_no_drill.xlsx",
	opex_reduction: "tasks_board_opex_reduction.xlsx",
}

const SCENARIO_NAMES = {
	base_drilling: "Управление добычей с учетом ближайшего бурения",
	fcf_no_drill: "Ребаланс CAPEX и отказ от бурения новых скважин",
	opex_reduction: "Удельный OPEX и энергозатраты при удержании добычи",
}

const out = {}
for (const [key, file] of Object.entries(FILES)) {
	const fp = path.join(DOCS, file)
	if (!fs.existsSync(fp)) {
		console.warn("skip missing", fp)
		continue
	}
	const wb = XLSX.readFile(fp)
	const sheetName = wb.SheetNames[0]
	const sh = wb.Sheets[sheetName]
	const data = XLSX.utils.sheet_to_json(sh, { header: 1, defval: "" })
	const board = sheetToBoard(data)
	board.scenarioName = SCENARIO_NAMES[key] || key
	out[key] = board
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8")
console.log("written", OUT, Object.keys(out))
