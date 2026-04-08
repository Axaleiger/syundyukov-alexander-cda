import { useNavigate } from 'react-router-dom'

import ScenariosList from '../../modules/scenarios/ui/ScenariosList'
import { useAppStore } from '../../core/store/appStore'

export function ScenariosPage() {
    const navigate = useNavigate()
    const {
        scenariosStageFilter,
        scenarioStageFilters,
        setScenarioStageFilters,
        setScenariosStageFilter,
        setSelectedScenarioName,
        setSelectedScenarioId,
    } = useAppStore()

    return (
        <ScenariosList
            activeStageFilter={scenariosStageFilter}
            stageFilters={scenarioStageFilters}
            onStageFilterToggle={(name) =>
                setScenarioStageFilters((prev) => ({
                    ...prev,
                    [name]: !prev[name],
                }))
            }
            onScenarioClick={(row) => {
                if (!row?.name) return

                const displayName =
                    row.name.replace(/\s*\(раздел\s*"[^"]*"\)\s*$/i, '').trim() || row.name

                setSelectedScenarioName(displayName)
                setSelectedScenarioId(row.scenarioId ?? null)

                navigate('/planning')
            }}
        />
    )
}

export default ScenariosPage
