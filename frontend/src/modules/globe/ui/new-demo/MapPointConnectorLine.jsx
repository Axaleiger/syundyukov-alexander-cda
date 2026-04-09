export function MapPointConnectorLine({ start, end }) {
	return (
		<svg
			width="100%"
			height="100%"
			viewBox={`0 0 ${end.width} ${end.height}`}
			style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
		>
			<line
				x1={start.x}
				y1={start.y}
				x2={end.x}
				y2={end.y}
				stroke="#1D4F70"
				strokeWidth="1.6"
				strokeOpacity="0.9"
			/>
		</svg>
	)
}
