import { useState, useEffect, useCallback } from 'react'
import { getLocationId, apiFetch } from '../lib/api.js'

const STORAGE_KEY = 'ghl_ai_config'

const AI_EVENT = 'aiconfig-changed'
const SHARED_KEY = 'ghl_ai_shared'   // marks the local key as admin-shared (revocable)

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function isShared() { try { return localStorage.getItem(SHARED_KEY) === '1' } catch { return false } }
function setShared(v) { try { if (v) localStorage.setItem(SHARED_KEY, '1'); else localStorage.removeItem(SHARED_KEY) } catch {} }

export function useAIConfig() {
  const [config, setConfig]             = useState(readLocal)   // { provider, apiKey, model }
  const [locationName, setLocationName] = useState('')
  const [locationLogo, setLocationLogo] = useState('')
  const [loading, setLoading]           = useState(true)

  const locationId = getLocationId()

  const refresh = useCallback(async () => {
    if (!locationId) { setLoading(false); return }
    try {
      const r = await apiFetch('/api/settings')
      const d = await r.json()
      setLocationName(d.locationName || '')
      setLocationLogo(d.locationLogo || '')
    } catch {}
    // Reconcile with the account-level key on the server:
    //  • adopt it if this browser has none (survives logout / new device), or if
    //    our current key is an admin-SHARED one (keep it in sync).
    //  • if our key was shared and the server no longer has one, an admin revoked
    //    it → remove it locally.
    try {
      const local = readLocal()
      const wasShared = isShared()
      const kr = await apiFetch('/api/settings/ai-key').then(x => x.json()).catch(() => null)
      if (kr) {
        if (kr.config?.apiKey) {
          if (!local?.apiKey || wasShared) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(kr.config))
            setShared(!!kr.shared)
            setConfig(kr.config)
            window.dispatchEvent(new Event(AI_EVENT))
          }
        } else if (wasShared && local?.apiKey) {
          localStorage.removeItem(STORAGE_KEY)
          setShared(false)
          setConfig(null)
          window.dispatchEvent(new Event(AI_EVENT))
        }
      }
    } catch {}
    finally { setLoading(false) }
  }, [locationId])

  useEffect(() => { refresh() }, [refresh])

  // Keep every useAIConfig instance (sidebar chip, banner, pages) in sync when
  // the key is saved/cleared anywhere — same tab (custom event) or another tab
  // (native storage event).
  useEffect(() => {
    const sync = () => setConfig(readLocal())
    window.addEventListener(AI_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(AI_EVENT, sync); window.removeEventListener('storage', sync) }
  }, [])

  function saveConfig({ provider, apiKey, model, businessName }) {
    // AI config → localStorage (device-specific)
    const stored = { provider, apiKey, model }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    setShared(false)   // the user set their own key — no longer a shared one
    setConfig(stored)
    window.dispatchEvent(new Event(AI_EVENT))

    // Persist to the user's account (by email) so it survives logout and works
    // on any location / device without re-entering.
    apiFetch('/api/settings/ai-key', {
      method: 'PUT',
      body: JSON.stringify({ provider, apiKey, model }),
    }).catch(() => {})

    // Business name → server (shared per locationId)
    if (businessName !== undefined) {
      apiFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify({ locationId, businessName: businessName.trim() }),
      })
        .then(r => r.json())
        .then(d => { if (d.locationName !== undefined) setLocationName(d.locationName) })
        .catch(() => {})
    }
  }

  function clearConfig() {
    localStorage.removeItem(STORAGE_KEY)
    setShared(false)
    setConfig(null)
    window.dispatchEvent(new Event(AI_EVENT))
    apiFetch('/api/settings/ai-key', { method: 'DELETE' }).catch(() => {})
  }

  return { config, loading, locationName, locationLogo, saveConfig, clearConfig, refresh }
}
