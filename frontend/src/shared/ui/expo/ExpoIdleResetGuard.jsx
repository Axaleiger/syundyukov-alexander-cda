import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "react-router-dom"
import styles from "./ExpoIdleResetGuard.module.css"
import { restartDemoSessionFromPreset } from "../../lib/restartDemoSessionFromPreset"

const EXPO_ENABLED = String(import.meta.env.VITE_EXPO || "").trim() === "1"
const IDLE_LIMIT_MS = Number.isFinite(Number(import.meta.env.VITE_EXPO_IDLE_MS))
	? Number(import.meta.env.VITE_EXPO_IDLE_MS)
	: 90_000
const START_DELAY_AFTER_FIRST_ACTION_MS = Number.isFinite(
	Number(import.meta.env.VITE_EXPO_ARM_DELAY_MS),
)
	? Number(import.meta.env.VITE_EXPO_ARM_DELAY_MS)
	: 30_000

export function ExpoIdleResetGuard({ routePrefix = "" }) {
	const location = useLocation()
	const [started, setStarted] = useState(false)
	const [lastActivityAt, setLastActivityAt] = useState(Date.now())
	const [nowTs, setNowTs] = useState(Date.now())
	const [showDialog, setShowDialog] = useState(false)
	const firstActionSeenRef = useRef(false)
	const startTimerRef = useRef(null)
	const tickingRef = useRef(null)
	const resetInProgressRef = useRef(false)

	const variant = useMemo(
		() =>
			(location.pathname || "").includes("/new-demo/")
				? "newDemo"
				: "main",
		[location.pathname],
	)

	useEffect(() => {
		if (!EXPO_ENABLED) return
		const onActivity = () => {
			// Пока открыт диалог idle, решение принимает только пользователь кнопками.
			if (showDialog) return
			if (!firstActionSeenRef.current) {
				firstActionSeenRef.current = true
				if (startTimerRef.current) clearTimeout(startTimerRef.current)
				startTimerRef.current = setTimeout(() => {
					setStarted(true)
					setLastActivityAt(Date.now())
				}, START_DELAY_AFTER_FIRST_ACTION_MS)
				return
			}
			if (!started) return
			setLastActivityAt(Date.now())
			setShowDialog(false)
		}

		const events = [
			"pointerdown",
			"keydown",
			"touchstart",
			"wheel",
			"mousemove",
		]
		events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
		return () => {
			events.forEach((e) => window.removeEventListener(e, onActivity))
		}
	}, [started, showDialog])

	useEffect(() => {
		if (!EXPO_ENABLED || !started) return
		if (tickingRef.current) clearInterval(tickingRef.current)
		tickingRef.current = setInterval(() => {
			setNowTs(Date.now())
		}, 250)
		return () => {
			if (tickingRef.current) clearInterval(tickingRef.current)
			tickingRef.current = null
		}
	}, [started])

	useEffect(() => {
		if (!EXPO_ENABLED || !started) return
		if (nowTs - lastActivityAt >= IDLE_LIMIT_MS) setShowDialog(true)
	}, [nowTs, lastActivityAt, started])

	useEffect(() => {
		return () => {
			if (startTimerRef.current) clearTimeout(startTimerRef.current)
			if (tickingRef.current) clearInterval(tickingRef.current)
		}
	}, [])

	const progress = started
		? Math.max(0, Math.min(1, (nowTs - lastActivityAt) / IDLE_LIMIT_MS))
		: 0

	const continueWork = () => {
		setLastActivityAt(Date.now())
		setShowDialog(false)
	}

	const restartFromPreset = async () => {
		if (resetInProgressRef.current) return
		resetInProgressRef.current = true
		await restartDemoSessionFromPreset(routePrefix)
	}

	if (!EXPO_ENABLED) return null

	return (
		<>
			<div className={styles.idleStrip} aria-hidden>
				<div
					className={styles.idleStripProgress}
					style={{ width: `${Math.round(progress * 100)}%` }}
				/>
			</div>

			{showDialog && (
				<div className={styles.overlay}>
					<div
						className={`${styles.modal} ${
							variant === "newDemo" ? styles.modalNewDemo : styles.modalMain
						}`}
						role="dialog"
						aria-modal="true"
						aria-labelledby="expo-idle-title"
					>
						<h3 id="expo-idle-title" className={styles.title}>
							Нет активности
						</h3>
						<p className={styles.text}>
							Система может вернуться в исходное состояние для нового показа.
						</p>
						<div className={styles.actions}>
							<button type="button" className={styles.btnGhost} onClick={continueWork}>
								Продолжить работу
							</button>
							<button
								type="button"
								className={styles.btnPrimary}
								onClick={() => {
									void restartFromPreset().catch((e) => {
										console.warn("[expo] restartFromPreset", e)
									})
								}}
							>
								Начать с начала
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	)
}

