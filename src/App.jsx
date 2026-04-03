import React, { lazy } from 'react'
const AppMain = lazy(() => import('./main-stand/App'))
const AppDemo = lazy(() => import('./demo-stand/App'))

function isDemoStand() {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('demo') === 'stand'
}

export default function App() {
  const isDemo = isDemoStand()

  if (isDemo) {
    return <AppDemo />
  }

  return <AppMain />
}