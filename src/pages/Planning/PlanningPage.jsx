import { useCallback,useMemo,useRef,useState } from "react"
import { DEFAULT_FLOW_CODE } from "../../main-stand/components/OntologyTab"

function getBoardIdForAsset(assetId) {
    if (assetId === 'do-megion') return 'mgn'
    if (assetId === 'do-noyabrsk' || assetId === 'novy-port') return 'nng'
    return 'hantos'
}

export const PlanningPage = () => {
    const [ selectedScenarioName,setSelectedScenarioName ] = useState('Управление добычей с учетом ближайшего бурения')
    const [ selectedAssetId,setSelectedAssetId ] = useState(null)
    const [ bpmCommand,setBpmCommand ] = useState(null)
    const [ bpmHighlight,setBpmHighlight ] = useState(null)
    const [ flowCode,setFlowCode ] = useState(DEFAULT_FLOW_CODE)
    const [ aiMode,setAiMode ] = useState(false)

    const [ scenarioComparisonRevision,setScenarioComparisonRevision ] = useState(0)

    const [ thinkingAwaitingConfirm,setThinkingAwaitingConfirm ] = useState(false)
    const [ thinkingConfirmPhase,setThinkingConfirmPhase ] = useState(null)
    const thinkingConfirmPhaseRef = useRef(null)

    thinkingConfirmPhaseRef.current = thinkingConfirmPhase
    const thinkingChainRevealedRef = useRef(false)

    const [ thinkingSteps,setThinkingSteps ] = useState([])
    const [ thinkingCurrentMessage,setThinkingCurrentMessage ] = useState('')
    const [ thinkingPaused,setThinkingPaused ] = useState(false)
    const [ thinkingPanelOpen,setThinkingPanelOpen ] = useState(false)

    const [ servicePageName,setServicePageName ] = useState(() => {
        if (typeof window === 'undefined') return null
        const h = window.location.hash.replace(/^#/,'')
        const m = h.match(/^\/?service\/(.+)$/)
        return m ? decodeURIComponent(m[ 1 ]) : null
    })

    const selectedAssetPoint = selectedAssetId ? mapPointsData.find((p) => p.id === selectedAssetId) : null
    const thinkingConfirmResolverRef = useRef(null)

    const requestUserConfirm = useCallback((label,options) => {
        setThinkingPanelOpen(true)
        thinkingChainRevealedRef.current = false
        setThinkingPaused(false)
        setThinkingAwaitingConfirm(true)
        const phase = options?.phase ?? 'planning'
        const refreshScenarioPanel = !!options?.refreshScenarioPanel
        setThinkingConfirmPhase(phase)
        setThinkingCurrentMessage(label)
        return new Promise((resolve) => {
            thinkingConfirmResolverRef.current = () => {
                setThinkingAwaitingConfirm(false)
                if (refreshScenarioPanel) {
                    setScenarioComparisonRevision((n) => n + 1)
                }
                if (thinkingConfirmPhaseRef.current !== 'brain') setThinkingConfirmPhase(null)
                thinkingConfirmResolverRef.current = null
                resolve()
            }
        })
    },[])

    const handleThinkingConfirm = useCallback(() => {
        if (selectedDecisionPathIdRef.current) {
            setAppliedDecisionPathId(selectedDecisionPathIdRef.current)
        }
        if (thinkingConfirmResolverRef.current) {
            thinkingConfirmResolverRef.current()
        }
        setThinkingPanelOpen(false)
        setThinkingCurrentMessage('')
        setThinkingPaused(false)
        setThinkingConfirmPhase(null)
    },[])

    const [ bpmStages,setBpmStages ] = useState(null)
    const [ bpmTasks,setBpmTasks ] = useState(null)
    const handleBoardChange = useCallback((stages,tasks) => {
        setFlowCode(bpmToMermaid(stages,tasks))
        setBpmStages(stages)
        setBpmTasks(tasks)
    },[])

    const onBpmCommandConsumed = useCallback((opts) => {
        setBpmCommand(null)
        if (opts?.flowCode) setFlowCode(opts.flowCode)
        if (opts?.switchToOntology !== false) {
            const codeForSchema = opts?.flowCode ?? flowCode
            requestUserConfirm('Проверьте сквозной бизнес-сценарий на доске планирования и нажмите «Согласовать», чтобы построить схему в Конфигураторе систем.',{ phase: 'brain' })
                .then(() => {
                    const schema = getSchemaFromFlowCode(codeForSchema)
                    configuratorSchemaRef.current = schema?.nodes?.length
                        ? { nodes: schema.nodes,edges: schema.edges || [] }
                        : { flowCode: codeForSchema }
                    if (schema?.nodes?.length) {
                        setConfiguratorInitialNodes(schema.nodes)
                        setConfiguratorInitialEdges(schema.edges || [])
                    }
                    setShowBpm(false)
                    setActiveTab('ontology')
                    setOpenConfiguratorFromPlanning(true)
                })
        }
        bpmCommandConsumedRef.current?.()
    },[ requestUserConfirm,flowCode ])

    const handleScenarios = () => {
        // TODO: Replace to navigate
        // setActiveTab('scenarios')
    }

    const renderServiceName = useMemo(() => (<div className="app-content app-content-service">
        <div className="service-page">
            <button type="button" className="service-page-back" onClick={() => { setServicePageName(null); window.location.hash = 'planning'; }}><span className="service-page-back-arrow" aria-hidden /> Назад</button>
            <h1 className="service-page-title">{servicePageName}</h1>
        </div>
    </div>),[ servicePageName ]);

    return servicePageName ? renderServiceName : (
        <div className="app-content app-content-bpm">
            <Suspense fallback={<div className="bpm-loading">Загрузка Планирования…</div>}>
                <BPMBoard
                    scenarioName={selectedScenarioName}
                    initialBoardId={
                        selectedScenarioName && selectedScenarioName.includes('Управление добычей с учетом ближайшего бурения')
                            ? 'do-burenie'
                            : selectedScenarioName && selectedScenarioName.includes('Проактивное управление ремонтами')
                                ? 'hantos'
                                : (selectedAssetId ? getBoardIdForAsset(selectedAssetId) : 'hantos')
                    }
                    initialStages={bpmCommand?.scenarioId === 'createPlanningCase' ? undefined : bpmStages}
                    initialTasks={bpmCommand?.scenarioId === 'createPlanningCase' ? undefined : bpmTasks}
                    selectedAssetName={selectedAssetPoint?.name}
                    highlightCardName={bpmHighlight}
                    onClose={handleScenarios}
                    onBoardChange={handleBoardChange}
                    aiMode={aiMode}
                    setAiMode={setAiMode}
                    onOpenPlanningWithScenario={(name) => { setSelectedScenarioName(name || 'Проактивное управление ремонтами и приоритетами'); setActiveTab('planning'); }}
                    bpmCommand={bpmCommand}
                    onBpmCommandConsumed={onBpmCommandConsumed}
                />
            </Suspense>
        </div>
    )
}

export default PlanningPage;