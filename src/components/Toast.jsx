/**
 * Toast.jsx — Notificações mobile-first
 * Bottom center no mobile, bottom-right no desktop
 */
import { useState, useEffect, useRef, useCallback } from 'react'

let _id = 0
const _listeners = new Set()
const _dismissListeners = new Set()

export function showToast(message, type = 'success', options = {}) {
  const id = options.id || `t-${++_id}`
  _listeners.forEach(fn => fn({ id, message, type, ...options }))
  return id
}

export function dismissToast(id) {
  _dismissListeners.forEach(fn => fn(id))
}

const ICONS = {
  success: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  ),
  warn: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  loading: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{ animation: 'spin 0.8s linear infinite', display: 'block' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  ),
}

const THEME = {
  success: { bg: '#162a1e', border: '#27543a', accent: '#4ade80' },
  error:   { bg: '#2a1616', border: '#543027', accent: '#f87171' },
  warn:    { bg: '#2a2010', border: '#54420f', accent: '#fbbf24' },
  info:    { bg: '#161c2a', border: '#273054', accent: '#60a5fa' },
  loading: { bg: '#161c2a', border: '#273054', accent: '#60a5fa' },
}

function ToastItem({ toast, onDismiss }) {
  const { id, message, type = 'success', description, action, persistent, duration = 4500 } = toast
  const [progress, setProgress] = useState(100)
  const [exiting, setExiting] = useState(false)
  const startRef = useRef(Date.now())
  const rafRef = useRef(null)
  const theme = THEME[type] || THEME.info

  const dismiss = useCallback(() => {
    if (exiting) return
    setExiting(true)
    setTimeout(() => onDismiss(id), 260)
  }, [id, onDismiss, exiting])

  useEffect(() => {
    if (persistent || type === 'loading') return
    const tick = () => {
      const pct = Math.max(0, 100 - ((Date.now() - startRef.current) / duration) * 100)
      setProgress(pct)
      if (pct > 0) rafRef.current = requestAnimationFrame(tick)
      else dismiss()
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [duration, persistent, type, dismiss])

  return (
    <div
      onClick={persistent || type === 'loading' ? undefined : dismiss}
      style={{
        position: 'relative',
        background: theme.bg,
        border: `1px solid ${theme.border}`,
        borderLeft: `3px solid ${theme.accent}`,
        borderRadius: '12px',
        padding: '13px 15px',
        width: '100%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
        cursor: persistent || type === 'loading' ? 'default' : 'pointer',
        overflow: 'hidden',
        animation: exiting
          ? 'toastOut 0.26s ease forwards'
          : 'toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        fontFamily: "'DM Sans', sans-serif",
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Barra de progresso */}
      {!persistent && type !== 'loading' && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px',
          background: 'rgba(255,255,255,0.05)',
        }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: theme.accent, opacity: 0.6,
            transition: 'none', borderRadius: '2px',
          }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: '11px', alignItems: 'flex-start' }}>
        <div style={{ color: theme.accent, flexShrink: 0, paddingTop: '1px' }}>
          {ICONS[type] || ICONS.info}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f1f5f9', lineHeight: 1.4 }}>
            {message}
          </div>
          {description && (
            <div style={{ fontSize: '12px', color: 'rgba(241,245,249,0.5)', marginTop: '3px', lineHeight: 1.5 }}>
              {description}
            </div>
          )}
          {action && (
            <button
              onClick={(e) => { e.stopPropagation(); action.onClick?.(); if (!persistent) dismiss() }}
              style={{
                marginTop: '9px',
                background: 'rgba(255,255,255,0.08)',
                border: `1px solid ${theme.border}`,
                color: theme.accent,
                padding: '5px 13px', borderRadius: '6px',
                fontSize: '12.5px', fontWeight: 600,
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                minHeight: '32px', // tap target
              }}
            >
              {action.label}
            </button>
          )}
        </div>
        {(persistent || type === 'loading') && (
          <button
            onClick={dismiss}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(241,245,249,0.3)',
              cursor: 'pointer', padding: '2px', flexShrink: 0,
              minWidth: '28px', minHeight: '28px', // tap target
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const add = (toast) => setToasts(prev => {
      const exists = prev.find(t => t.id === toast.id)
      if (exists) return prev.map(t => t.id === toast.id ? { ...t, ...toast } : t)
      const next = [...prev, toast]
      return next.length > 4 ? next.slice(-4) : next
    })
    const remove = (id) => setToasts(prev => prev.filter(t => t.id !== id))
    _listeners.add(add)
    _dismissListeners.add(remove)
    return () => { _listeners.delete(add); _dismissListeners.delete(remove) }
  }, [])

  const dismiss = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), [])

  if (!toasts.length) return null

  return (
    <>
      <style>{`
        @media (max-width: 600px) {
          .toast-container { left: 12px !important; right: 12px !important; bottom: 80px !important; width: auto !important; max-width: none !important; }
        }
      `}</style>
      <div
        className="toast-container"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '20px',
          width: '360px',
          maxWidth: 'calc(100vw - 40px)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: '8px',
          pointerEvents: 'none',
        }}
      >
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto', width: '100%' }}>
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </>
  )
}
