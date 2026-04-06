export function getBoardIdForAsset(assetId) {
	if (assetId === "do-megion") return "mgn"
	if (assetId === "do-noyabrsk" || assetId === "novy-port") return "nng"
	return "hantos"
}
