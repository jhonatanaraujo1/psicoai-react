/**
 * FeedbackModal — Bug report, sugestão ou problema na análise IA.
 *
 * Props:
 *   isOpen        — boolean
 *   onClose       — () => void
 *   preset        — { type: 'BUG'|'SUGGESTION'|'AI_ISSUE'|'OTHER', context?: object } | null
 *   currentView   — string (tela atual, capturado automático)
 *   api           — api service (passado via prop para não criar acoplamento circular)
 */

import { useState, useEffect, useRef } from 'react'

// ── Tipos disponíveis ──────────────────────────────────────────────────────────
const TYPES = [
  {
    key:   'BUG',
    label: 'Reportar problema',
    icon:  '🐛',
    placeholder: 'Descreva o que aconteceu. Ex: o botão X não funcionou, a tela ficou em branco após...',
    hint:  'Problemas técnicos, erros, comportamentos inesperados',
  },
  {
    key:   'SUGGESTION',
    label: 'Sugestão',
    icon:  '💡',
    placeholder: 'Qual funcionalidade ou melhoria você gostaria de ver? Ex: seria útil se eu pudesse...',
    hint:  'Ideias para novas funcionalidades ou melhorias',
  },
  {
    key:   'AI_ISSUE',
    label: 'Problema na IA',
    icon:  '🤖',
    placeholder: 'O que ficou errado na análise? Ex: as hipóteses não refletem o que escrevi, a análise foi genérica, ignorou o padrão principal...',
    hint:  'Análise imprecisa, genérica ou sem relação com suas anotações',
  },
  {
    key:   'OTHER',
    label: 'Outro',
    icon:  '✉️',
    placeholder: 'Escreva sua mensagem...',
    hint:  'Qualquer outra mensagem ou dúvida',
  },
]

// Fora do componente — referência estável (regra anti-focus-loss)
const onFocus = e => {
  e.target.style.borderColor = 'var(--g300)'
  e.target.style.boxShadow   = '0 0 0 3px rgba(74,124,89,0.08)'
}
const onBlur = e => {
  e.target.style.borderColor = 'var(--gr2)'
  e.target.style.boxShadow   = 'none'
}

export default function FeedbackModal({ isOpen, onClose, preset, currentView, api }) {
  const [activeType, setActiveType]     = useState('BUG')
  const [message, setMessage]           = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [submitted, setSubmitted]       = useState(false)
  const [error, setError]               = useState(null)
  const textareaRef = useRef(null)

  // Ao abrir: aplicar preset e focar textarea
  useEffect(() => {
    if (!isOpen) return
    if (preset?.type) setActiveType(preset.type)
    setMessage('')
    setSubmitted(false)
    setError(null)
    setTimeout(() => textareaRef.current?.focus(), 80)
  }, [isOpen, preset?.type]) // eslint-disable-line

  // ESC fecha
  useEffect(() => {
    if (!isOpen) return
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [isOpen, onClose])

  const handleSubmit = async () => {
    const msg = message.trim()
    if (!msg) { setError('Escreva sua mensagem antes de enviar.'); return }
    if (msg.length < 10) { setError('Mensagem muito curta. Adicione mais detalhes.'); return }

    setSubmitting(true)
    setError(null)
    try {
      const context = JSON.stringify({
        currentView: currentView || 'unknown',
        ...(preset?.context || {}),
        browser: navigator.userAgent.slice(0, 120),
        timestamp: new Date().toISOString(),
      })
      await api.submitFeedback({ type: activeType, message: msg, context })
      setSubmitted(true)
    } catch (e) {
      setError('Não foi possível enviar. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  const current = TYPES.find(t => t.key === activeType) || TYPES[0]

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 9500,
          animation: 'fadeIn 0.15s ease',
        }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Feedback"
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9501,
          width: 'min(480px, calc(100vw - 32px))',
          background: 'var(--w)',
          borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          fontFamily: "'DM Sans', sans-serif",
          overflow: 'hidden',
          animation: 'slideUp 0.18s ease',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--d)' }}>
              Fale conosco
            </div>
            <div style={{ fontSize: '12px', color: 'var(--gr4)', marginTop: '2px' }}>
              Sua mensagem chega direto pra nós
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gr4)', fontSize: '18px', lineHeight: 1, padding: '2px 4px', borderRadius: '4px' }}
            aria-label="Fechar"
          >✕</button>
        </div>

        {submitted ? (
          /* ── Estado de sucesso ── */
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🙏</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--d)', marginBottom: '6px' }}>
              Obrigado pelo feedback!
            </div>
            <div style={{ fontSize: '13px', color: 'var(--gr5)', lineHeight: 1.6, marginBottom: '24px' }}>
              Sua mensagem foi recebida.<br/>Ela nos ajuda a melhorar o PsicoNotes para todos os psicólogos.
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'var(--g500)', color: '#fff', border: 'none',
                padding: '10px 28px', borderRadius: 'var(--r)',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Fechar
            </button>
          </div>
        ) : (
          /* ── Formulário ── */
          <div style={{ padding: '16px 20px 20px' }}>

            {/* Tabs de tipo */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '6px', marginBottom: '16px',
            }}>
              {TYPES.map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => { setActiveType(t.key); setError(null); textareaRef.current?.focus() }}
                  title={t.hint}
                  style={{
                    padding: '8px 4px 7px',
                    border: activeType === t.key ? '1.5px solid var(--g400)' : '1.5px solid var(--gr2)',
                    borderRadius: '8px',
                    background: activeType === t.key ? 'var(--g50)' : 'var(--ow)',
                    cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                    transition: 'all 0.12s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                  }}
                >
                  <span style={{ fontSize: '18px', lineHeight: 1 }}>{t.icon}</span>
                  <span style={{
                    fontSize: '10px', fontWeight: activeType === t.key ? 700 : 500,
                    color: activeType === t.key ? 'var(--g700)' : 'var(--gr5)',
                    lineHeight: 1.2, textAlign: 'center',
                  }}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={message}
              onChange={e => { setMessage(e.target.value); if (error) setError(null) }}
              onFocus={onFocus}
              onBlur={onBlur}
              placeholder={current.placeholder}
              rows={5}
              maxLength={2000}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${error ? 'var(--danger)' : 'var(--gr2)'}`,
                borderRadius: 'var(--r)',
                fontSize: '13px',
                fontFamily: "'DM Sans', sans-serif",
                color: 'var(--d)',
                lineHeight: 1.65,
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
                background: 'var(--w)',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                minHeight: '108px',
              }}
            />

            {/* Contagem + erro */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px', marginBottom: '14px' }}>
              {error ? (
                <span style={{ fontSize: '11px', color: 'var(--danger)' }}>{error}</span>
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--gr4)' }}>{current.hint}</span>
              )}
              <span style={{ fontSize: '11px', color: message.length > 1800 ? 'var(--warn)' : 'var(--gr3)', flexShrink: 0, marginLeft: '8px' }}>
                {message.length}/2000
              </span>
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !message.trim()}
              style={{
                width: '100%',
                padding: '12px',
                background: submitting || !message.trim() ? 'var(--gr2)' : 'var(--g500)',
                color: submitting || !message.trim() ? 'var(--gr4)' : '#fff',
                border: 'none',
                borderRadius: 'var(--r)',
                fontSize: '14px',
                fontWeight: 700,
                cursor: submitting || !message.trim() ? 'not-allowed' : 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                transition: 'background 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
              onMouseOver={e => { if (!submitting && message.trim()) e.currentTarget.style.background = 'var(--g600)' }}
              onMouseOut={e => { if (!submitting && message.trim()) e.currentTarget.style.background = 'var(--g500)' }}
            >
              {submitting ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Enviando…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  Enviar mensagem
                </>
              )}
            </button>

          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translate(-50%, calc(-50% + 12px)) } to { opacity: 1; transform: translate(-50%, -50%) } }
      `}</style>
    </>
  )
}
