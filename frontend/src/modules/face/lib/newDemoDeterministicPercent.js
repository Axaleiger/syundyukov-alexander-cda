/** Детерминированный «рандом» в [min, max] для new-demo (зависит от seed и индекса). */
export function newDemoPercentInRange(seed, salt, index, min, max) {
	const span = max - min + 1
	const h = Math.abs((seed * (index + 1) * 7 + salt * 13 + (index + 1) * 11) % span)
	return min + h
}
