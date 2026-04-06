import { Outlet } from "react-router-dom"
import styles from "./NewDemoLayout.module.css"
import { NewDemoHeader } from "./new-demo/NewDemoHeader"
import { NewDemoSidebar } from "./new-demo/NewDemoSidebar"

export default function NewDemoLayout() {
	return (
		<div className={styles.shell} data-new-demo-shell="true">
			<NewDemoHeader />
			<div className={styles.body}>
				<NewDemoSidebar />
				<main className={styles.main}>
					<div className={styles.mainInner}>
						<Outlet />
					</div>
				</main>
			</div>
		</div>
	)
}
