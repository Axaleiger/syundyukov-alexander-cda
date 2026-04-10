import React from "react"
import { RouterProvider } from "react-router-dom"
import { router } from "../router/router";

export default function Routes() {
    return <RouterProvider router={router} />
}