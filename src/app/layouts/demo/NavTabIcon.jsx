import React from "react"

const svgProps = {
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	xmlns: "http://www.w3.org/2000/svg",
	"aria-hidden": true,
}

/** Иконки левого рельса демо-стенда (как в demo-stand). */
export function NavTabIcon({ name }) {
	const stroke = "currentColor"
	const sw = 1.75
	switch (name) {
		case "home":
			return (
				<svg {...svgProps}>
					<path
						d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1V10.5z"
						stroke={stroke}
						strokeWidth={sw}
						strokeLinejoin="round"
						fill="none"
					/>
				</svg>
			)
		case "list":
			return (
				<svg {...svgProps}>
					<path
						d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"
						stroke={stroke}
						strokeWidth={sw}
						strokeLinecap="round"
					/>
				</svg>
			)
		case "calendar":
			return (
				<svg {...svgProps}>
					<rect x="3" y="5" width="18" height="16" rx="2" stroke={stroke} strokeWidth={sw} />
					<path
						d="M3 10h18M8 3v4M16 3v4"
						stroke={stroke}
						strokeWidth={sw}
						strokeLinecap="round"
					/>
					<path
						d="M8 14h2M12 14h2M16 14h2M8 17h2"
						stroke={stroke}
						strokeWidth={sw}
						strokeLinecap="round"
					/>
				</svg>
			)
		case "gear":
			return (
				<svg {...svgProps}>
					<circle cx="12" cy="12" r="3" stroke={stroke} strokeWidth={sw} />
					<path
						d="M12 1.5v2.4M12 20.1v2.4M2.4 12H5M19 12h2.6M4.4 4.4l1.8 1.8M17.8 17.8l1.8 1.8M4.4 19.6l1.8-1.8M17.8 6.2l1.8-1.8"
						stroke={stroke}
						strokeWidth={sw}
						strokeLinecap="round"
					/>
				</svg>
			)
		case "chart":
			return (
				<svg {...svgProps}>
					<path
						d="M4 19h16M4 19V5M4 19l4-6 4 3 4-8 4 5"
						stroke={stroke}
						strokeWidth={sw}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			)
		case "admin":
			return (
				<svg {...svgProps}>
					<path
						d="M12 3l7 4v6c0 5-3 8-7 9-4-1-7-4-7-9V7l7-4z"
						stroke={stroke}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
					<path
						d="M9 12l2 2 4-4"
						stroke={stroke}
						strokeWidth={sw}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			)
		default:
			return (
				<svg {...svgProps}>
					<circle cx="12" cy="12" r="9" stroke={stroke} strokeWidth={sw} />
				</svg>
			)
	}
}
