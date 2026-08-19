const LOCATION_KEY = 'ghl_location_id'

export function getLocationId() {
  const url = new URL(window.location.href)
  return url.searchParams.get('locationId') || localStorage.getItem(LOCATION_KEY) || ''
}

export function persistLocationId(id) {
  if (id) localStorage.setItem(LOCATION_KEY, id)
}

function withLocationId(url) {
  const id = getLocationId()
  if (id) url.searchParams.set('locationId', id)
  return url
}

export async function apiFetch(path, opts = {}) {
  const url = withLocationId(new URL(path, window.location.origin))
  return fetch(url.toString(), {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  })
}

export const api = {
  async getDashboard() {
    const r = await apiFetch('/api/dashboard')
    if (!r.ok) return null
    return r.json()
  },

  async getCustomers() {
    const r = await apiFetch('/api/customers')
    if (!r.ok) return []
    return r.json()
  },

  async createCustomer(name, email = '') {
    const r = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: getLocationId(), name, email }),
    })
    return r.json()
  },

  async deleteCustomer(id) {
    const url = withLocationId(new URL(`/api/customers/${id}`, window.location.origin))
    const r = await fetch(url.toString(), { method: 'DELETE' })
    return r.json()
  },

  async getCopies(customerId = '', limit = 0) {
    const url = withLocationId(new URL('/api/copies', window.location.origin))
    if (customerId) url.searchParams.set('customerId', customerId)
    if (limit) url.searchParams.set('limit', String(limit))
    const r = await fetch(url.toString())
    if (!r.ok) return []
    return r.json()
  },

  async getCopy(id) {
    const r = await apiFetch(`/api/copies/${id}`)
    if (!r.ok) return null
    return r.json()
  },

  async saveCopy({ customerId, customerName, type, messages, title, preview }) {
    const r = await fetch('/api/copies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: getLocationId(), customerId, customerName, type, messages, title, preview }),
    })
    return r.json()
  },

  async updateCopy(id, { messages, customerId, customerName } = {}) {
    const body = { locationId: getLocationId(), messages }
    if (customerId !== undefined) body.customerId = customerId
    if (customerName !== undefined) body.customerName = customerName
    const r = await fetch(`/api/copies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return r.json()
  },

  async deleteCopy(id) {
    const url = withLocationId(new URL(`/api/copies/${id}`, window.location.origin))
    const r = await fetch(url.toString(), { method: 'DELETE' })
    return r.json()
  },

  async getTasks() {
    const r = await apiFetch('/api/tasks')
    if (!r.ok) return []
    return r.json()
  },

  async createTask({ title, customerId, customerName, stage, notes }) {
    const r = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: getLocationId(), title, customerId, customerName, stage, notes }),
    })
    return r.json()
  },

  async updateTask(id, fields) {
    const r = await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: getLocationId(), ...fields }),
    })
    return r.json()
  },

  async deleteTask(id) {
    const url = withLocationId(new URL(`/api/tasks/${id}`, window.location.origin))
    const r = await fetch(url.toString(), { method: 'DELETE' })
    return r.json()
  },

  async addNote(taskId, text) {
    const r = await fetch(`/api/tasks/${taskId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: getLocationId(), text }),
    })
    return r.json()
  },

  async deleteNote(taskId, noteId) {
    const url = withLocationId(new URL(`/api/tasks/${taskId}/notes/${noteId}`, window.location.origin))
    const r = await fetch(url.toString(), { method: 'DELETE' })
    return r.json()
  },

  async getHooks() {
    const r = await apiFetch('/api/hooks')
    if (!r.ok) return []
    return r.json()
  },

  async createHook({ name, destinationUrl, customerId, customerName }) {
    const r = await fetch('/api/hooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: getLocationId(), name, destinationUrl, customerId, customerName }),
    })
    return r.json()
  },

  async updateHook(id, fields) {
    const r = await fetch(`/api/hooks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: getLocationId(), ...fields }),
    })
    return r.json()
  },

  async deleteHook(id) {
    const url = withLocationId(new URL(`/api/hooks/${id}`, window.location.origin))
    const r = await fetch(url.toString(), { method: 'DELETE' })
    return r.json()
  },

  async resolveClickupTask(taskId) {
    const url = withLocationId(new URL(`/api/clickup/task/${taskId}`, window.location.origin))
    const r = await fetch(url.toString())
    return r.json()
  },

  async getClickupWorkspaces() {
    const url = withLocationId(new URL('/api/clickup/workspaces', window.location.origin))
    const r = await fetch(url.toString())
    if (!r.ok) return []
    return r.json()
  },

  async getClickupSpaces(teamId) {
    const url = withLocationId(new URL(`/api/clickup/spaces/${teamId}`, window.location.origin))
    const r = await fetch(url.toString())
    if (!r.ok) return []
    return r.json()
  },

  async getClickupSpaceContent(spaceId) {
    const url = withLocationId(new URL(`/api/clickup/space/${spaceId}/content`, window.location.origin))
    const r = await fetch(url.toString())
    if (!r.ok) return { folders: [], lists: [] }
    return r.json()
  },

  async getClickupFolderLists(folderId) {
    const url = withLocationId(new URL(`/api/clickup/folder/${folderId}/lists`, window.location.origin))
    const r = await fetch(url.toString())
    if (!r.ok) return []
    return r.json()
  },

  async getClickupListTasks(listId) {
    const url = withLocationId(new URL(`/api/clickup/list/${listId}/tasks`, window.location.origin))
    const r = await fetch(url.toString())
    const d = await r.json()
    if (!r.ok) throw new Error(d.error || 'Failed to load tasks')
    return d
  },

  async searchClickupTasks(teamId, q) {
    const url = withLocationId(new URL('/api/clickup/search', window.location.origin))
    url.searchParams.set('teamId', teamId)
    url.searchParams.set('q', q)
    const r = await fetch(url.toString())
    if (!r.ok) return []
    return r.json()
  },

  async saveHookMapping(id, { fieldMap, autoCreate }) {
    const r = await fetch(`/api/hooks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: getLocationId(), fieldMap, autoCreate }),
    })
    return r.json()
  },

  async testHook(id) {
    const r = await fetch(`/api/hooks/${id}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: getLocationId() }),
    })
    return r.json()
  },

  async testAIKey({ provider, apiKey, model }) {
    const r = await fetch('/copywrite/test-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey, model }),
    })
    return r.json()
  },

  async getBrandVoice() {
    const r = await apiFetch('/copywrite/brand-voice')
    if (!r.ok) return null
    return r.json()
  },

  async clearBrandVoice() {
    const url = withLocationId(new URL('/copywrite/brand-voice', window.location.origin))
    const r = await fetch(url.toString(), { method: 'DELETE' })
    return r.json()
  },

  async addCopyFeedback({ type, text, sentiment }) {
    const r = await fetch('/copywrite/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: getLocationId(), type, text, sentiment }),
    })
    return r.json()
  },

  async getSession(type) {
    const r = await apiFetch(`/copywrite/session?type=${encodeURIComponent(type)}`)
    if (!r.ok) return []
    const d = await r.json()
    return d.messages || []
  },

  async saveSession(type, messages) {
    try {
      await fetch('/copywrite/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: getLocationId(), type, messages }),
      })
    } catch {}
  },

  async generateGhlPrompt({ copy, provider, apiKey, model }) {
    const r = await fetch('/copywrite/generate-ghl-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ copy, provider, apiKey, model }),
    })
    return r.json()
  },

  async generateMockup({ copy, type, mode, provider, apiKey, model }) {
    const r = await fetch('/copywrite/mockup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ copy, type, mode, provider, apiKey, model, seed: Date.now() }),
    })
    return r.json()
  },

  async analyzeVoice({ provider, apiKey, model }) {
    const url = withLocationId(new URL('/copywrite/analyze-voice', window.location.origin))
    const r = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey, model }),
    })
    return r.json()
  },
}
