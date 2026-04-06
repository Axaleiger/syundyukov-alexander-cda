import React from "react"
import { useWindRoseModel } from "../model/useWindRoseModel"
import { WindRoseDiagram } from "./WindRoseDiagram"
import styles from "./DemoStandWindRose.module.css"

/** Палитра SVG под тёмный стеклянный HUD демо-стенда */
const DEMO_STAND_SVG_PALETTE = {
	gridStroke: "rgba(255, 255, 255, 0.14)",
	axisStroke: "rgba(255, 255, 255, 0.2)",
	baseLineStroke: "rgba(248, 113, 113, 0.88)",
	contourStroke: "rgba(186, 230, 253, 0.42)",
	centerFill: "rgba(15, 23, 42, 0.92)",
	centerStroke: "rgba(186, 230, 253, 0.75)",
}

/**
 * Роза ветров для `/demo/face`: композиция и стили под HUD-панель.
 */
export default function DemoStandWindRose({
	data,
	centerTitle: _centerTitle,
	selectedIndex,
	onSegmentClick,
	type = "left",
	showDiagram = true,
	showLegend = true,
}) {
	const model = useWindRoseModel({ data, type, standVisual: true })
	const rootClass =
		!showDiagram && showLegend ? `${styles.root} ${styles.rootLegendOnly}` : styles.root
	return (
		<div className={rootClass}>
			<WindRoseDiagram
				styles={styles}
				model={model}
				selectedIndex={selectedIndex}
				onSegmentClick={onSegmentClick}
				svgPalette={DEMO_STAND_SVG_PALETTE}
				showDiagram={showDiagram}
				showLegend={showLegend}
				standVisual
			/>
		</div>
	)
}
