import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'
import { applyProductAccent } from './lib/theme'
import './styles/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('no #root element in index.html')

// Before the first render, so nothing paints in the shared source's green and then
// swaps. This is a property write on <html>, not a React concern — see lib/theme.ts
// for why the accent cannot simply be the token source's value.
applyProductAccent()

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
