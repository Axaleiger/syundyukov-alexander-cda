import ResultsTab from '../../modules/results/ui/ResultsTab'
import { useAppStore } from '../../core/store/appStore'

export const ResultPage = () => {
    const { resultsDashboardFocus } = useAppStore()

    return (
        <ResultsTab
            dashboardFocus={resultsDashboardFocus?.metric ?? null}
            dashboardFocusExplanation={resultsDashboardFocus?.explanation ?? null}
        />
    )
}

export default ResultPage
