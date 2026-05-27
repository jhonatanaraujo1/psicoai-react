import { useState, useRef, useEffect } from 'react'

// ── 5 slides — cada um cabe sem scroll em qualquer phone ─────────────────────
const SLIDES = [
  {
    id: 'welcome',
    gradient: ['#162218', '#2D4A38', '#1E3328'],
    iconBg: 'rgba(92,143,106,0.22)',
    icon: (
      <span style={{
        fontFamily: "'Fraunces', serif",
        fontSize: 54, color: 'rgba(255,255,255,0.95)',
        lineHeight: 1, display: 'block',
      }}>Ψ</span>
    ),
    badge: 'PsicoAI',
    title: 'Seu segundo olhar clínico',
    desc: 'O único assistente de raciocínio clínico para psicólogos. Hipóteses DSM-5 e alertas de risco — direto das suas anotações.',
    cta: 'Mostrar como funciona',
  },
  {
    id: 'patients',
    gradient: ['#1A2E22', '#3D6B4A', '#2D4A38'],
    iconBg: 'rgba(255,255,255,0.12)',
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none"
        stroke="rgba(255,255,255,0.95)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    badge: 'Prontuário',
    title: 'Cada paciente, uma história viva',
    desc: 'Linha do tempo de evolução, relatórios de IA acumulados e histórico completo — tudo no mesmo lugar.',
    cta: 'Próximo',
  },
  {
    id: 'session',
    gradient: ['#243828', '#4A7C59', '#1E3328'],
    iconBg: 'rgba(255,255,255,0.12)',
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none"
        stroke="rgba(255,255,255,0.95)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
    badge: 'Sessões',
    title: 'Anote do jeito que você pensa',
    desc: 'Canvas livre para escrever à mão ou texto estruturado. Ao encerrar, a IA analisa e devolve insights clínicos.',
    cta: 'Próximo',
  },
  {
    id: 'ai',
    gradient: ['#162218', '#2D4A38', '#4A7C59'],
    iconBg: 'rgba(255,255,255,0.12)',
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none"
        stroke="rgba(255,255,255,0.95)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
    badge: 'IA Clínica',
    title: 'Hipóteses em segundos',
    desc: 'Acione quando quiser. Padrões de comportamento, alertas graduados e hipóteses ponderadas pelo DSM-5 e CID-11.',
    cta: 'Próximo',
  },
  {
    id: 'ready',
    gradient: ['#1A3024', '#3D6B4A', '#2D4A38'],
    iconBg: 'rgba(255,255,255,0.14)',
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none"
        stroke="rgba(255,255,255,0.95)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
    badge: 'Pronto!',
    title: 'Você está a 3 cliques do primeiro insight',
    desc: 'Cadastre um paciente → registre uma sessão → acione a IA. Começa aqui.',
    cta: 'Começar a usar',
    isLast: true,
  },
]

// ── Dot indicator ─────────────────────────────────────────────────────────────
function Dots({ total, current, onGo }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onGo(i)}
          aria-label={`Slide ${i + 1}`}
          style={{
            width: i === current ? 22 : 7,
            height: 7,
            borderRadius: 4,
            background: i === current ? '#fff' : 'rgba(255,255,255,0.28)',
            border: 'none', cursor: 'pointer', padding: 0,
            transition: 'all 0.28s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OnboardingTour({ isOpen, onClose }) {
  const [idx, setIdx]         = useState(0)
  const [anim, setAnim]       = useState('in')   // 'in' | 'out-left' | 'out-right'
  const [dir, setDir]         = useState(1)       // 1 = forward, -1 = back
  const touchX                = useRef(0)
  const touchY                = useRef(0)
  const animLock              = useRef(false)

  // Reset when opened
  useEffect(() => { if (isOpen) { setIdx(0); setAnim('in') } }, [isOpen])

  if (!isOpen) return null

  const slide  = SLIDES[idx]
  const isLast = !!slide.isLast

  const goTo = (nextIdx, direction = nextIdx > idx ? 1 : -1) => {
    if (animLock.current || nextIdx === idx || nextIdx < 0 || nextIdx >= SLIDES.length) return
    animLock.current = true
    setDir(direction)
    setAnim(direction > 0 ? 'out-left' : 'out-right')
    setTimeout(() => {
      setIdx(nextIdx)
      setAnim('in')
      animLock.current = false
    }, 230)
  }

  const next = () => goTo(idx + 1, 1)
  const prev = () => goTo(idx - 1, -1)

  const dismiss = (permanent = false) => {
    if (permanent) localStorage.setItem('psicoai_onboarding_seen', 'true')
    setIdx(0)
    onClose()
  }

  const finish = () => {
    localStorage.setItem('psicoai_onboarding_seen', 'true')
    setIdx(0)
    onClose()
  }

  // Touch swipe
  const onTouchStart = (e) => {
    touchX.current = e.touches[0].clientX
    touchY.current = e.touches[0].clientY
  }
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchX.current
    const dy = e.changedTouches[0].clientY - touchY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 44) {
      if (dx < 0 && !isLast) next()
      else if (dx > 0 && idx > 0) prev()
    }
  }

  // Animated content transform
  const contentTransform = {
    'in':        { opacity: 1, transform: 'translateX(0)' },
    'out-left':  { opacity: 0, transform: dir > 0 ? 'translateX(-40px)' : 'translateX(40px)' },
    'out-right': { opacity: 0, transform: dir > 0 ? 'translateX(-40px)' : 'translateX(40px)' },
  }[anim]

  const bg = `linear-gradient(160deg, ${slide.gradient[0]} 0%, ${slide.gradient[1]} 55%, ${slide.gradient[2]} 100%)`

  return (
    <>
      <style>{`
        @keyframes ob-in  { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ob-bg  { from{opacity:0} to{opacity:1} }
        .ob-root { animation: ob-in 0.32s cubic-bezier(0.4,0,0.2,1) }
      `}</style>

      {/* Backdrop */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 800,
        background: 'rgba(5,12,6,0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        fontFamily: "'DM Sans', sans-serif",
        animation: 'ob-bg 0.25s ease',
      }}>

        {/* Sheet — full-width bottom sheet on mobile, centered card on desktop */}
        <div
          className="ob-root"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{
            width: '100%',
            maxWidth: 520,
            borderRadius: '24px 24px 0 0',
            overflow: 'hidden',
            boxShadow: '0 -8px 60px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '92dvh',
            /* on larger screens, make it a card */
            margin: '0 auto',
          }}
        >
          {/* ── Hero band ──────────────────────────────────────── */}
          <div style={{
            background: bg,
            transition: 'background 0.4s ease',
            padding: '28px 28px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            position: 'relative',
            flexShrink: 0,
          }}>
            {/* Skip button — top right */}
            <button
              onClick={() => dismiss(true)}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'rgba(255,255,255,0.1)',
                border: 'none', color: 'rgba(255,255,255,0.55)',
                padding: '5px 12px', borderRadius: 20,
                fontSize: 11, fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '0.3px',
                fontFamily: "'DM Sans', sans-serif",
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
              Pular
            </button>

            {/* Counter */}
            <div style={{
              fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.38)',
              letterSpacing: '1.2px', marginBottom: 24,
              alignSelf: 'flex-start',
            }}>
              {idx + 1} / {SLIDES.length}
            </div>

            {/* Icon circle */}
            <div
              style={{
                width: 100, height: 100, borderRadius: '50%',
                background: slide.iconBg,
                border: '1.5px solid rgba(255,255,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 24,
                transition: 'opacity 0.22s, transform 0.22s',
                ...contentTransform,
              }}
            >
              {slide.icon}
            </div>

            {/* Badge */}
            <div style={{
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20,
              padding: '4px 14px',
              fontSize: 10, fontWeight: 700,
              color: 'rgba(255,255,255,0.75)',
              letterSpacing: '1px', textTransform: 'uppercase',
              marginBottom: 14,
              transition: 'opacity 0.22s',
              opacity: contentTransform.opacity,
            }}>
              {slide.badge}
            </div>

            {/* Title */}
            <div style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 26, fontWeight: 400,
              color: '#fff',
              lineHeight: 1.2,
              letterSpacing: '-0.3px',
              maxWidth: 340,
              transition: 'opacity 0.22s, transform 0.22s',
              ...contentTransform,
            }}>
              {slide.title}
            </div>

            {/* Dots */}
            <div style={{ marginTop: 24 }}>
              <Dots total={SLIDES.length} current={idx} onGo={goTo} />
            </div>
          </div>

          {/* ── Body ────────────────────────────────────────────── */}
          <div style={{
            background: 'var(--w, #fff)',
            padding: '24px 28px 0',
            flexShrink: 0,
          }}>
            <p style={{
              fontSize: 14, color: 'var(--gr5, #6B6B6B)',
              lineHeight: 1.65, margin: 0,
              transition: 'opacity 0.22s, transform 0.22s',
              ...contentTransform,
            }}>
              {slide.desc}
            </p>
          </div>

          {/* ── Footer ───────────────────────────────────────────── */}
          <div style={{
            background: 'var(--w, #fff)',
            padding: '20px 28px',
            paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
            display: 'flex', alignItems: 'center', gap: 10,
            flexShrink: 0,
          }}>
            {/* Back (hidden on first slide) */}
            {idx > 0 ? (
              <button
                onClick={prev}
                style={{
                  width: 44, height: 44,
                  borderRadius: 12,
                  border: '1.5px solid var(--gr2, #E8E5E0)',
                  background: 'none',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--gr5, #6B6B6B)',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--g300, #8BB89A)'; e.currentTarget.style.color = 'var(--g600, #3D6B4A)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--gr2, #E8E5E0)'; e.currentTarget.style.color = 'var(--gr5, #6B6B6B)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
            ) : (
              /* "Não mostrar" faz o spacer + skip link */
              <button
                onClick={() => dismiss(true)}
                style={{
                  fontSize: 12, color: 'var(--gr4, #8B8B8B)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  padding: 0, flex: 1,
                  textAlign: 'left',
                  textDecoration: 'underline',
                  textDecorationColor: 'var(--gr3, #C8C5C0)',
                }}
              >
                Não exibir novamente
              </button>
            )}

            {/* Primary CTA */}
            <button
              onClick={isLast ? finish : next}
              style={{
                flex: 1,
                height: 50,
                background: 'var(--g500, #4A7C59)',
                color: '#fff',
                border: 'none',
                borderRadius: 14,
                fontSize: 14, fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 0.15s, transform 0.12s',
                letterSpacing: '0.1px',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--g600, #3D6B4A)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--g500, #4A7C59)'}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {slide.cta}
              {!isLast && (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
