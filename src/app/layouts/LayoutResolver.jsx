import { useSearchParams,Outlet } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import DemoLayout from './DemoLayout'

export default function LayoutResolver() {
    const [ searchParams ] = useSearchParams()

    const stand = searchParams.get('stand')
    const isDemo = stand === 'demo'

    if (isDemo) {
        return (
            <DemoLayout />
        )
    }

    return (
        <AppLayout />
    )
}