import { Canvas } from "@react-three/fiber"
import { HypercubeR3FScene } from "../../../../globe/ui/Hypercube3D/HypercubeScene"
import styles from "./NewDemoHypercubeCard.module.css"

export function NewDemoHypercubeCard({ isActive, isCompact, onToggle, model }) {
	return (
		<button
			type="button"
			className={`${styles.card} ${isActive ? styles.cardActive : ""} ${isCompact ? styles.cardCompact : ""}`}
			onClick={onToggle}
			aria-expanded={isActive}
			aria-label={isActive ? "Свернуть блок гиперкуба" : "Открыть блок гиперкуба"}
		>
			<div className={styles.cardHeader}>
				<p className={styles.cardTitle}>Окно возможностей</p>
			</div>
			<div className={styles.cardBody}>
				{isCompact ? null : (
					<div className={styles.previewViewport}>
						<Canvas gl={{ alpha: true, antialias: true }} camera={{ position: [4, 4, 4], fov: 35 }}>
							<HypercubeR3FScene
								{...model.sceneProps}
								visualPreset="newDemoMini"
								showHtmlOverlays={false}
							/>
						</Canvas>
					</div>
				)}
			</div>
			<span className={styles.cardTriangle} aria-hidden />
		</button>
	)
}
