import { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import styles from "./NewDemoPlanetScene.module.css"
import EARTH_JSON_OBJECT from "../../../../shared/assets/Earth.json"

const EARTH_RADIUS = 10
const PLANET_CENTER_TARGET = [0, 8, 0]
const CAMERA_POSITION = [0, 0, 0]
const CAMERA_FOV = 41
const FIXED_POLAR_ANGLE = 1.05
const AZIMUTH_LIMIT = THREE.MathUtils.degToRad(35)
const PLANET_ROTATION_Y = Math.PI
const LOCKED_CAMERA_DISTANCE = 30

function latLonToCartesian(lat, lon, radius = EARTH_RADIUS) {
	const phi = THREE.MathUtils.degToRad(90 - lat)
	const theta = THREE.MathUtils.degToRad(lon + 180)
	const x = -(radius * Math.sin(phi) * Math.cos(theta))
	const y = radius * Math.cos(phi)
	const z = radius * Math.sin(phi) * Math.sin(theta)
	return [x, y, z]
}

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

function PlanetPoint({ point, isSelected, onSelect }) {
	const [isHovered, setIsHovered] = useState(false)
	const keyAssetIds = useMemo(() => new Set(["do-yamal", "do-noyabrsk", "do-megion"]), [])

	const position = useMemo(() => latLonToCartesian(point.lat, point.lon, EARTH_RADIUS * 1.01), [point])
	const color = isSelected ? "#22d3ee" : isHovered ? "#38bdf8" : keyAssetIds.has(point.id) ? "#ef4444" : "#0ea5e9"
	const radius = isSelected ? 0.26 : isHovered ? 0.23 : 0.2

	return (
		<mesh
			position={position}
			onClick={(event) => {
				event.stopPropagation()
				onSelect(point.id)
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
			<sphereGeometry args={[radius, 14, 14]} />
			<meshStandardMaterial
				color={color}
				emissive={isSelected ? "#0891b2" : "#000000"}
				emissiveIntensity={0.35}
				metalness={0.15}
				roughness={0.5}
			/>
		</mesh>
	)
}

function PlanetSceneContent({ sceneRoot, points, selectedAssetId, onSelectAsset }) {
	const groupRef = useRef(null)
	const runtimeScene = useThree((state) => state.scene)
	const gl = useThree((state) => state.gl)
	const envTargetRef = useRef(null)

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

	return (
		<>
			<group ref={groupRef} rotation={[0, PLANET_ROTATION_Y, 0]} scale={1.8}>
				<primitive object={sceneRoot} />
				{points.map((point) => (
					<PlanetPoint
						key={point.id}
						point={point}
						isSelected={selectedAssetId === point.id}
						onSelect={onSelectAsset}
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
			>
				<PlanetSceneContent
					sceneRoot={sceneRoot}
					points={points}
					selectedAssetId={selectedAssetId}
					onSelectAsset={onSelectAsset}
				/>
			</Canvas>
		</div>
	)
}
