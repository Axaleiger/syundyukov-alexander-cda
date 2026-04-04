import AdminTab from '../../modules/admin/ui/AdminTab'
import { useAppStore } from '../../core/store/appStore'

export function AdminPage() {
    const {
        adminSubTab,
        setAdminSubTab,
    } = useAppStore()

    return <AdminTab activeSub={adminSubTab} />
}

export default AdminPage
