// Server-side render entry (streaming). Express calls renderStream(url, ssr,
// handlers) per request; it renders the same <App/> the browser runs, wrapped in
// a StaticRouter for the URL, and streams the HTML — which lets React resolve the
// lazy (code-split) page components on the server, so full page bodies render,
// not just the shell.
//
// Per-request auth state is scoped with AsyncLocalStorage so it stays correct
// across the async ticks streaming introduces, even under concurrent requests —
// no cross-request leakage.

import { AsyncLocalStorage } from 'node:async_hooks'
import { renderToPipeableStream } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import App from './App.jsx'
import { setStateResolver } from './lib/ssr-state.js'

const als = new AsyncLocalStorage()
// ssrState() (used by the auth/api libs during render) reads the current
// request's store instead of any shared global.
setStateResolver(() => als.getStore() || null)

export function renderStream(url, ssr, handlers) {
  return als.run(ssr || null, () => {
    const app = (
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    )
    return renderToPipeableStream(app, handlers)
  })
}
