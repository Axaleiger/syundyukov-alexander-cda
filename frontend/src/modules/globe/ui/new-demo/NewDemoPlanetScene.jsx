import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import styles from "./NewDemoPlanetScene.module.css"
import EARTH_JSON_OBJECT from "../../../../shared/assets/Earth.json"
import { InteractiveMapPoint } from "./InteractiveMapPoint"
import { MapPointConnectorLine } from "./MapPointConnectorLine"
import { MapPointTooltip } from "./MapPointTooltip"

const EARTH_RADIUS = 10
const PLANET_CENTER_TARGET = [0, 8, 0]
const CAMERA_POSITION = [0, 0, 0]
const CAMERA_FOV = 41
const FIXED_POLAR_ANGLE = 1.05
const AZIMUTH_LIMIT = THREE.MathUtils.degToRad(35)
const PLANET_ROTATION_Y = Math.PI
const LOCKED_CAMERA_DISTANCE = 30

function removeEmbeddedCameras(root) {
	const cameras = []
	root.traverse((obj) => {
		if (obj.isCamera) cameras.push(obj)
	})
	for (const camera of cameras) {
		camera.parent?.remove(camera)
	}
}

function normalizeToRadius(root, nextRadius) {
	let maxRadius = 0
	const point = new THREE.Vector3()
	root.traverse((obj) => {
		const position = obj.geometry?.attributes?.position
		if (!obj.isMesh || !position) return
		for (let i = 0; i < position.count; i += 1) {
			point.set(position.getX(i), position.getY(i), position.getZ(i))
			maxRadius = Math.max(maxRadius, point.length())
		}
	})
	if (!maxRadius) return
	const scale = nextRadius / maxRadius
	root.scale.setScalar(scale)
}

function centerRootAtOrigin(root) {
	const box = new THREE.Box3().setFromObject(root)
	if (box.isEmpty()) return
	const center = new THREE.Vector3()
	box.getCenter(center)
	root.position.sub(center)
}

function useEarthSceneFromJson() {
	const [state, setState] = useState({ loading: true, sceneRoot: null, error: null })

	useEffect(() => {
		let alive = true
		try {
			const loader = new THREE.ObjectLoader()
			const sceneRoot = loader.parse(EARTH_JSON_OBJECT.scene)
			if (!alive) return
			removeEmbeddedCameras(sceneRoot)
			normalizeToRadius(sceneRoot, EARTH_RADIUS)
			centerRootAtOrigin(sceneRoot)
			setState({ loading: false, sceneRoot, error: null })
		} catch (error) {
			if (!alive) return
			setState({ loading: false, sceneRoot: null, error })
		}
		return () => {
			alive = false
		}
	}, [])

	return state
}

function PlanetSceneContent({
	sceneRoot,
	points,
	activePointId,
	onTogglePoint,
	onActivePointScreenPosition,
}) {
	const groupRef = useRef(null)
	const runtimeScene = useThree((state) => state.scene)
	const gl = useThree((state) => state.gl)
	const camera = useThree((state) => state.camera)
	const size = useThree((state) => state.size)
	const envTargetRef = useRef(null)
	const pointPositionsRef = useRef(new Map())

	useEffect(() => {
		document.body.style.cursor = "default"
		return () => {
			document.body.style.cursor = "default"
		}
	}, [])

	useEffect(() => {
		// Three.js Editor applies environment/background on the active renderer scene.
		// The imported JSON is a nested THREE.Scene; its env/background won't affect the parent Canvas scene
		// unless we explicitly apply them.
		if (!sceneRoot) return

		const prevEnvironment = runtimeScene.environment

		// Keep canvas transparent: preserve env lighting, but do not paint runtime background.
		// eslint-disable-next-line
		runtimeScene.background = null

		const importedEnv = sceneRoot.environment
		if (importedEnv) {
			const pmrem = new THREE.PMREMGenerator(gl)
			pmrem.compileEquirectangularShader()
			const envTarget = pmrem.fromEquirectangular(importedEnv)
			pmrem.dispose()
			envTargetRef.current = envTarget
			runtimeScene.environment = envTarget.texture
		}

		return () => {
			runtimeScene.background = null
			runtimeScene.environment = prevEnvironment
			envTargetRef.current?.dispose()
			envTargetRef.current = null
		}
	}, [gl, runtimeScene, sceneRoot])

	const activePointPosition = activePointId ? pointPositionsRef.current.get(activePointId) || null : null

	const handlePositionComputed = useCallback((pointId, position) => {
		pointPositionsRef.current.set(pointId, position.clone())
	}, [])

	useFrame(() => {
		if (!activePointPosition) {
			onActivePointScreenPosition(null)
			return
		}
		const worldAnchor = groupRef.current
			? groupRef.current.localToWorld(activePointPosition.clone())
			: activePointPosition.clone()
		const projected = worldAnchor.project(camera)
		const x = (projected.x * 0.5 + 0.5) * size.width
		const y = (-projected.y * 0.5 + 0.5) * size.height
		const isInFrustum =
			projected.z > -1 &&
			projected.z < 1 &&
			projected.x > -1.3 &&
			projected.x < 1.3 &&
			projected.y > -1.3 &&
			projected.y < 1.3
		onActivePointScreenPosition({
			x,
			y,
			width: size.width,
			height: size.height,
			visible: isInFrustum,
		})
	})

	return (
		<>
			<group ref={groupRef} rotation={[0, PLANET_ROTATION_Y, 0]} scale={1.8}>
				<primitive object={sceneRoot} />
				{points.map((point) => (
					<InteractiveMapPoint
						key={point.id}
						point={point}
						earthRadius={EARTH_RADIUS}
						isActive={activePointId === point.id}
						onToggle={onTogglePoint}
						onPositionComputed={handlePositionComputed}
					/>
				))}
			</group>
			<OrbitControls
				enablePan={false}
				minDistance={LOCKED_CAMERA_DISTANCE}
				maxDistance={LOCKED_CAMERA_DISTANCE}
				rotateSpeed={0.55}
				zoomSpeed={0.65}
				target={PLANET_CENTER_TARGET}
				minPolarAngle={FIXED_POLAR_ANGLE}
				maxPolarAngle={FIXED_POLAR_ANGLE}
				minAzimuthAngle={-AZIMUTH_LIMIT}
				maxAzimuthAngle={AZIMUTH_LIMIT}
			/>
		</>
	)
}

export function NewDemoPlanetScene({ points, selectedAssetId, onSelectAsset }) {
	const { loading, sceneRoot, error } = useEarthSceneFromJson()
	const [activePointId, setActivePointId] = useState(selectedAssetId || null)
	const [activePointScreenPosition, setActivePointScreenPosition] = useState(null)
	const lastScreenPositionRef = useRef(null)

	useEffect(() => {
		setActivePointId(selectedAssetId || null)
	}, [selectedAssetId])

	const handleTogglePoint = useCallback(
		(pointId) => {
			const nextPointId = activePointId === pointId ? null : pointId
			setActivePointId(nextPointId)
			onSelectAsset(nextPointId)
		},
		[activePointId, onSelectAsset],
	)
	const activePoint = useMemo(
		() => points.find((point) => point.id === activePointId) || null,
		[activePointId, points],
	)
	const tooltipAnchor = useMemo(() => {
		if (!activePointScreenPosition) return null
		return {
			x: activePointScreenPosition.width / 2,
			y: activePointScreenPosition.height * 0.7,
			width: activePointScreenPosition.width,
			height: activePointScreenPosition.height,
		}
	}, [activePointScreenPosition])

	const handleActivePointScreenPosition = useCallback((nextPosition) => {
		if (!nextPosition) {
			if (lastScreenPositionRef.current !== null) {
				lastScreenPositionRef.current = null
				setActivePointScreenPosition(null)
			}
			return
		}

		const prev = lastScreenPositionRef.current
		const hasMeaningfulDelta =
			!prev ||
			Math.abs(prev.x - nextPosition.x) > 0.75 ||
			Math.abs(prev.y - nextPosition.y) > 0.75 ||
			prev.width !== nextPosition.width ||
			prev.height !== nextPosition.height ||
			prev.visible !== nextPosition.visible
		if (!hasMeaningfulDelta) return

		lastScreenPositionRef.current = nextPosition
		setActivePointScreenPosition(nextPosition)
	}, [])

	if (error) {
		return (
			<div className={styles.fallback}>
				Не удалось загрузить сцену Земли: {String(error?.message || error)}
			</div>
		)
	}

	if (loading || !sceneRoot) {
		return <div className={styles.fallback} aria-busy="true" />
	}

	return (
		<div className={styles.canvasWrap}>
			<Canvas
				camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV, near: 0.1, far: 2000 }}
				gl={{ antialias: true, alpha: true }}
				dpr={[1, 1.5]}
				onCreated={({ gl }) => {
					// Align with Earth.json project settings + Editor defaults.
					gl.toneMapping = THREE.NeutralToneMapping
					gl.toneMappingExposure = 1
					gl.outputColorSpace = THREE.SRGBColorSpace
					gl.physicallyCorrectLights = true
					gl.setClearColor(0x000000, 0)
				}}
				style={{ background: "transparent" }}
				onPointerMissed={() => {
					setActivePointId(null)
					setActivePointScreenPosition(null)
					onSelectAsset(null)
				}}
			>
				<PlanetSceneContent
					sceneRoot={sceneRoot}
					points={points}
					activePointId={activePointId}
					onTogglePoint={handleTogglePoint}
					onActivePointScreenPosition={handleActivePointScreenPosition}
				/>
			</Canvas>
			{activePoint && activePointScreenPosition?.visible && tooltipAnchor ? (
				<div className={styles.overlayLayer}>
					<MapPointConnectorLine start={activePointScreenPosition} end={tooltipAnchor} />
					<div className={styles.tooltipCenterWrap}>
						<MapPointTooltip title={activePoint.name} />
					</div>
				</div>
			) : null}
		</div>
	)
}
