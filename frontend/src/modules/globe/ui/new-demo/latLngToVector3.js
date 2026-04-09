import * as THREE from "three"

export function latLngToVector3(lat, lng, radius, altitude = 0) {
	const phi = THREE.MathUtils.degToRad(90 - lat)
	const theta = THREE.MathUtils.degToRad(lng + 180)
	const distance = radius + altitude

	const x = -(distance * Math.sin(phi) * Math.cos(theta))
	const y = distance * Math.cos(phi)
	const z = distance * Math.sin(phi) * Math.sin(theta)

	return new THREE.Vector3(x, y, z)
}
