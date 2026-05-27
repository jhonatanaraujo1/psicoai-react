/**
 * OnboardingTour — Spotlight tour nativo iOS
 * Foca nos elementos reais da UI com efeito de spotlight via box-shadow.
 * 4 passos: welcome → pacientes → cadernos → pronto.
 */
import { useState, useEffect, useRef } from 'react'

const PAD    = 10   // padding ao redor do elemento destacado
const RADIUS = 14   // border-radius do spotlight

const STEPS = [
  {
    id: 'welcome',
    selector: null,
    badge: 'PsicoAI',
    title: 'Seu segundo olhar clínico',
    desc: 'O assistente feito para psicólogos. Prontuários, sessões e análise de IA — num lugar só, criptografado.',
    cta: 'Mostrar como funciona',
  },
  {
    id: 'patients',
    selector: '[data-tour="nav-pacientes"]',
    badge: 'Pacientes',
    title: 'Cada paciente, uma história viva',
    desc: 'Cadastre, acompanhe e visualize diagnósticos, documentos e histórico completo de cada paciente.',
    cta: 'Próximo',
  },
  {
    id: 'notes',
    selector: '[data-tour="nav-cadernos"]',
    badge: 'Cadernos',
    title: 'Anote do jeito que você pensa',
    desc: 'Canvas livre ou texto estruturado. Encerre a sessão e acione a IA — hipóteses DSM-5 em segundos.',
    cta: 'Próximo',
  },
  {
    id: 'ready',
    selector: null,
    badge: 'Pronto',
    title: 'A 3 cliques do primeiro insight',
    desc: 'Cadastre um paciente → abra uma sessão → acione a IA. Começa aqui.',
    cta: 'Começar a usar',
    isLast: true,
  },
]

export default function OnboardingTour({ isOpen, onClose }) {
  const [idx,  setIdx]  = useState(0)
  const [rect, setRect] = useState(null)
  const [fade, setFade] = useState(true)
  const touchX = useRef(0)
  const touchY = useRef(0)

  // Reset ao abrir
  useEffect(() => {
    if (isOpen) { setIdx(0); setFade(true) }
  }, [isOpen])

  // Mede o elemento-alvo do passo atual
  useEffect(() => {
    if (!isOpen) return
    const step = STEPS[idx]
    if (!step.selector) { setRect(null); return }

    const measure = () => {
      const el = document.querySelector(step.selector)
      if (!el) { setRect(null); return }
      const r = el.getBoundingClientRect()
      setRect({ x: r.left, y: r.top, w: r.width, h: r.height })
    }

    measure()
    const t = setTimeout(measure, 120) // retry após render
    window.addEventListener('resize', measure)
    return () => { clearTimeout(t); window.removeEventListener('resize', measure) }
  }, [idx, isOpen])

  if (!isOpen) return null

  const step   = STEPS[idx]
  const isLast = !!step.isLast
  const vw     = window.innerWidth
  const vh     = window.innerHeight

  const go = (next) => {
    if (next < 0 || next >= STEPS.length) return
    setFade(false)
    setTimeout(() => { setIdx(next); setFade(true) }, 90)
  }

  const dismiss = (permanent = false) => {
    if (permanent) {
      try { localStorage.setItem('psicoai_onboarding_seen', 'true') } catch {}
    }
    setIdx(0); onClose()
  }

  const finish = () => {
    try { localStorage.setItem('psicoai_onboarding_seen', 'true') } catch {}
    setIdx(0); onClose()
  }

  // Swipe horizontal
  const onTouchStart = (e) => {
    touchX.current = e.touches[0].clientX
    touchY.current = e.touches[0].clientY
  }
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchX.current
    const dy = e.changedTouches[0].clientY - touchY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 44) {
      if (dx < 0 && !isLast) go(idx + 1)
      else if (dx > 0 && idx > 0) go(idx - 1)
    }
  }

  // Posição do card: acima ou abaixo do spotlight
  const GUTTER = 14
  const cardBase = { position: 'fixed', left: 14, right: 14, zIndex: 800 }
  let cardPos = {}
  if (rect) {
    const midY = rect.y + rect.h / 2
    if (midY > vh * 0.55) {
      // Spotlight na metade inferior → card acima
      cardPos = { bottom: vh - (rect.y - PAD) + GUTTER }
    } else {
      // Spotlight na metade superior → card abaixo
      cardPos = { top: rect.y + rect.h + PAD + GUTTER }
    }
  } else {
    // Sem spotlight → posiciona no terço superior para não colidir com o banner LGPD
    // (que fica na parte de baixo). Terço superior = 18%–28% do viewport.
    cardPos = { top: Math.round(vh * 0.18) }
  }

  const spreadPx = Math.round(Math.max(vw, vh) * 2.5)

  return (
    <>
      <style>{`
        @keyframes ob-spot-in { from{opacity:0} to{opacity:1} }
        @keyframes ob-card-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .ob-card { animation: ob-card-in 0.22s cubic-bezier(0.4,0,0.2,1) }
        .ob-spot { animation: ob-spot-in 0.18s ease }
      `}</style>

      {/* ── Overlay / Spotlight ────────────────────────────────────── */}
      {rect ? (
        /* Box-shadow cria o escurecimento ao redor do spotlight */
        <div
          className="ob-spot"
          style={{
            position: 'fixed',
            left:  rect.x - PAD,
            top:   rect.y - PAD,
            width: rect.w + PAD * 2,
            height: rect.h + PAD * 2,
            borderRadius: RADIUS,
            zIndex: 798,
            boxShadow: `0 0 0 ${spreadPx}px rgba(0,0,0,0.60)`,
            border: '2px solid rgba(92,143,106,0.55)',
            pointerEvents: 'none',
            transition: 'left 0.28s ease, top 0.28s ease, width 0.28s ease, height 0.28s ease',
          }}
        />
      ) : (
        /* Sem spotlight: overlay sólido */
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 798,
            background: 'rgba(0,0,0,0.60)',
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* ── Bloqueador de cliques fora da área (quando há spotlight) ── */}
      {rect && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 797, cursor: 'default' }}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* ── Tour card ──────────────────────────────────────────────── */}
      <div
        key={`card-${idx}`}
        className="ob-card"
        style={{ ...cardBase, ...cardPos, opacity: fade ? 1 : 0, transition: 'opacity 0.09s' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Pular — sempre visível */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button
            onClick={() => dismiss(true)}
            style={{
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.45)',
              fontSize: 11, fontWeight: 600, letterSpacing: '0.2px',
              padding: '4px 14px', borderRadius: 20,
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Pular
          </button>
        </div>

        {/* Card body */}
        <div style={{
          background: '#1A2E20',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: '20px 20px 16px',
          boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {/* Badge + counter */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase',
              background: 'rgba(92,143,106,0.22)', border: '1px solid rgba(92,143,106,0.3)',
              color: '#9DC4A8', borderRadius: 20, padding: '3px 10px',
            }}>
              {step.badge}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', fontWeight: 600, letterSpacing: '0.3px' }}>
              {idx + 1} / {STEPS.length}
            </span>
          </div>

          {/* Título */}
          <div style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 22, fontWeight: 400, color: '#fff',
            lineHeight: 1.2, marginBottom: 8, letterSpacing: '-0.2px',
          }}>
            {step.title}
          </div>

          {/* Descrição */}
          <p style={{
            fontSize: 13.5, color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.65, margin: '0 0 16px',
          }}>
            {step.desc}
          </p>

          {/* Dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 14 }}>
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                style={{
                  height: 4, borderRadius: 2,
                  width: i === idx ? 20 : 6,
                  background: i === idx ? '#5C8F6A' : 'rgba(255,255,255,0.18)',
                  transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                  border: 'none', cursor: 'pointer', padding: 0,
                }}
                aria-label={`Passo ${i + 1}`}
              />
            ))}
          </div>

          {/* Botões */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {idx > 0 ? (
              <button
                onClick={() => go(idx - 1)}
                style={{
                  width: 42, height: 42, borderRadius: 10,
                  border: '1.5px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'rgba(255,255,255,0.45)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
            ) : (
              <button
                onClick={() => dismiss(true)}
                style={{
                  fontSize: 11.5, color: 'rgba(255,255,255,0.25)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0, textDecoration: 'underline',
                  textDecorationColor: 'rgba(255,255,255,0.12)',
                  fontFamily: "'DM Sans', sans-serif",
                  flex: 1, textAlign: 'left',
                }}
              >
                Não exibir novamente
              </button>
            )}

            <button
              onClick={isLast ? finish : () => go(idx + 1)}
              style={{
                flex: 1, height: 44,
                background: 'linear-gradient(135deg, #5C8F6A 0%, #4A7C59 100%)',
                color: '#fff', border: 'none',
                borderRadius: 12, fontSize: 13.5, fontWeight: 700,
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                letterSpacing: '0.1px',
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              onTouchStart={e => { e.stopPropagation(); e.currentTarget.style.transform = 'scale(0.97)' }}
              onTouchEnd={e => { e.stopPropagation(); e.currentTarget.style.transform = 'scale(1)'; isLast ? finish() : go(idx + 1) }}
            >
              {step.cta}
              {!isLast && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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
