// Server-side render entry. Express calls render(url, ssrState) per request; it
// renders the same <App/> the browser runs, wrapped in a StaticRouter for the
// requested URL. Auth comes in via ssrState (from the verified ghl_session
// cookie) so the markup matches what the client will hydrate. Kept synchronous
// so setting/clearing the per-request SSR state around renderToString is safe.

import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import App from './App.jsx'
import { setSsrState, clearSsrState } from './lib/ssr-state.js'

export function render(url, ssr) {
  setSsrState(ssr || null)
  try {
    const html = renderToString(
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    )
    return { html }
  } finally {
    clearSsrState()
  }
}
