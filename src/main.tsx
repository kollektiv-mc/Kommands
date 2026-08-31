import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'
import { applyTheme } from './lib/theme'
import { initialTheme } from './components/SettingsDialog'
import { probeLocalBackend } from './storage'
import './styles/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('no #root element in index.html')

// Before the first render, so nothing paints in the shared source's green and then
// swaps. Property writes on <html>, not a React concern — see lib/theme.ts for why
// neither the accent nor the canvas can simply be the token source's values.
//
// One call, not two. The accent, the canvas and the [data-theme] attribute are one
// decision, and the light theme adjusts the accent as well as the ground; applying
// them separately here is how a half-applied theme reaches the first paint.
applyTheme(initialTheme())

// Also before the first render, and for the same class of reason: which storage
// backend this session has must be settled before anything reads it, or the
// dashboard would paint one build's affordances and swap to the other's. The probe
// answers in single-digit milliseconds against the local shell and is bounded by its
// own timeout against the hosted site, where it runs concurrently with everything
// this module already waited for. It never rejects — no backend is an answer, not an
// error. See src/storage/probe.ts.
void probeLocalBackend().then(() => {
  createRoot(container).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
})
