import { useState, useEffect } from 'react'

const STORAGE_KEY = 'psicoai_lgpd_consent'

export default function LgpdBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch { /* localStorage bloqueado */ }
  }, [])

  const accept = () => {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
    setVisible(false)
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
        aria-label="Aviso de privacidade LGPD"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          /* abaixo do OnboardingTour (z=800) mas acima do conteúdo normal */
          zIndex: 798,
          background: 'rgba(18, 26, 18, 0.97)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          /* sobe acima da bottom-nav no mobile */
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)',
          animation: 'lgpd-up 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Container inline — single row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {/* Lock icon */}
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(92,143,106,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5C8F6A" strokeWidth="2.2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3, display: 'block' }}>
              <strong style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Dados protegidos</strong>
              {' '}· CFP 09/2024 · LGPD 13.709/2018 · criptografados em trânsito e repouso
            </span>
          </div>

          {/* Política link */}
          <a
            href="/politica-privacidade"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 10, color: 'rgba(255,255,255,0.28)',
              textDecoration: 'underline', flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            Política
          </a>

          {/* CTA */}
          <button
            onClick={accept}
            style={{
              background: '#4A7C59',
              color: '#fff',
              border: 'none',
              padding: '7px 16px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              flexShrink: 0,
              whiteSpace: 'nowrap',
              letterSpacing: '0.2px',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#3D6B4A'}
            onMouseLeave={e => e.currentTarget.style.background = '#4A7C59'}
          >
            Entendido
          </button>
        </div>
      </div>
    </>
  )
}
