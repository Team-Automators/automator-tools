import { toast } from 'react-toastify'

// ── Notifications ─────────────────────────────────────────────────────────────
export const notify        = (msg, type = 'info') => (toast[type] || toast.info)(msg)
export const notifySuccess = (msg) => toast.success(msg)
export const notifyError   = (msg) => toast.error(msg)
export const notifyInfo    = (msg) => toast.info(msg)

// ── Confirm (replaces window.confirm) — returns Promise<boolean> ──────────────
export function confirmToast(message, { confirmText = 'Confirm', cancelText = 'Cancel', danger = true } = {}) {
  return new Promise(resolve => {
    let settled = false
    const done = (val) => { if (!settled) { settled = true; resolve(val) } }

    toast(
      ({ closeToast }) => (
        <div>
          <div style={{ marginBottom: 12, fontSize: '.9rem', lineHeight: 1.4, color: 'var(--text)' }}>{message}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { done(false); closeToast() }}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: '.8rem', fontWeight: 600, cursor: 'pointer',
                border: '1px solid var(--border)', background: 'transparent', color: 'var(--sub)',
              }}
            >{cancelText}</button>
            <button
              onClick={() => { done(true); closeToast() }}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: '.8rem', fontWeight: 700, cursor: 'pointer', border: 'none',
                background: danger ? 'var(--danger, #DC2626)' : 'var(--accent)', color: '#fff',
              }}
            >{confirmText}</button>
          </div>
        </div>
      ),
      {
        autoClose: false,
        closeOnClick: false,
        closeButton: false,
        draggable: false,
        onClose: () => done(false),   // dismissed without choosing → treated as cancel
      }
    )
  })
}
