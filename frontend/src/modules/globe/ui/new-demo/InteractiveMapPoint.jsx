import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import {
	globePointIsCtaPulse,
	newDemoRoseSyncPulseHex,
	newDemoRoseSyncPulseMix01,
} from "../../constants/globeCtaPulsePoints"
import { latLngToVector3 } from "./latLngToVector3"

/**
 * Размер маркеров на глобусе `/new-demo/face` (штифт, кольца, ореол у поверхности).
 * 1.0 ≈ прежний масштаб; увеличивайте для более крупных точек.
 */
export const NEW_DEMO_MAP_POINT_SIZE = 2.5

const Z_AXIS = new THREE.Vector3(0, 0, 1)
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const S = NEW_DEMO_MAP_POINT_SIZE
const RING_BASE_RADII = [0.1 * S, 0.19 * S, 0.28 * S]
const RING_ANIMATION_DELAYS = [0, 0.12, 0.22]
const PIN_RADIUS = 0.04 * S
const PIN_HEIGHT = 0.11 * S
const RING_STROKE_WIDTH = 0.04 * S
/** Смещение колец вдоль нормали от вершины штифта (вниз к сфере). */
const RING_ANCHOR_OFFSET = -0.07 * S
const GROUND_GLOW_SURFACE_OFFSET = 0.008 * S
const GROUND_GLOW_RADII = [0.16 * S, 0.27 * S]
const RING_GLOW_LAYER_OFFSETS = [-0.02 * S, -0.04 * S, -0.065 * S]
const RING_GLOW_LAYER_EXPAND = [0.012 * S, 0.032 * S, 0.058 * S]
const RING_GLOW_INSET = 0.006 * S
const RING_GLOW_LAYER_OPACITY = [0.22, 0.13, 0.07]
const SELECTED_PIN_COLOR = "#16D7FB"
const HOVERED_PIN_COLOR = "#2CE0FF"
/** CTA-штифт под курсором — остаётся в оранжевой палитре new-demo. */
const CTA_HOVER_PIN_COLOR = "#f97316"
const DEFAULT_IDLE_PIN_COLOR = "#16D7FB"

function getRingScale(progress, delay) {
	if (progress <= delay) return 0.001
	const normalized = Math.min(1, (progress - delay) / (1 - delay))
	return 0.001 + normalized * 0.999
}

function getPointPhaseOffset(pointId) {
	let hash = 0
	for (let i = 0; i < pointId.length; i += 1) {
		hash = (hash << 5) - hash + pointId.charCodeAt(i)
		hash |= 0
	}
	return (Math.abs(hash) % 628) / 100
}

export function InteractiveMapPoint({
	point,
	earthRadius,
	isActive,
	onToggle,
	onPositionComputed,
}) {
	const [isHovered, setIsHovered] = useState(false)
	const coreMaterialRef = useRef(null)
	const groundGlowRef = useRef(null)
	const groundGlowGroupRef = useRef(null)
	const ringGroupRef = useRef(null)
	const ringGradientRef = useRef(null)
	const animationProgressRef = useRef(isActive ? 1 : 0)
	const animationTargetRef = useRef(isActive ? 1 : 0)

	const surfacePosition = useMemo(() => latLngToVector3(point.lat, point.lon, earthRadius), [earthRadius, point.lat, point.lon])
	const normal = useMemo(() => surfacePosition.clone().normalize(), [surfacePosition])
	const domeQuaternion = useMemo(
		() => new THREE.Quaternion().setFromUnitVectors(Y_AXIS, normal),
		[normal],
	)
	const pinTopPosition = useMemo(
		() => surfacePosition.clone().add(normal.clone().multiplyScalar(PIN_HEIGHT)),
		[normal, surfacePosition],
	)
	const ringPosition = useMemo(
		() => pinTopPosition.clone().add(normal.clone().multiplyScalar(RING_ANCHOR_OFFSET)),
		[normal, pinTopPosition],
	)
	const groundGlowPosition = useMemo(
		() => surfacePosition.clone().add(normal.clone().multiplyScalar(GROUND_GLOW_SURFACE_OFFSET)),
		[normal, surfacePosition],
	)
	const ringQuaternion = useMemo(
		() => new THREE.Quaternion().setFromUnitVectors(Z_AXIS, normal),
		[normal],
	)
	const phaseOffset = useMemo(() => getPointPhaseOffset(point.id), [point.id])
	const isCtaPulsePoint = useMemo(
		() => globePointIsCtaPulse(point),
		[point.id, point.name],
	)
	const pinColorScratch = useRef(new THREE.Color())
	const resolvedPinColor = useMemo(() => {
		if (isActive) return SELECTED_PIN_COLOR
		if (isHovered && isCtaPulsePoint) return CTA_HOVER_PIN_COLOR
		if (isHovered) return HOVERED_PIN_COLOR
		return point.color || DEFAULT_IDLE_PIN_COLOR
	}, [isActive, isHovered, isCtaPulsePoint, point.color])

	const ctaPulseFrameDriven = useMemo(
		() => isCtaPulsePoint && !isActive && !isHovered,
		[isCtaPulsePoint, isActive, isHovered],
	)

	useLayoutEffect(() => {
		const mat = coreMaterialRef.current
		if (!mat || !ctaPulseFrameDriven) return
		const hex = newDemoRoseSyncPulseHex(performance.now() / 1000)
		mat.color.set(hex)
		mat.emissive.set(hex)
	}, [ctaPulseFrameDriven])

	useEffect(() => {
		onPositionComputed(point.id, ringPosition)
	}, [onPositionComputed, point.id, ringPosition])

	useEffect(() => {
		animationTargetRef.current = isActive ? 1 : 0
	}, [isActive])

	useFrame((state, delta) => {
		const breathing = Math.sin(state.clock.elapsedTime * 1.8 + phaseOffset)

		if (coreMaterialRef.current) {
			const t = state.clock.elapsedTime
			const ctaU = isCtaPulsePoint ? newDemoRoseSyncPulseMix01(t) : 0
			const pinHex =
				isActive
					? SELECTED_PIN_COLOR
					: isHovered && isCtaPulsePoint
						? CTA_HOVER_PIN_COLOR
						: isHovered
							? HOVERED_PIN_COLOR
							: isCtaPulsePoint
								? newDemoRoseSyncPulseHex(t)
								: resolvedPinColor
			pinColorScratch.current.set(pinHex)
			coreMaterialRef.current.color.copy(pinColorScratch.current)
			coreMaterialRef.current.emissive.copy(pinColorScratch.current)
			/* как opacity/толщина контура у розы: заметнее на пике */
			coreMaterialRef.current.emissiveIntensity = isActive
				? 0.92
				: isHovered && isCtaPulsePoint
					? 0.96
					: isCtaPulsePoint
						? 0.62 + ctaU * 0.42
						: 0.88 + breathing * 0.04
		}
		if (groundGlowGroupRef.current) {
			groundGlowGroupRef.current.visible = isActive || animationProgressRef.current > 0.02
		}
		if (groundGlowRef.current && groundGlowGroupRef.current?.visible) {
			groundGlowRef.current.scale.setScalar(1 + breathing * 0.01)
		}

		const smoothing = 1 - Math.exp(-delta * 7.5)
		animationProgressRef.current +=
			(animationTargetRef.current - animationProgressRef.current) * smoothing

		if (ringGroupRef.current) {
			ringGroupRef.current.children.forEach((child, index) => {
				const scale = getRingScale(animationProgressRef.current, RING_ANIMATION_DELAYS[index])
				child.scale.set(scale, scale, scale)
				child.visible = isActive || animationProgressRef.current > 0.02
			})
		}

		if (ringGradientRef.current) {
			ringGradientRef.current.children.forEach((child) => {
				const baseScale = animationProgressRef.current <= 0.02 ? 0.001 : animationProgressRef.current
				child.scale.set(baseScale, baseScale, baseScale)
				child.visible = isActive || animationProgressRef.current > 0.02
			})
		}
	}, [isActive, isCtaPulsePoint, isHovered, resolvedPinColor, phaseOffset, ctaPulseFrameDriven])

	return (
		<group
			onClick={(event) => {
				event.stopPropagation()
				onToggle(point.id)
			}}
			onPointerOver={(event) => {
				event.stopPropagation()
				setIsHovered(true)
				document.body.style.cursor = "pointer"
			}}
			onPointerOut={() => {
				setIsHovered(false)
				document.body.style.cursor = "default"
			}}
		>
			<group position={surfacePosition} quaternion={domeQuaternion}>
				<mesh>
					<cylinderGeometry args={[PIN_RADIUS, PIN_RADIUS * 0.72, PIN_HEIGHT, 18]} />
					<meshStandardMaterial
						ref={coreMaterialRef}
						{...(ctaPulseFrameDriven
							? {}
							: {
									color: resolvedPinColor,
									emissive: resolvedPinColor,
									emissiveIntensity: 0.92,
								})}
					/>
				</mesh>
			</group>

			<group ref={groundGlowGroupRef} position={groundGlowPosition} quaternion={ringQuaternion}>
				<mesh ref={groundGlowRef}>
					<circleGeometry args={[GROUND_GLOW_RADII[0], 36]} />
					<meshBasicMaterial color="#16D7FB" transparent opacity={0.14} depthWrite={false} />
				</mesh>
				<mesh>
					<circleGeometry args={[GROUND_GLOW_RADII[1], 36]} />
					<meshBasicMaterial color="#16D7FB" transparent opacity={0.06} depthWrite={false} />
				</mesh>
			</group>

			<group ref={ringGroupRef} position={ringPosition} quaternion={ringQuaternion}>
				{RING_BASE_RADII.map((radius) => (
					<mesh key={`${point.id}-ring-${radius}`}>
						<ringGeometry args={[radius, radius + RING_STROKE_WIDTH, 64]} />
						<meshBasicMaterial
							color="#16D7FB"
							transparent
							opacity={0.7}
							side={THREE.DoubleSide}
							depthWrite={false}
						/>
					</mesh>
				))}
			</group>

			<group ref={ringGradientRef} position={ringPosition} quaternion={ringQuaternion}>
				{RING_BASE_RADII.map((radius) =>
					RING_GLOW_LAYER_OFFSETS.map((offset, layerIndex) => {
						const expand = RING_GLOW_LAYER_EXPAND[layerIndex]
						const innerRadius = radius - RING_GLOW_INSET + expand
						const outerRadius = radius + RING_STROKE_WIDTH + expand
						return (
							<mesh key={`${point.id}-ring-glow-${radius}-${offset}`} position={[0, 0, offset]}>
								<ringGeometry args={[innerRadius, outerRadius, 64]} />
								<meshBasicMaterial
									color="#16D7FB"
									transparent
									opacity={RING_GLOW_LAYER_OPACITY[layerIndex]}
									side={THREE.DoubleSide}
									depthWrite={false}
								/>
							</mesh>
						)
					}),
				)}
			</group>
		</group>
	)
}
