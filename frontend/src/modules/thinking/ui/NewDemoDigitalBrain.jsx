import React, { useEffect, useMemo, useRef } from "react"
import "./NewDemoDigitalBrain.css"

function clamp(v, min, max) {
	return Math.max(min, Math.min(max, v))
}

function buildSurfaceGrid() {
	const points = []
	const latSteps = 50
	const maxLon = 72
	let id = 0
	for (let lat = 0; lat < latSteps; lat += 1) {
		const v = (lat + 0.5) / latSteps
		const theta = v * Math.PI
		const s = Math.sin(theta)
		const lonCount = Math.max(18, Math.round(maxLon * (0.28 + 0.72 * s)))
		for (let lon = 0; lon < lonCount; lon += 1) {
			const u = lon / lonCount
			const phi = u * Math.PI * 2
			const x = Math.sin(theta) * Math.cos(phi)
			const y = Math.cos(theta)
			const z = Math.sin(theta) * Math.sin(phi)
			const phase =
				Math.sin(phi * 2.0) * 1.35 +
				Math.cos(phi * 3.0) * 0.95 +
				Math.sin(theta * 2.4) * 1.1
			const glowSeed = Math.sin(phi * 1.7) * 2.1 + Math.cos(theta * 3.1) * 1.3
			points.push({ x, y, z, u, v, phase, glowSeed, id })
			id += 1
		}
	}
	return points
}

function deformPoint(p, t) {
	const waveA = Math.sin(p.x * 5.9 + p.y * 4.8 - t * 2.4 + p.phase) * 0.12
	const waveB = Math.cos(p.z * 6.2 - p.x * 3.5 + t * 1.8) * 0.09
	const waveC = Math.sin((p.x + p.z) * 4.8 - t * 1.5 + p.phase * 0.35) * 0.06
	const shell = 1.0 + waveA + waveB + waveC
	return {
		x: p.x * shell,
		y: p.y * (shell * 1.03),
		z: p.z * shell,
	}
}

function smooth(current, target, speed = 0.12) {
	return current + (target - current) * speed
}

export default function NewDemoDigitalBrain({
	graphProgressPercent = null,
}) {
	const canvasRef = useRef(null)
	const points = useMemo(() => buildSurfaceGrid(), [])
	const projectedRef = useRef([])
	const rafRef = useRef(0)
	const centerRef = useRef({ x: 0, y: 0 })
	const progressRef = useRef(0)
	const graphProgressTargetRef = useRef(graphProgressPercent)

	useEffect(() => {
		graphProgressTargetRef.current = graphProgressPercent
	}, [graphProgressPercent])

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext("2d")
		if (!ctx) return

		let resizeRaf = 0
		const resize = () => {
			const rect = canvas.getBoundingClientRect()
			const w = Math.max(0, Math.round(rect.width))
			const h = Math.max(0, Math.round(rect.height))
			if (w < 2 || h < 2) return
			const dpr = Math.min(window.devicePixelRatio || 1, 2)
			const nextW = Math.round(w * dpr)
			const nextH = Math.round(h * dpr)
			if (canvas.width === nextW && canvas.height === nextH) {
				centerRef.current = { x: w / 2, y: h / 2 }
				return
			}
			canvas.width = nextW
			canvas.height = nextH
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
			centerRef.current = { x: w / 2, y: h / 2 }
		}

		const scheduleResize = () => {
			if (resizeRaf) cancelAnimationFrame(resizeRaf)
			resizeRaf = requestAnimationFrame(() => {
				resizeRaf = 0
				resize()
			})
		}

		resize()
		const ro = new ResizeObserver(scheduleResize)
		ro.observe(canvas)

		const render = (timeMs) => {
			const t = timeMs * 0.001
			const g = graphProgressTargetRef.current
			const target =
				g != null && Number.isFinite(g) ? clamp(g, 0, 100) : 0
			progressRef.current = smooth(progressRef.current, target, 0.08)

			const width = canvas.clientWidth
			const height = canvas.clientHeight
			if (width && height) {
				ctx.clearRect(0, 0, width, height)
				const projected = projectedRef.current
				projected.length = 0

				const baseScale = Math.min(width, height) * 0.315
				const yaw = t * 0.22 + Math.sin(t * 0.44) * 0.2
				const pitch = t * 0.13 + Math.sin(t * 0.31) * 0.1
				const roll = t * 0.17 + Math.sin(t * 0.27) * 0.08
				const cam = 3.45

				for (let i = 0; i < points.length; i += 1) {
					const p = points[i]
					const d = deformPoint(p, t)

					const xYaw = d.x * Math.cos(yaw) - d.z * Math.sin(yaw)
					const zYaw = d.x * Math.sin(yaw) + d.z * Math.cos(yaw)
					const yPitch = d.y * Math.cos(pitch) - zYaw * Math.sin(pitch)
					const zPitch = d.y * Math.sin(pitch) + zYaw * Math.cos(pitch)
					const xRoll = xYaw * Math.cos(roll) - yPitch * Math.sin(roll)
					const yRoll = xYaw * Math.sin(roll) + yPitch * Math.cos(roll)

					const persp = cam / (cam - zPitch)
					const x2 = centerRef.current.x + xRoll * baseScale * persp
					const y2 = centerRef.current.y + yRoll * baseScale * persp

					const deepBlue = { r: 0.06, g: 0.30, b: 0.62 }
					const midBlue = { r: 0.08, g: 0.47, b: 0.73 }
					const lightBlue = { r: 0.23, g: 0.66, b: 0.84 }
					const orange = { r: 0.95, g: 0.37, b: 0.0 }

					const vTone = clamp((yPitch + 1.1) / 2.2, 0, 1)
					const midMix = 0.5 + Math.sin(t * 1.2 + p.phase) * 0.08
					let rCol = deepBlue.r * (1 - vTone) + midBlue.r * vTone
					let gCol = deepBlue.g * (1 - vTone) + midBlue.g * vTone
					let bCol = deepBlue.b * (1 - vTone) + midBlue.b * vTone
					rCol = rCol * (1 - midMix) + lightBlue.r * midMix
					gCol = gCol * (1 - midMix) + lightBlue.g * midMix
					bCol = bCol * (1 - midMix) + lightBlue.b * midMix

					const period = 4.8
					const sweepPhase = ((t + 0.7) % period) / period
					const sweepX = -1.25 + sweepPhase * 2.5
					const dist = Math.abs(xYaw - sweepX)
					const stripe = Math.exp(-(dist * dist) / 0.036)
					const gate = Math.sin(Math.PI * sweepPhase)
					const orangeBoost = stripe * gate * 1.25

					const frontBoost = clamp((zPitch + 1.2) / 2.4, 0, 1) * 0.22
					const shimmer =
						Math.sin(t * 4.2 + p.glowSeed + p.x * 5.0 - p.y * 3.8) * 0.5 + 0.5
					const glowBoost = shimmer * 0.26 + orangeBoost * 0.38
					const whiteBoost =
						Math.pow(shimmer, 3.0) *
						0.62 *
						(1 - Math.min(1, orangeBoost * 1.1))

					rCol = rCol * (1 - orangeBoost) + orange.r * orangeBoost
					gCol = gCol * (1 - orangeBoost) + orange.g * orangeBoost
					bCol = bCol * (1 - orangeBoost) + orange.b * orangeBoost

					const virtual = (progressRef.current / 100) * points.length
					const greenMix = clamp(virtual - p.id, 0, 1)
					const greenBright = { r: 0.05, g: 1, b: 0.35 }
					rCol = rCol * (1 - greenMix) + greenBright.r * greenMix
					gCol = gCol * (1 - greenMix) + greenBright.g * greenMix
					bCol = bCol * (1 - greenMix) + greenBright.b * greenMix

					projected.push({
						z: zPitch,
						x: x2,
						y: y2,
						rad: (1.18 + glowBoost * 0.68) * persp,
						a:
							0.40 +
							persp * 0.34 +
							frontBoost * 0.20 +
							glowBoost * 0.30 +
							whiteBoost * 0.08,
						rr: Math.round(
							Math.min(1, rCol + glowBoost * 0.24 + whiteBoost * 0.36) * 255,
						),
						gg: Math.round(
							Math.min(
								1,
								gCol + frontBoost * 0.20 + glowBoost * 0.28 + whiteBoost * 0.36,
							) * 255,
						),
						bb: Math.round(
							Math.min(
								1,
								bCol + frontBoost * 0.24 + glowBoost * 0.34 + whiteBoost * 0.36,
							) * 255,
						),
					})
				}

				projected.sort((a, b) => a.z - b.z)
				ctx.globalCompositeOperation = "lighter"
				for (let i = 0; i < projected.length; i += 1) {
					const p = projected[i]
					ctx.fillStyle = `rgba(${p.rr}, ${p.gg}, ${p.bb}, ${p.a.toFixed(3)})`
					ctx.beginPath()
					ctx.arc(p.x, p.y, p.rad, 0, Math.PI * 2)
					ctx.fill()
				}
				ctx.globalCompositeOperation = "source-over"
			}
			rafRef.current = requestAnimationFrame(render)
		}

		rafRef.current = requestAnimationFrame(render)
		return () => {
			if (resizeRaf) cancelAnimationFrame(resizeRaf)
			if (rafRef.current) cancelAnimationFrame(rafRef.current)
			ro.disconnect()
		}
	}, [points])

	return (
		<div className="new-demo-brain-root">
			<canvas ref={canvasRef} className="new-demo-brain-canvas" />
		</div>
	)
}
