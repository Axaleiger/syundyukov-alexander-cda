import AdminTab from '../../modules/admin/ui/AdminTab'
import { useAdminStore } from '../../modules/admin/model/adminStore'

export function AdminPage() {
    const { adminSubTab } = useAdminStore()

    return <AdminTab activeSub={adminSubTab} />
}

export default AdminPage
