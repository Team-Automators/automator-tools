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

  async updateCustomer(id, { name, email } = {}) {
    const body = { locationId: getLocationId() }
    if (name !== undefined) body.name = name
    if (email !== undefined) body.email = email
    const r = await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return r.json()
  },

  async deleteCustomer(id) {
    const url = withLocationId(new URL(`/api/customers/${id}`, window.location.origin))
    const r = await fetch(url.toString(), { method: 'DELETE' })
    return r.json()
  },

  async getCopies(customerId = '', limit = 0, status = '') {
    const url = withLocationId(new URL('/api/copies', window.location.origin))
    if (customerId) url.searchParams.set('customerId', customerId)
    if (limit) url.searchParams.set('limit', String(limit))
    if (status) url.searchParams.set('status', status)
    const r = await fetch(url.toString())
    if (!r.ok) return []
    return r.json()
  },

  async getArchivedCopies() {
    return this.getCopies('', 0, 'archived')
  },

  async claimLegacyData() {
    const r = await fetch('/api/settings/claim-legacy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: getLocationId() }),
    })
    return r.json()
  },

  async setCopyStatus(id, status) {
    const r = await fetch(`/api/copies/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: getLocationId(), status }),
    })
    return r.json()
  },

  // Permanently delete (from Archive). Regular deleteCopy now soft-deletes (archives).
  async purgeCopy(id) {
    const url = withLocationId(new URL(`/api/copies/${id}`, window.location.origin))
    url.searchParams.set('permanent', 'true')
    const r = await fetch(url.toString(), { method: 'DELETE' })
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

  async generateGhlPrompt({ copy, html, provider, apiKey, model }) {
    const r = await fetch('/copywrite/generate-ghl-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ copy, html, provider, apiKey, model }),
    })
    return r.json()
  },

  async generateMockup({ copy, type, mode, copyLength, provider, apiKey, model }) {
    const r = await fetch('/copywrite/mockup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ copy, type, mode, copyLength, provider, apiKey, model, seed: Date.now() }),
    })
    return r.json()
  },

  // Streaming version for AI mode — returns { html, mode } when done
  generateMockupStream({ copy, type, mode, copyLength, provider, apiKey, model }, { onChunk } = {}) {
    return new Promise((resolve, reject) => {
      fetch('/copywrite/mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copy, type, mode, copyLength, provider, apiKey, model, seed: Date.now() }),
      }).then(async resp => {
        if (!resp.ok) {
          const j = await resp.json().catch(() => ({}))
          reject(new Error(j.error || `Request failed (${resp.status})`))
          return
        }
        const reader = resp.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop()
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6)
            if (raw === '[DONE]') continue
            try {
              const parsed = JSON.parse(raw)
              if (parsed.chunk && onChunk) onChunk(parsed.chunk)
              if (parsed.done) resolve({ html: parsed.html, mode: parsed.mode })
              if (parsed.error) reject(new Error(parsed.error))
            } catch {}
          }
        }
      }).catch(reject)
    })
  },

  // Stream a project brief from a call transcript.
  analyzeTranscriptStream({ transcript, clientName, provider, apiKey, model }, { onChunk } = {}) {
    return new Promise((resolve, reject) => {
      fetch('/copywrite/analyze-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, clientName, provider, apiKey, model }),
      }).then(async resp => {
        if (!resp.ok) {
          const j = await resp.json().catch(() => ({}))
          reject(new Error(j.error || `Request failed (${resp.status})`))
          return
        }
        const reader = resp.body.getReader()
        const decoder = new TextDecoder()
        let buf = '', full = '', errText = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop()
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6)
            if (raw === '[DONE]') continue
            try {
              const parsed = JSON.parse(raw)
              if (parsed.error) errText = parsed.error
              else if (parsed.text) { full += parsed.text; onChunk?.(parsed.text, full) }
            } catch {}
          }
        }
        if (errText && !full) reject(new Error(errText))
        else resolve(full)
      }).catch(reject)
    })
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
