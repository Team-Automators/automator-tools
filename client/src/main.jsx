import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { installAuthFetch } from './lib/session.js'
import 'react-toastify/dist/ReactToastify.css'
import './index.css'

// Attach the session token to every same-origin request (must run before any fetch).
installAuthFetch()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Was a service worker already controlling this page? If so, a controller
    // change means a NEW version activated — reload once so the freshest bundle
    // is shown (prevents users being stuck on a cached old build).
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
