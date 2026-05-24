import { useState, useEffect } from 'react'

const STORAGE_KEY = 'psicoai_lgpd_consent'

export default function LgpdBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch {
      // localStorage bloqueado (modo privado restrito) — não mostrar
    }
  }, [])

  const accept = () => {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Aviso de privacidade LGPD"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'var(--d)',
        color: 'rgba(255,255,255,0.85)',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.25)',
        fontSize: '12px',
        lineHeight: 1.6,
      }}
    >
      <div style={{ flex: 1, minWidth: '260px' }}>
        <strong style={{ color: '#fff', display: 'block', marginBottom: '2px' }}>
          Privacidade e proteção de dados
        </strong>
        Este sistema armazena dados clínicos de pacientes para fins de registro de prontuário eletrônico, conforme{' '}
        <strong style={{ color: 'rgba(255,255,255,0.9)' }}>Resolução CFP 09/2024</strong> e{' '}
        <strong style={{ color: 'rgba(255,255,255,0.9)' }}>LGPD (Lei 13.709/2018)</strong>.
        O acesso é restrito ao profissional titular e os dados são criptografados em trânsito e em repouso.
        Ao continuar, você confirma que está ciente das responsabilidades sobre os dados dos seus pacientes.
      </div>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <a
          href="/politica-privacidade"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.55)',
            textDecoration: 'underline',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            alignSelf: 'center',
          }}
        >
          Política de Privacidade
        </a>
        <button
          onClick={accept}
          style={{
            background: 'var(--g500)',
            color: '#fff',
            border: 'none',
            padding: '9px 20px',
            borderRadius: 'var(--r)',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--g600)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--g500)'}
        >
          Entendido
        </button>
      </div>
    </div>
  )
}
