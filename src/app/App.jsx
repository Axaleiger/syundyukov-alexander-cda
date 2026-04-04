import React,{ lazy } from 'react'
import Routes from './providers/RouterProvider'
const AppMain = lazy(() => import('..//main-stand/App'))
const AppDemo = lazy(() => import('../demo-stand/App'))



export default function App() {
  return <Routes />
}