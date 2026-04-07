import { useEffect, useRef } from "react"

/** Совпадает с `ADMIN_SUB_TABS` в SecondarySidebar / main-stand */
const LEGACY_ADMIN_SUBTAB_IDS = new Set([
	"roles",
	"catalog",
	"integration",
	"changes",
	"add-service",
])

/**
 * Синхронизация legacy query/hash с store и navigate (?cd=, ?bpm=1, #service/..., #admin-*).
 */
export function useLegacyHashNavigation({
	location,
	navigate,
	setCdPageNode,
	setShowBpm,
	setBpmHighlight,
	setServicePageName,
	setAdminSubTab,
}) {
	const legacyHashNavigationDoneRef = useRef("")

	useEffect(() => {
		const params = new URLSearchParams(location.search)
		const cd = params.get("cd")
		if (cd) {
			try {
				setCdPageNode(decodeURIComponent(cd))
			} catch {
				setCdPageNode(cd)
			}
		}
		if (params.get("bpm") === "1") {
			setShowBpm(true)
			setBpmHighlight(params.get("highlight") || null)
			return
		}

		const rawHash = (location.hash || "").replace(/^#/, "")
		if (!rawHash) {
			legacyHashNavigationDoneRef.current = ""
			return
		}

		const hashKey = location.hash || ""
		if (legacyHashNavigationDoneRef.current === hashKey) return

		const serviceMatch = rawHash.match(/^\/?service\/(.+)$/)
		if (serviceMatch) {
			const name = serviceMatch[1]
			try {
				setServicePageName(decodeURIComponent(name))
			} catch {
				setServicePageName(name)
			}
			legacyHashNavigationDoneRef.current = hashKey
			navigate("/planning", { replace: true })
			return
		}

		if (rawHash.startsWith("admin-")) {
			const sub = rawHash.slice(6)
			const validSub = LEGACY_ADMIN_SUBTAB_IDS.has(sub) ? sub : "roles"
			setAdminSubTab(validSub)
			legacyHashNavigationDoneRef.current = hashKey
			navigate("/admin", { replace: true })
		}
	}, [
		location.search,
		location.hash,
		location.pathname,
		navigate,
		setCdPageNode,
		setShowBpm,
		setBpmHighlight,
		setServicePageName,
		setAdminSubTab,
	])
}
