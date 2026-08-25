import { useState, useEffect, useCallback } from 'react'
import { getLocationId, apiFetch } from '../lib/api.js'

const STORAGE_KEY = 'ghl_ai_config'

const AI_EVENT = 'aiconfig-changed'

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

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
    // Account-level key: if this browser has none but the user saved one before,
    // adopt it so the key never has to be re-entered after logout / on a new device.
    try {
      if (!readLocal()?.apiKey) {
        const kr = await apiFetch('/api/settings/ai-key').then(x => x.json()).catch(() => null)
        if (kr?.config?.apiKey) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(kr.config))
          setConfig(kr.config)
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
    setConfig(null)
    window.dispatchEvent(new Event(AI_EVENT))
    apiFetch('/api/settings/ai-key', { method: 'DELETE' }).catch(() => {})
  }

  return { config, loading, locationName, locationLogo, saveConfig, clearConfig, refresh }
}
