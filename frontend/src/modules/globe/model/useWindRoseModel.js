import { useMemo } from "react"
import { useRosesData } from "./useRosesData"

export const WIND_ROSE_LAYOUT = {
	RADIUS: 100,
	CENTER_X: 160,
	CENTER_Y: 160,
	SVG_VIEW_SIZE: 200,
	WRAPPER_SIZE: 380,
	LABEL_RADIUS: 138,
	LABEL_W: 88,
	LABEL_H: 26,
}

/** Подписи снаружи SVG для stand HUD (как demo-stand WindRose). */
const STAND_LABEL_OVERRIDES = {
	LABEL_RADIUS: 140,
	LABEL_W: 102,
	LABEL_H: 30,
}

/**
 * Геометрия и цвета лепестков розы ветров (общая для main и demo stand).
 * @param {boolean} [standVisual] — режим визуала демо-стенда (?demo=stand#face)
 */
export function useWindRoseModel({ data, type = "left", standVisual = false }) {
	const { petalColorFromCoverage } = useRosesData()
	const layout = useMemo(
		() => ({
			...WIND_ROSE_LAYOUT,
			...(standVisual ? STAND_LABEL_OVERRIDES : {}),
		}),
		[standVisual],
	)
	const { RADIUS, CENTER_X, CENTER_Y } = layout

	const numItems = data.length
	const angleStep = numItems > 0 ? (2 * Math.PI) / numItems : 0

	const segments = useMemo(() => {
		if (!numItems) return []
		const baseline = data.map((d) => Math.max(0, (d.value / 100) * RADIUS * 0.55))
		return data.map((item, index) => {
			const angle = index * angleStep - Math.PI / 2
			const midAngle = angle + angleStep / 2
			const length = (item.value / 100) * RADIUS
			const xEnd = CENTER_X + Math.cos(midAngle) * length
			const yEnd = CENTER_Y + Math.sin(midAngle) * length
			const baseLen = baseline[index]
			const xBase = CENTER_X + Math.cos(midAngle) * baseLen
			const yBase = CENTER_Y + Math.sin(midAngle) * baseLen
			const petalColor = petalColorFromCoverage(item.coverage)
			return {
				...item,
				midAngle,
				xEnd,
				yEnd,
				xBase,
				yBase,
				petalColor,
			}
		})
	}, [data, angleStep, numItems, petalColorFromCoverage, RADIUS, CENTER_X, CENTER_Y])

	const contourPath = useMemo(() => {
		if (segments.length === 0) return ""
		const pts = segments.map((s) => `${s.xEnd},${s.yEnd}`).join(" L ")
		return `M ${pts} Z`
	}, [segments])

	const isLeft = type === "left"

	return {
		layout,
		segments,
		contourPath,
		angleStep,
		data,
		isLeft,
		petalColorFromCoverage,
	}
}
