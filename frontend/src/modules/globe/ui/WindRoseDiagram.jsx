import React, { useId, useMemo } from "react"

/** Палитра обводок/заливок SVG по умолчанию (main /face). */
export const WIND_ROSE_SVG_PALETTE_MAIN = {
	gridStroke: "rgba(45, 90, 135, 0.12)",
	axisStroke: "rgba(45, 90, 135, 0.15)",
	baseLineStroke: "#b85a4a",
	contourStroke: "rgba(45, 90, 135, 0.38)",
	centerFill: "#fff",
	centerStroke: "#2d5a87",
}

function polygonVertices(cx, cy, n, r, angleStep) {
	const verts = []
	for (let i = 0; i < n; i++) {
		const midAngle = i * angleStep + angleStep / 2 - Math.PI / 2
		verts.push([cx + Math.cos(midAngle) * r, cy + Math.sin(midAngle) * r])
	}
	return verts
}

function polygonPath(vertices) {
	if (vertices.length === 0) return ""
	const [x0, y0] = vertices[0]
	return `M ${x0},${y0}${vertices
		.slice(1)
		.map(([x, y]) => ` L ${x},${y}`)
		.join("")} Z`
}

/**
 * Общая отрисовка SVG + подписи + легенда. Стили контейнера — через css module презентера.
 * standVisual — визуал как demo-stand WindRose (полигональная сетка, клинья, контур #E65907).
 */
export function WindRoseDiagram({
	styles,
	model,
	selectedIndex,
	onSegmentClick,
	svgPalette = WIND_ROSE_SVG_PALETTE_MAIN,
	showDiagram = true,
	showLegend = true,
	standVisual = false,
}) {
	const gradUid = useId().replace(/:/g, "")
	const { layout, segments, contourPath, angleStep, data, isLeft, petalColorFromCoverage } = model
	const {
		RADIUS,
		CENTER_X,
		CENTER_Y,
		SVG_VIEW_SIZE,
		WRAPPER_SIZE,
		LABEL_RADIUS,
		LABEL_W,
		LABEL_H,
	} = layout

	const SVG_VIEW_MIN = CENTER_X - RADIUS
	const labelCenter = WRAPPER_SIZE / 2

	const numItems = data.length

	const standWedgePaths = useMemo(() => {
		if (!standVisual || segments.length === 0) return []
		return segments.map((_, i) => {
			const a = segments[i]
			const b = segments[(i + 1) % segments.length]
			return `M ${CENTER_X} ${CENTER_Y} L ${a.xEnd} ${a.yEnd} L ${b.xEnd} ${b.yEnd} Z`
		})
	}, [standVisual, segments, CENTER_X, CENTER_Y])

	const standGridScales = [0.2, 0.4, 0.6, 0.8, 1]

	const roseSvgClass = [styles.roseSvg, standVisual && styles.roseSvgStand].filter(Boolean).join(" ")

	const renderMainSvg = () => {
		if (standVisual) {
			return (
				<svg
					width={SVG_VIEW_SIZE}
					height={SVG_VIEW_SIZE}
					viewBox={`${SVG_VIEW_MIN} ${SVG_VIEW_MIN} ${SVG_VIEW_SIZE} ${SVG_VIEW_SIZE}`}
					className={roseSvgClass}
				>
					<defs>
						{segments.map((_, i) => (
							<radialGradient
								key={`g-${i}`}
								id={`stand-wedge-grad-${gradUid}-${i}`}
								cx="50%"
								cy="50%"
								r="70%"
								fx="50%"
								fy="50%"
							>
								<stop
									offset="0%"
									stopColor={i % 2 === 0 ? "rgba(0, 48, 96, 0.55)" : "rgba(0, 32, 70, 0.5)"}
								/>
								<stop
									offset="100%"
									stopColor={i % 2 === 0 ? "rgba(47, 180, 233, 0.42)" : "rgba(0, 112, 186, 0.28)"}
								/>
							</radialGradient>
						))}
					</defs>

					{numItems > 0 &&
						standGridScales.map((scale) => {
							const verts = polygonVertices(CENTER_X, CENTER_Y, numItems, RADIUS * scale, angleStep)
							return (
								<path
									key={scale}
									d={polygonPath(verts)}
									fill="none"
									stroke="rgba(47, 180, 233, 0.35)"
									strokeWidth="0.65"
								/>
							)
						})}

					{data.map((_, i) => {
						const midAngle = i * angleStep + angleStep / 2 - Math.PI / 2
						const x = CENTER_X + Math.cos(midAngle) * RADIUS
						const y = CENTER_Y + Math.sin(midAngle) * RADIUS
						return (
							<line
								key={i}
								x1={CENTER_X}
								y1={CENTER_Y}
								x2={x}
								y2={y}
								stroke="rgba(47, 180, 233, 0.28)"
								strokeWidth={0.55}
							/>
						)
					})}

					{standWedgePaths.map((d, i) => {
						const isSelected = selectedIndex === i
						const dim = selectedIndex != null && !isSelected
						return (
							<path
								key={`wedge-${i}`}
								d={d}
								fill={`url(#stand-wedge-grad-${gradUid}-${i})`}
								fillOpacity={dim ? 0.22 : 1}
								stroke="none"
							/>
						)
					})}

					{isLeft &&
						segments.map((s, i) =>
							selectedIndex == null || selectedIndex === i ? (
								<line
									key={`base-${i}`}
									x1={CENTER_X}
									y1={CENTER_Y}
									x2={s.xBase}
									y2={s.yBase}
									stroke="#E65907"
									strokeWidth={2}
									strokeOpacity={0.85}
								/>
							) : null,
						)}

					{contourPath ? (
						<>
							<path
								d={contourPath}
								fill="none"
								stroke="#E65907"
								strokeWidth={2.6}
								strokeLinejoin="round"
								className={styles.contourStand}
							/>
							{segments.map((s, index) => {
								const isSelected = selectedIndex === index
								const dim = selectedIndex != null && !isSelected
								return (
									<circle
										key={`vx-${index}`}
										cx={s.xEnd}
										cy={s.yEnd}
										r={dim ? 3.2 : 4.2}
										fill="#E65907"
										stroke="rgba(5, 22, 38, 0.4)"
										strokeWidth="0.35"
									/>
								)
							})}
						</>
					) : null}

					<circle
						cx={CENTER_X}
						cy={CENTER_Y}
						r={8}
						fill="rgba(5, 22, 38, 0.92)"
						stroke="rgba(47, 180, 233, 0.5)"
						strokeWidth={1.1}
						opacity={0.98}
					/>
				</svg>
			)
		}

		return (
			<svg
				width={SVG_VIEW_SIZE}
				height={SVG_VIEW_SIZE}
				viewBox={`${SVG_VIEW_MIN} ${SVG_VIEW_MIN} ${SVG_VIEW_SIZE} ${SVG_VIEW_SIZE}`}
				className={roseSvgClass}
			>
				{[0.25, 0.5, 0.75, 1].map((scale) => (
					<circle
						key={scale}
						cx={CENTER_X}
						cy={CENTER_Y}
						r={RADIUS * scale}
						fill="none"
						stroke={svgPalette.gridStroke}
						strokeWidth="0.8"
					/>
				))}
				{data.map((_, i) => {
					const a = i * angleStep - Math.PI / 2
					const x = CENTER_X + Math.cos(a) * RADIUS
					const y = CENTER_Y + Math.sin(a) * RADIUS
					return (
						<line
							key={i}
							x1={CENTER_X}
							y1={CENTER_Y}
							x2={x}
							y2={y}
							stroke={svgPalette.axisStroke}
							strokeWidth="0.5"
						/>
					)
				})}
				{isLeft &&
					segments.map((s, i) =>
						selectedIndex == null || selectedIndex === i ? (
							<line
								key={`base-${i}`}
								x1={CENTER_X}
								y1={CENTER_Y}
								x2={s.xBase}
								y2={s.yBase}
								stroke={svgPalette.baseLineStroke}
								strokeWidth={1.8}
								strokeOpacity={0.7}
							/>
						) : null,
					)}
				{segments.map((seg, index) => {
					const isSelected = selectedIndex === index
					const opacity = selectedIndex == null ? 1 : isSelected ? 1 : 0.28
					return (
						<line
							key={index}
							x1={CENTER_X}
							y1={CENTER_Y}
							x2={seg.xEnd}
							y2={seg.yEnd}
							stroke={seg.petalColor}
							strokeWidth={isSelected ? 3.2 : 2.2}
							strokeOpacity={opacity}
							strokeLinecap="round"
							className={styles.petal}
							style={{ pointerEvents: "none" }}
						/>
					)
				})}
				<path
					d={contourPath}
					fill="none"
					stroke={svgPalette.contourStroke}
					strokeWidth={1.4}
					strokeLinejoin="round"
					className={styles.contour}
				/>
				<circle
					cx={CENTER_X}
					cy={CENTER_Y}
					r="10"
					fill={svgPalette.centerFill}
					stroke={svgPalette.centerStroke}
					strokeWidth="1.4"
					opacity={0.98}
				/>
			</svg>
		)
	}

	const outsideLabelClass = (isSelected) =>
		[
			styles.outsideLabel,
			isSelected ? styles.outsideLabelSelected : "",
			standVisual ? styles.outsideLabelStand : "",
		]
			.filter(Boolean)
			.join(" ")

	const legendRowClass = (isSelected) =>
		[
			styles.legendRow,
			isSelected ? styles.legendRowSelected : "",
			standVisual ? styles.legendRowStand : "",
		]
			.filter(Boolean)
			.join(" ")

	return (
		<>
			{showDiagram ? (
				<div className={styles.diagram} style={{ width: WRAPPER_SIZE, height: WRAPPER_SIZE }}>
					{renderMainSvg()}
					<div className={styles.labelsOutside}>
						{segments.map((seg, index) => {
							const isSelected = selectedIndex === index
							const name = seg.name.length > 14 ? `${seg.name.slice(0, 12)}…` : seg.name
							const left = labelCenter + LABEL_RADIUS * Math.cos(seg.midAngle) - LABEL_W / 2
							const top = labelCenter + LABEL_RADIUS * Math.sin(seg.midAngle) - LABEL_H / 2
							return (
								<button
									key={index}
									type="button"
									className={outsideLabelClass(isSelected)}
									style={{
										left: `${left}px`,
										top: `${top}px`,
										width: LABEL_W,
										height: LABEL_H,
									}}
									onClick={() => onSegmentClick(index)}
									aria-label={seg.name}
								>
									<span
										className={[styles.outsideName, standVisual && styles.outsideNameStand]
											.filter(Boolean)
											.join(" ")}
									>
										{name}
									</span>
									<span
										className={[styles.outsideValue, standVisual && styles.outsideValueStand]
											.filter(Boolean)
											.join(" ")}
									>
										{seg.value}%
									</span>
								</button>
							)
						})}
					</div>
				</div>
			) : null}
			{showLegend ? (
				<div className={[styles.legend, standVisual && styles.legendStand].filter(Boolean).join(" ")}>
					<div className={styles.legendItems}>
						{data.map((item, index) => {
							const isSelected = selectedIndex === index
							return (
								<button
									key={index}
									type="button"
									className={legendRowClass(isSelected)}
									onClick={() => onSegmentClick(index)}
									aria-label={`${item.name}, ${item.value}%`}
								>
									<span
										className={[styles.legendSwatch, standVisual && styles.legendSwatchStand]
											.filter(Boolean)
											.join(" ")}
										style={
											standVisual
												? undefined
												: { background: petalColorFromCoverage(item.coverage) }
										}
									/>
									<span
										className={[styles.legendName, standVisual && styles.legendNameStand]
											.filter(Boolean)
											.join(" ")}
									>
										{item.name}
									</span>
									<span
										className={[styles.legendMetric, standVisual && styles.legendMetricStand]
											.filter(Boolean)
											.join(" ")}
									>
										{item.value}%
									</span>
								</button>
							)
						})}
					</div>
				</div>
			) : null}
		</>
	)
}
