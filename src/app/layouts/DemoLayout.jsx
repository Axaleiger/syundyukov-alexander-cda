import { Outlet } from "react-router-dom";

export default function AppLayout() {
    return <div className="app">
        <div>demo header</div>

        <div className="content">
            <div>demo menu</div>
            <Outlet />
        </div>
    </div>
}