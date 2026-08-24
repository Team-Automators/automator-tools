// The service categories shared by Tasks (Service dropdown) and Pipeline
// (board columns). Single source of truth so the two never drift.
export const SERVICES = [
  { key: 'setup-calls',  label: 'Setup Calls',             color: '#6366F1' },
  { key: 'funnels',      label: 'Funnels',                 color: '#EC4899' },
  { key: 'automations',  label: 'Automations & Workflows', color: '#F59E0B' },
  { key: 'testing-call', label: 'Testing Call',            color: '#10B981' },
  { key: 'voice-ai',     label: 'Voice AI',                color: '#06B6D4' },
]

export const SVC = Object.fromEntries(SERVICES.map(s => [s.key, s]))
export const serviceLabel = (key) => SVC[key]?.label || key
