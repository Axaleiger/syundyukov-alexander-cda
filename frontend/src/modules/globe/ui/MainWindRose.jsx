import React from "react"
import { useWindRoseModel } from "../model/useWindRoseModel"
import { WindRoseDiagram, WIND_ROSE_SVG_PALETTE_MAIN } from "./WindRoseDiagram"
import styles from "./WindRose.module.css"

/**
 * Роза ветров для основного `/face`: светлая карточка, текущая продуктовая вёрстка.
 */
export default function MainWindRose({
	data,
	centerTitle: _centerTitle,
	selectedIndex,
	onSegmentClick,
	type = "left",
}) {
	const model = useWindRoseModel({ data, type })
	return (
		<div className={styles.root}>
			<WindRoseDiagram
				styles={styles}
				model={model}
				selectedIndex={selectedIndex}
				onSegmentClick={onSegmentClick}
				svgPalette={WIND_ROSE_SVG_PALETTE_MAIN}
			/>
		</div>
	)
}
