/**
 * ConfirmDialog.jsx — Bottom sheet no mobile, modal centrado no desktop
 * API: const ok = await confirm({ title, message, confirmLabel, danger })
 */
import { useState, useEffect } from 'react'

const _listeners = new Set()

export function confirm({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Voltar', danger = false }) {
  return new Promise((resolve) => {
    _listeners.forEach(fn => fn({ title, message, confirmLabel, cancelLabel, danger, resolve }))
  })
}

export default function ConfirmDialog() {
  const [dialog, setDialog] = useState(null)
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const handler = (d) => { setDialog(d); setVisible(true); setClosing(false) }
    _listeners.add(handler)
    return () => _listeners.delete(handler)
  }, [])

  if (!visible || !dialog) return null

  const close = (result) => {
    setClosing(true)
    setTimeout(() => {
      setVisible(false)
      setClosing(false)
      setDialog(null)
      dialog.resolve(result)
    }, 220)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99997,
        // backdrop-filter: blur() causa artefatos de composição no Android Chrome
        // (GPU layer não cobre corretamente o viewport, parece "zoom" ou "desencaixe").
        // Substituído por overlay semi-transparente simples — mesmo efeito visual,
        // zero problema de composição.
        background: closing ? 'rgba(0,0,0,0)' : 'rgba(10,14,10,0.72)',
        display: 'flex',
        alignItems: 'flex-end',        // bottom sheet por padrão (mobile)
        justifyContent: 'center',
        transition: 'background 0.22s',
        // Previne overscroll e scroll do conteúdo por baixo no Android
        touchAction: 'none',
        overscrollBehavior: 'none',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) close(false) }}
    >
      <style>{`
        @media (min-width: 600px) {
          .confirm-sheet { border-radius: 16px !important; margin-bottom: 0 !important; max-width: 420px !important; animation: scaleIn 0.22s cubic-bezier(0.34,1.56,0.64,1) !important; }
        }
        @media (max-width: 599px) {
          .confirm-sheet { border-radius: 20px 20px 0 0 !important; }
        }
      `}</style>

      <div
        className="confirm-sheet"
        style={{
          background: 'var(--ow)',
          border: '1px solid var(--gr2)',
          width: '100%',
          maxWidth: '100%',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          animation: closing ? 'sheetOut 0.22s ease forwards' : 'sheetIn 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Handle bar (mobile) */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '12px', paddingBottom: '4px' }}>
          <div style={{
            width: '36px', height: '4px', borderRadius: '2px',
            background: 'var(--gr2)',
          }} />
        </div>

        <div style={{ padding: '16px 24px 8px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
            background: dialog.danger ? 'rgba(239,68,68,0.1)' : 'rgba(74,124,89,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {dialog.danger ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--g600)" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "'Fraunces', serif", fontSize: '18px', fontWeight: 400,
              color: 'var(--d)', lineHeight: 1.3, marginBottom: '6px',
            }}>
              {dialog.title}
            </div>
            {dialog.message && (
              <div style={{ fontSize: '13.5px', color: 'var(--gr5)', lineHeight: 1.6 }}>
                {dialog.message}
              </div>
            )}
          </div>
        </div>

        {/* Botões empilhados verticalmente (mobile-first) */}
        <div style={{ padding: '16px 24px 32px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => close(true)}
            style={{
              width: '100%', padding: '14px',
              borderRadius: '12px',
              background: dialog.danger ? '#ef4444' : 'var(--g600)',
              border: 'none', color: '#fff',
              fontSize: '15px', fontWeight: 700,
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              minHeight: '48px',
            }}
          >
            {dialog.confirmLabel}
          </button>
          <button
            onClick={() => close(false)}
            style={{
              width: '100%', padding: '13px',
              borderRadius: '12px',
              background: 'var(--w)',
              border: '1.5px solid var(--gr2)',
              color: 'var(--gr5)',
              fontSize: '15px', fontWeight: 600,
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              minHeight: '48px',
            }}
          >
            {dialog.cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
