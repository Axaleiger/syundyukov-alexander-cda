import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { useMapGlobeData } from "./useMapGlobeData"
import { simplifyFeatures } from "../../../shared/lib/simplifyGeoJsonRing"
import { geojsonFeaturesToPaths } from "../../../shared/lib/geojsonToPaths"
import { buildAssetVoronoiFeatures } from "../../../shared/lib/assetVoronoiZones"

/** Береговая линия материков (Natural Earth 50m / 110m). */
const worldCoastlineUrl50m =
	"https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_coastline.geojson"
const worldCoastlineUrl110m =
	"https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_coastline.geojson"

/** Прямоугольник для Voronoi зон вокруг активов (РФ + запас по краям). */
export const ASSET_VORONOI_BBOX = { lngMin: 18, lngMax: 138, latMin: 39, latMax: 76 }

/**
 * Общая подготовка данных и UI-состояния слоёв карты для react-globe.gl.
 * Без привязки к main vs demo stand (размер canvas, POV, оболочка — в презентерах).
 */
export function useRussiaGlobeMapModel({ onAssetSelect, globeRef }) {
	const { mapPointsData, cfArrows: CF_ARROWS, chainsData, getBudgetForAssetId } = useMapGlobeData()

	const [coastlinePaths, setCoastlinePaths] = useState([])
	const [webglOk, setWebglOk] = useState(true)

	const [showBudgetFill, setShowBudgetFill] = useState(false)
	const [showCFArrows, setShowCFArrows] = useState(false)

	const [selectedAssetId, setSelectedAssetId] = useState(null)
	const [hoveredAssetId, setHoveredAssetId] = useState(null)
	const [hoveredArcIndex, setHoveredArcIndex] = useState(null)

	const keyAssetIds = useMemo(() => new Set(["do-yamal", "do-noyabrsk", "do-megion"]), [])

	const arrowGeomRef = useRef(null)
	const arrowMatRef = useRef(null)

	const globeMaterial = useMemo(
		() =>
			new THREE.MeshPhongMaterial({
				color: new THREE.Color("#071827"),
				emissive: new THREE.Color("#071827"),
				shininess: 6,
			}),
		[],
	)

	useEffect(() => {
		let cancelled = false
		async function loadCoastlines() {
			const tryUrls = [worldCoastlineUrl50m, worldCoastlineUrl110m]
			for (const url of tryUrls) {
				try {
					const r = await fetch(url)
					if (!r.ok) throw new Error(`HTTP ${r.status}`)
					const json = await r.json()
					if (cancelled) return
					const feats = Array.isArray(json?.features) ? json.features : []
					const simplified = simplifyFeatures(feats, 200)
					setCoastlinePaths(
						geojsonFeaturesToPaths(
							simplified,
							{ alt: 0.0026, maxPointsPerRing: 260, datelineJumpDeg: 180 },
							"coast",
						),
					)
					return
				} catch (_) {
					// try next url
				}
			}
			if (!cancelled) setCoastlinePaths([])
		}
		const t = window.setTimeout(() => {
			loadCoastlines()
		}, 600)
		return () => {
			cancelled = true
			clearTimeout(t)
		}
	}, [])

	const arcsData = useMemo(() => {
		const byId = new Map(mapPointsData.map((p) => [p.id, p]))
		return CF_ARROWS.map((a) => {
			const from = byId.get(a.from)
			const to = byId.get(a.to)
			if (!from || !to) return null
			return {
				startLat: from.lat,
				startLng: from.lon,
				endLat: to.lat,
				endLng: to.lon,
				cf: a.cf,
				label: `${from.name} → ${to.name}`,
			}
		}).filter(Boolean)
	}, [mapPointsData, CF_ARROWS])

	const arrowHeadsData = useMemo(
		() =>
			arcsData.map((a, idx) => ({
				id: `cf-arrow-${idx}`,
				startLat: a.startLat,
				startLng: a.startLng,
				endLat: a.endLat,
				endLng: a.endLng,
				altitude: 0,
				hovered: idx === hoveredArcIndex,
			})),
		[arcsData, hoveredArcIndex],
	)

	const budgetZoneFeatures = useMemo(
		() => buildAssetVoronoiFeatures(mapPointsData, ASSET_VORONOI_BBOX, getBudgetForAssetId),
		[mapPointsData, getBudgetForAssetId],
	)

	const ringsData = useMemo(() => {
		const base = mapPointsData || []
		return base.flatMap((p) => [
			{ ...p, __ringIdx: 0 },
			{ ...p, __ringIdx: 1 },
		])
	}, [mapPointsData])

	const allPathsData = useMemo(() => [...(coastlinePaths || [])], [coastlinePaths])

	const polygonCapColor = useCallback((feat) => {
		if (!showBudgetFill) return "rgba(0,0,0,0)"
		const v = feat?.properties?.__budget
		if (v == null || !Number.isFinite(v)) return "rgba(34,211,238,0.12)"
		const t = Math.max(-1, Math.min(1, v))
		const s = (t + 1) / 2
		const from = { r: 25, g: 118, b: 210 }
		const to = { r: 56, g: 142, b: 60 }
		const r = Math.round(from.r + (to.r - from.r) * s)
		const gch = Math.round(from.g + (to.g - from.g) * s)
		const b = Math.round(from.b + (to.b - from.b) * s)
		return `rgba(${r},${gch},${b},0.38)`
	}, [showBudgetFill])

	const polygonSideColor = useCallback(
		(d) => {
			if (!showBudgetFill) return "rgba(0,0,0,0)"
			const v = d?.properties?.__budget
			if (v == null || !Number.isFinite(v)) return "rgba(34,211,238,0.08)"
			const t = Math.max(-1, Math.min(1, v))
			const s = (t + 1) / 2
			const from = { r: 25, g: 118, b: 210 }
			const to = { r: 56, g: 142, b: 60 }
			const r = Math.round(from.r + (to.r - from.r) * s)
			const gch = Math.round(from.g + (to.g - from.g) * s)
			const b = Math.round(from.b + (to.b - from.b) * s)
			return `rgba(${r},${gch},${b},0.22)`
		},
		[showBudgetFill],
	)

	const polygonLabel = useCallback(
		(feat) => {
			const name = feat?.properties?.name ?? "Актив"
			const v = feat?.properties?.__budget
			if (!showBudgetFill || v == null || !Number.isFinite(v)) {
				return `<div style="font-weight:700">${name}</div>`
			}
			const pct = Math.round(((v + 1) / 2) * 100)
			const sign = v > 0 ? "+" : ""
			return `<div style="font-weight:700">${name}</div><div style="opacity:.85">Бюджет: ${sign}${v.toFixed(2)} (${pct}%)</div>`
		},
		[showBudgetFill],
	)

	const pointLabel = useCallback(
		(p) => {
			if (!p) return ""
			const isSelected = selectedAssetId === p.id
			return `<div style="font-weight:700">${p.name}</div>${isSelected ? '<div style="opacity:.85">Выбрано</div>' : ""}`
		},
		[selectedAssetId],
	)

	const getArrowThreeObject = useCallback((d) => {
		if (!arrowGeomRef.current) arrowGeomRef.current = new THREE.ConeGeometry(0.55, 1.6, 10, 1)
		if (!arrowMatRef.current) arrowMatRef.current = new THREE.MeshBasicMaterial({ color: "#22d3ee" })
		const mesh = new THREE.Mesh(arrowGeomRef.current, arrowMatRef.current)
		mesh.userData.__isArrow = true
		return mesh
	}, [])

	const updateArrowThreeObject = useCallback((obj, d) => {
		const globe = globeRef.current
		if (!globe?.getCoords) return obj
		const alt = d.altitude ?? 0
		const s = globe.getCoords(d.startLat, d.startLng, alt)
		const e = globe.getCoords(d.endLat, d.endLng, alt)
		if (!s || !e) return obj

		const end = new THREE.Vector3(e.x, e.y, e.z)
		const start = new THREE.Vector3(s.x, s.y, s.z)
		const dir = end.clone().sub(start).normalize()

		obj.position.copy(end)
		obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
		obj.material.color.set(d.hovered ? "#f97316" : "#22d3ee")
		return obj
	}, [globeRef])

	const setSelectedAssetIdAndNotify = useCallback(
		(next) => {
			setSelectedAssetId(next)
			onAssetSelect?.(next)
		},
		[onAssetSelect],
	)

	const toggleSelectedFromPoint = useCallback(
		(p) => {
			if (!p?.id) return
			const next = selectedAssetId === p.id ? null : p.id
			setSelectedAssetIdAndNotify(next)
			return next
		},
		[selectedAssetId, setSelectedAssetIdAndNotify],
	)

	useEffect(() => {
		if (!import.meta?.env?.DEV) return
		const zoneCount = Array.isArray(budgetZoneFeatures) ? budgetZoneFeatures.length : 0
		const coastSegCount = Array.isArray(coastlinePaths) ? coastlinePaths.length : 0
		console.log("[RussiaGlobeMapModel] counts", { zoneCount, coastSegCount, showBudgetFill })
	}, [budgetZoneFeatures, coastlinePaths, showBudgetFill])

	const chain = selectedAssetId ? chainsData[selectedAssetId] : null

	return {
		mapPointsData,
		chainsData,
		chain,
		webglOk,
		setWebglOk,
		showBudgetFill,
		setShowBudgetFill,
		showCFArrows,
		setShowCFArrows,
		selectedAssetId,
		setSelectedAssetId,
		setSelectedAssetIdAndNotify,
		toggleSelectedFromPoint,
		hoveredAssetId,
		setHoveredAssetId,
		hoveredArcIndex,
		setHoveredArcIndex,
		keyAssetIds,
		globeMaterial,
		arcsData,
		arrowHeadsData,
		budgetZoneFeatures,
		ringsData,
		allPathsData,
		polygonCapColor,
		polygonSideColor,
		polygonLabel,
		pointLabel,
		getArrowThreeObject,
		updateArrowThreeObject,
		pointsMerge: false,
	}
}

export function getCdPageUrl(nodeName) {
	if (typeof window === "undefined") return "#"
	const base = window.location.origin + (window.location.pathname || "/")
	const sep = base.includes("?") ? "&" : "?"
	return `${base}${sep}cd=${encodeURIComponent(nodeName)}`
}
