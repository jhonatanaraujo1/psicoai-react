import { useState, useEffect } from 'react'
import { api } from '../services'

const STORAGE_KEY = 'psicoai_lgpd_consent'

// SEC-004: registrar consentimento com timestamp e versão dos termos
function recordConsent(accepted) {
  try {
    const record = JSON.stringify({
      accepted,
      timestamp: new Date().toISOString(),
      version: '1.0',
      userAgent: navigator.userAgent.slice(0, 120),
    })
    localStorage.setItem(STORAGE_KEY, record)
  } catch { /* localStorage bloqueado */ }
}

export default function LgpdBanner({ onShowTermos }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) { setVisible(true); return }
      // Compatibilidade com versão antiga (só guardava '1')
      try { JSON.parse(stored) } catch { setVisible(false) }
    } catch { /* localStorage bloqueado */ }
  }, [])

  const accept = async () => {
    recordConsent(true)
    setVisible(false)
    // Persiste no backend (best-effort, não bloqueia UI)
    try {
      await api.consentLgpd('v1')
    } catch { /* silencia — localStorage já foi salvo */ }
  }

  // SEC-004: recusar deve bloquear uso do app (dados de saúde exigem consentimento)
  const decline = () => {
    recordConsent(false)
    setVisible(false)
    // Redireciona para landing sem dados de saúde
    window.location.href = '/landing.html'
  }

  if (!visible) return null

  return (
    <>
      <style>{`
        @keyframes lgpd-up {
          from { transform: translateY(100%); opacity: 0 }
          to   { transform: translateY(0);    opacity: 1 }
        }
      `}</style>
      <div
        role="dialog"
        aria-label="Consentimento de privacidade LGPD"
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          zIndex: 10001,
          background: 'rgba(14, 22, 14, 0.98)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          animation: 'lgpd-up 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div style={{
          display: 'flex', flexDirection: 'column',
          gap: 10, padding: '14px 16px',
          fontFamily: "'DM Sans', sans-serif",
          maxWidth: 680, margin: '0 auto',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(92,143,106,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5C8F6A" strokeWidth="2.2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
              Dados de saúde — consentimento LGPD (Art. 11)
            </span>
          </div>

          {/* Body */}
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: 0 }}>
            O Psic Notes armazena e processa dados sensíveis de saúde (prontuários, anotações de sessão, análises clínicas com IA)
            conforme a LGPD 13.709/2018 e a Resolução CFP 09/2024. Os dados são criptografados em trânsito (TLS) e repouso.
            {' '}
            <button
              onClick={() => onShowTermos?.()}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5C8F6A', fontSize: 11, textDecoration: 'underline', padding: 0, fontFamily: 'inherit' }}
            >
              Ver política de privacidade completa
            </button>
          </p>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={decline}
              style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.4)', padding: '7px 14px',
                borderRadius: 20, fontSize: 11, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
            >
              Recusar
            </button>
            <button
              onClick={accept}
              style={{
                background: '#4A7C59', color: '#fff', border: 'none',
                padding: '7px 20px', borderRadius: 20,
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif", transition: 'background 0.15s',
                letterSpacing: '0.2px',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#3D6B4A'}
              onMouseLeave={e => e.currentTarget.style.background = '#4A7C59'}
            >
              Aceitar e continuar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
