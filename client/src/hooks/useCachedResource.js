import { useEffect, useState } from 'react'

// Simple stale-while-revalidate cache for page data. The first visit to a page
// fetches (and shows its loading state); every later visit shows the cached data
// INSTANTLY — no loading flash — while a fresh copy is fetched in the background
// and swapped in. This is what makes navigating between pages feel instant once
// they've been opened. The cache is in-memory (per session) and keyed by a
// caller-supplied string that should include the locationId so tenants never
// share data.
const cache = new Map()

export function useCachedResource(key, fetcher) {
  const [data, setData] = useState(() => (key != null ? cache.get(key) : undefined))
  const [loading, setLoading] = useState(() => !(key != null && cache.has(key)))

  useEffect(() => {
    let alive = true
    if (key == null) return
    // Only show the spinner when we have nothing cached to show.
    if (!cache.has(key)) setLoading(true)
    Promise.resolve(fetcher())
      .then(d => { if (!alive) return; cache.set(key, d); setData(d); setLoading(false) })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Update local + cached data together (for optimistic edits/deletes).
  const mutate = (updater) => {
    setData(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (key != null) cache.set(key, next)
      return next
    })
  }

  return { data, loading, mutate, setData: mutate }
}

// Warm a resource into the cache ahead of navigation (e.g. on nav hover) so the
// page has its data ready the moment it opens.
export function prefetchResource(key, fetcher) {
  if (key == null || cache.has(key)) return
  return Promise.resolve(fetcher()).then(d => cache.set(key, d)).catch(() => {})
}

// Low-level cache access for pages that manage several pieces of state and just
// want to seed initial values from cache + write back after loading.
export function getCached(key) { return key != null ? cache.get(key) : undefined }
export function setCached(key, val) { if (key != null) cache.set(key, val) }

// Drop cached entries (e.g. after a mutation that changes many pages).
export function invalidateResource(prefix) {
  if (prefix == null) { cache.clear(); return }
  for (const k of cache.keys()) if (String(k).startsWith(prefix)) cache.delete(k)
}
