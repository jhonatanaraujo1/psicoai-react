import { useState, useEffect } from 'react'

// ── Singleton event bus ────────────────────────────────────────────────────────
let _id = 0
const _listeners = []

export function showToast(message, type = 'success') {
  const id = ++_id
  _listeners.forEach(fn => fn({ id, message, type }))
}

// ── Container ─────────────────────────────────────────────────────────────────
export function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const handler = (toast) => {
      setToasts(prev => [...prev, toast])
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id))
      }, 3400)
    }
    _listeners.push(handler)
    return () => {
      const idx = _listeners.indexOf(handler)
      if (idx !== -1) _listeners.splice(idx, 1)
    }
  }, [])

  if (toasts.length === 0) return null

  const BG = {
    success: 'var(--g700)',
    error:   'var(--danger)',
    warn:    'var(--warn)',
    info:    'var(--d2)',
  }

  const ICON = {
    success: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
    error: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    ),
    warn: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    info: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
  }

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      right: 20,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: BG[t.type] || BG.success,
            color: '#fff',
            padding: '11px 16px',
            borderRadius: 'var(--r)',
            fontSize: 13,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 500,
            boxShadow: '0 4px 20px rgba(0,0,0,0.22)',
            animation: 'toastSlideIn 0.22s ease',
            maxWidth: 360,
            lineHeight: 1.4,
            pointerEvents: 'auto',
          }}
        >
          {ICON[t.type] || ICON.success}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
