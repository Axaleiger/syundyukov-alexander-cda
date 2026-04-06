import { useCallback, useRef } from "react"
import { getSchemaFromFlowCode } from "../../../modules/ontology/lib/ontologyBootstrap"

/**
 * Обработка завершения BPM-команды: подтверждение, схема в конфигуратор, переход в онтологию.
 */
export function useBpmCommandBridge({
	flowCode,
	setFlowCode,
	setBpmCommand,
	setConfiguratorInitialNodes,
	setConfiguratorInitialEdges,
	setOpenConfiguratorFromPlanning,
	setShowBpm,
	navigate,
	requestUserConfirm,
}) {
	const bpmCommandConsumedRef = useRef(null)

	const onBpmCommandConsumed = useCallback(
		async (opts) => {
			setBpmCommand(null)

			const codeForSchema = opts?.flowCode ?? flowCode

			if (opts?.flowCode) {
				setFlowCode(opts.flowCode)
			}

			if (opts?.switchToOntology === false) {
				bpmCommandConsumedRef.current?.()
				return
			}

			await requestUserConfirm(
				"Проверьте сквозной бизнес-сценарий на доске планирования и нажмите «Согласовать», чтобы построить схему в Конфигураторе систем.",
				{ phase: "brain" },
			)

			const schema = getSchemaFromFlowCode(codeForSchema)

			if (schema?.nodes?.length) {
				setConfiguratorInitialNodes(schema.nodes)
				setConfiguratorInitialEdges(schema.edges || [])
			} else {
				setConfiguratorInitialNodes(null)
				setConfiguratorInitialEdges(null)
			}

			setOpenConfiguratorFromPlanning(true)

			setShowBpm(false)
			navigate("/ontology")
			bpmCommandConsumedRef.current?.()
		},
		[
			flowCode,
			setBpmCommand,
			setFlowCode,
			setConfiguratorInitialNodes,
			setConfiguratorInitialEdges,
			setOpenConfiguratorFromPlanning,
			setShowBpm,
			requestUserConfirm,
			navigate,
		],
	)

	return { onBpmCommandConsumed, bpmCommandConsumedRef }
}
