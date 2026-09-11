// Client entry. When the server sent SSR markup we HYDRATE it (attach React to
// the existing DOM); if the page came through the CSR fallback (empty #root) we
// mount from scratch. Either way, once React is running we drop the injected
// SSR state so localStorage becomes the source of truth for the rest of the
// session.

import React from 'react'
import { hydrateRoot, createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { installAuthFetch } from './lib/session.js'
import { clearSsrState } from './lib/ssr-state.js'
import 'react-toastify/dist/ReactToastify.css'
import './index.css'

// Attach the session token to every same-origin request (must run before any fetch).
installAuthFetch()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // A controllerchange after we already had a controller means a NEW version
    // activated — reload once so the freshest bundle is shown.
    const hadController = !!navigator.serviceWorker.controller
    navigator.serviceWorker.register('/sw.js')
      .then(reg => { reg.update().catch(() => {}) })
      .catch(() => {})

    let reloaded = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded || !hadController) return
      reloaded = true
      window.location.reload()
    })
  })
}

const rootEl = document.getElementById('root')
const app = (
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)

if (rootEl.hasChildNodes()) {
  hydrateRoot(rootEl, app)
} else {
  createRoot(rootEl).render(app)
}

// First render used the server-injected auth; from here on, read localStorage.
clearSsrState()
