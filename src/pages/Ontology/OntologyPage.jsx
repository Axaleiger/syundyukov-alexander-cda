import React, { useRef } from "react"
import { useAppStore } from "../../core/store/appStore"
import ConfiguratorDocPage from "../../modules/ontology/ui/ConfiguratorDocPage"
import OntologyTab from "../../modules/ontology/ui/OntologyTab"
import layoutStyles from "../../app/layouts/AppLayout.module.css"

export function OntologyPage() {
	const schemaFromPlanningRef = useRef(null)
	const {
		flowCode,
		setFlowCode,
		showConfiguratorDoc,
		setShowConfiguratorDoc,
		openConfiguratorFromPlanning,
		setOpenConfiguratorFromPlanning,
		configuratorInitialNodes,
		configuratorInitialEdges,
		configuratorNodeCommand,
		setConfiguratorNodeCommand,
	} = useAppStore()

	if (showConfiguratorDoc) {
		return (
			<ConfiguratorDocPage onClose={() => setShowConfiguratorDoc(false)} />
		)
	}

	return (
		<div
			className={`${layoutStyles["app-content"]} ${layoutStyles["app-content-ontology"]}`}
		>
			<OntologyTab
				isVisible
				onOpenDoc={() => setShowConfiguratorDoc(true)}
				flowCode={flowCode}
				onFlowCodeChange={setFlowCode}
				openFromPlanning={openConfiguratorFromPlanning}
				onOpenFromPlanningConsumed={() =>
					setOpenConfiguratorFromPlanning(false)
				}
				configuratorNodeCommand={configuratorNodeCommand}
				onConfiguratorNodeConsumed={() => setConfiguratorNodeCommand(null)}
				initialSchemaNodes={configuratorInitialNodes}
				initialSchemaEdges={configuratorInitialEdges}
				schemaFromPlanningRef={schemaFromPlanningRef}
			/>
		</div>
	)
}

export default OntologyPage
