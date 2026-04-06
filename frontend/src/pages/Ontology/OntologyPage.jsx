import React, { useMemo, useRef } from "react"
import { useAppStore } from "../../core/store/appStore"
import {
	computePlanningBridgeSignature,
	deriveInitialOntologyState,
} from "../../modules/ontology/lib/ontologyBootstrap"
import { useOntologyStore } from "../../modules/ontology/model/ontologyStore"
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

	const bridgeSig = useMemo(
		() =>
			computePlanningBridgeSignature(
				flowCode,
				configuratorInitialNodes,
				configuratorInitialEdges,
			),
		[flowCode, configuratorInitialNodes, configuratorInitialEdges],
	)

	const ontologySession = useOntologyStore.getState()
	if (bridgeSig !== ontologySession.lastConsumedPlanningSignature) {
		const init = deriveInitialOntologyState({
			initialSchemaNodes: configuratorInitialNodes,
			initialSchemaEdges: configuratorInitialEdges,
			flowCode,
			schemaFromPlanningRef,
		})
		ontologySession.applyPlanningHandoff({
			signature: bridgeSig,
			schemaNodes: init.schemaNodes,
			schemaEdges: init.schemaEdges,
			codeValue: init.codeValue,
			mode: init.mode,
		})
	}

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
