import { createBrowserRouter,Navigate } from "react-router-dom";
import LayoutResolver from "../layouts/LayoutResolver";
import FacePage from "../../pages/Face/FacePage";
import PlanningPage from "../../pages/Planning/PlanningPage";
import ScenariosPage from "../../pages/Scenarios/ScenariosPage";
import OntologyPage from "../../pages/Ontology/OntologyPage";
import NotFoundPage from "../../pages/NotFound/NotFoundPage";
import ResultPage from "../../pages/Results/ResultsPage";
import AdminPage from "../../pages/Admin/AdminPage";

const basename = '/';

export const router = createBrowserRouter([
    {
        path: '/',
        element: <LayoutResolver />,
        children: [
            { index: true,element: <Navigate to='/face' /> },
            { path: 'face',element: <FacePage /> },
            { path: 'scenarios',element: <ScenariosPage /> },
            { path: 'planning',element: <PlanningPage /> },
            { path: 'ontology',element: <OntologyPage /> },
            { path: 'results',element: <ResultPage /> },
            { path: 'admin',element: <AdminPage /> },
            { path: '*',element: <NotFoundPage /> }
        ]
    }
],{
    basename
}) 