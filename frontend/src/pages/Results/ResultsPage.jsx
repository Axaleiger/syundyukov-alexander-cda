import ResultsTab from '../../modules/results/ui/ResultsTab'
import { useResultsStore } from '../../modules/results/model/resultsStore'

export const ResultPage = () => {
    const { resultsDashboardFocus } = useResultsStore()

    return (
        <ResultsTab
            dashboardFocus={resultsDashboardFocus?.metric ?? null}
            dashboardFocusExplanation={resultsDashboardFocus?.explanation ?? null}
        />
    )
}

export default ResultPage
