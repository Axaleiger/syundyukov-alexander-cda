import { createBrowserRouter,Navigate } from "react-router-dom";
import FacePage from "../../pages/Face/FacePage";
import PlanningPage from "../../pages/PlanningPage";
import ScenariosPage from "../../pages/ScenariosPage";
import OntologyPage from "../../pages/OntologyPage";
import NotFoundPage from "../../pages/NotFoundPage";
import LayoutResolver from "../layouts/LayoutResolver";

const basename = '/';

export const router = createBrowserRouter([
    {
        path: '/',
        element: <LayoutResolver />,
        children: [
            { index: true,element: <Navigate to='/face' /> },
            { path: 'face',element: <FacePage /> },
            { path: 'planning',element: <PlanningPage /> },
            { path: 'scenarios',element: <ScenariosPage /> },
            { path: 'ontology',element: <OntologyPage /> },
            { path: '*',element: <NotFoundPage /> }
        ]
    }
],{
    basename
}) 