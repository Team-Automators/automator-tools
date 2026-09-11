// Bridges auth state from the server render into the first client render so the
// SSR HTML and the client's hydration agree (a mismatch would blow away the
// server markup and defeat SSR). The server (entry-server) sets this per request
// from the verified ghl_session cookie; the client reads the same values —
// injected into the page as window.__SSR_STATE__ — for its FIRST paint only,
// then clears it so localStorage becomes the source of truth after mount.

export const isServer = typeof window === 'undefined'

export function ssrState() {
  try {
    const g = typeof globalThis !== 'undefined' ? globalThis : {}
    return g.__SSR_STATE__ || null
  } catch { return null }
}

export function setSsrState(s) {
  try { globalThis.__SSR_STATE__ = s || null } catch {}
}

export function clearSsrState() {
  try { globalThis.__SSR_STATE__ = null } catch {}
}
