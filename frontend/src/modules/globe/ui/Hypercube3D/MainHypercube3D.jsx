import React from "react"
import { useHypercube3DModel } from "../../model/useHypercube3DModel"
import { Hypercube3DWorkspace } from "./Hypercube3DWorkspace"
import styles from "./Hypercube3D.module.css"

const INSTRUCTIONS = (
	<div className={styles.instructions}>
		<p>
			Наведите на названия рычагов (NPV, Запасы, Добыча) в блоке выше для полного описания. Точки куба — варианты
			сценариев; точки на плоскостях воронки — по статусу ЦД (см. легенду). Нажмите на точку куба — откроется воронка
			сквозных сценариев.
		</p>
	</div>
)

/**
 * Гиперкуб для основного `/face`.
 */
export default function MainHypercube3D({ onOpenBpm, highlightCaseTree }) {
	const model = useHypercube3DModel({ onOpenBpm, highlightCaseTree })
	return <Hypercube3DWorkspace styles={styles} model={model} footer={INSTRUCTIONS} />
}
