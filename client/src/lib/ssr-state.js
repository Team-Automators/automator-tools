// Bridges auth state from the server render into the first client render so the
// SSR HTML and the client's hydration agree (a mismatch would blow away the
// server markup and defeat SSR).
//
// Client: the server injects window.__SSR_STATE__ into the page; the first paint
// reads it, then entry-client clears it so localStorage takes over after mount.
//
// Server: streaming SSR resolves lazy routes across async ticks, so a single
// module global would let one request's auth state leak into another's render.
// The server therefore installs a request-scoped resolver (backed by
// AsyncLocalStorage) via setStateResolver — ssrState() calls that instead. This
// file imports no Node APIs, so it stays safe to bundle for the browser.

let resolver = null

// The server calls this once with a function that returns the current request's
// SSR state (or null). When set, it takes precedence over the browser global.
export function setStateResolver(fn) { resolver = fn }

export function ssrState() {
  if (resolver) { try { return resolver() || null } catch { return null } }
  try { return (typeof globalThis !== 'undefined' && globalThis.__SSR_STATE__) || null } catch { return null }
}

// Client-only: drop the injected state after hydration.
export function clearSsrState() {
  try { globalThis.__SSR_STATE__ = null } catch {}
}
