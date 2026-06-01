/**
 * OnboardingTour — sidebar-focused, card compacto ao lado do item
 * Cada passo aponta para um item da sidebar com spotlight + card pequeno.
 * Desktop: card à direita da sidebar, alinhado verticalmente ao item.
 * Mobile:  card centralizado acima do bottom nav.
 */
import { useState, useEffect, useRef } from 'react'

const SIDEBAR_W = 252   // var(--sw)
const PAD       = 6     // padding ao redor do spotlight
const RADIUS    = 10

const STEPS = [
  {
    id: 'agenda',
    selector: '[data-tour="nav-agenda"]',
    icon: '📅',
    title: 'Agenda',
    desc: 'Suas sessões do dia. Crie eventos e gerencie a semana.',
  },
  {
    id: 'pacientes',
    selector: '[data-tour="nav-pacientes"]',
    icon: '👤',
    title: 'Pacientes',
    desc: 'Cadastre, acompanhe e acesse o histórico completo.',
  },
  {
    id: 'cadernos',
    selector: '[data-tour="nav-cadernos"]',
    icon: '✏️',
    title: 'Anotações',
    desc: 'Canvas livre ou texto. Encerre a sessão e acione a IA.',
  },
  {
    id: 'insights',
    selector: '[data-tour="nav-insights"]',
    icon: '🧠',
    title: 'Análises IA',
    desc: 'Hipóteses DSM-5/CID-11 com probabilidade após cada sessão.',
  },
  {
    id: 'financeiro',
    selector: '[data-tour="nav-financeiro"]',
    icon: '💰',
    title: 'Financeiro',
    desc: 'Cobranças, recibos e controle de inadimplência.',
  },
  {
    id: 'formularios',
    selector: '[data-tour="nav-formularios"]',
    icon: '📋',
    title: 'Formulários',
    desc: 'PHQ-9, Beck, TCLE — envie direto ao paciente.',
  },
  {
    id: 'config',
    selector: '[data-tour="nav-configuracoes"]',
    icon: '⚙️',
    title: 'Configurações',
    desc: 'Perfil, plano, preferências e integrações.',
    isLast: true,
  },
]

export default function OnboardingTour({ isOpen, onClose }) {
  const [idx,  setIdx]  = useState(0)
  const [rect, setRect] = useState(null)
  const [vis,  setVis]  = useState(true)
  const touchX = useRef(0)
  const touchY = useRef(0)

  useEffect(() => {
    if (isOpen) { setIdx(0); setVis(true) }
  }, [isOpen])

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
    const t = setTimeout(measure, 150)
    window.addEventListener('resize', measure)
    return () => { clearTimeout(t); window.removeEventListener('resize', measure) }
  }, [idx, isOpen])

  if (!isOpen) return null

  const step   = STEPS[idx]
  const isLast = !!step.isLast
  const isMobile = window.innerWidth < 641
  const vw = window.innerWidth
  const vh = window.innerHeight

  const go = (next) => {
    if (next < 0 || next >= STEPS.length) return
    setVis(false)
    setTimeout(() => { setIdx(next); setVis(true) }, 80)
  }

  const finish = () => {
    try { localStorage.setItem('psicoai_onboarding_seen', 'true') } catch {}
    setIdx(0); onClose()
  }
  const skip = () => {
    try { localStorage.setItem('psicoai_onboarding_seen', 'true') } catch {}
    setIdx(0); onClose()
  }

  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; touchY.current = e.touches[0].clientY }
  const onTouchEnd   = (e) => {
    const dx = e.changedTouches[0].clientX - touchX.current
    const dy = e.changedTouches[0].clientY - touchY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 44) {
      if (dx < 0 && !isLast) go(idx + 1)
      else if (dx > 0 && idx > 0) go(idx - 1)
    }
  }

  // ── Posição do card ──────────────────────────────────────────────────────
  const CARD_W   = isMobile ? Math.min(320, vw - 24) : 280
  const CARD_GAP = 16

  let cardStyle = {}

  if (rect) {
    if (isMobile) {
      // Mobile: centralizado horizontalmente, acima do item (que está no bottom nav)
      const cx = rect.x + rect.w / 2
      cardStyle = {
        position: 'fixed',
        bottom: vh - rect.y + CARD_GAP,
        left: Math.max(12, Math.min(cx - CARD_W / 2, vw - CARD_W - 12)),
        width: CARD_W,
      }
    } else {
      // Desktop: à direita da sidebar, alinhado verticalmente ao item
      const itemMidY = rect.y + rect.h / 2
      // Card aprox. 100px de altura — centraliza verticalmente no item
      const cardH = 110
      let top = itemMidY - cardH / 2
      // Mantém dentro da viewport
      top = Math.max(16, Math.min(top, vh - cardH - 16))
      cardStyle = {
        position: 'fixed',
        left: SIDEBAR_W + CARD_GAP,
        top,
        width: CARD_W,
      }
    }
  } else {
    // Sem rect: centro da tela
    cardStyle = {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: CARD_W,
    }
  }

  const spreadPx = Math.round(Math.max(vw, vh) * 2.8)

  return (
    <>
      <style>{`
        @keyframes ob-in { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ob-spot { from{opacity:0} to{opacity:1} }
        .ob-card-new { animation: ob-in 0.18s cubic-bezier(0.4,0,0.2,1) }
        .ob-spot-new { animation: ob-spot 0.15s ease }
      `}</style>

      {/* Overlay / spotlight */}
      {rect ? (
        <div
          className="ob-spot-new"
          style={{
            position: 'fixed',
            left:   rect.x - PAD,
            top:    rect.y - PAD,
            width:  rect.w + PAD * 2,
            height: rect.h + PAD * 2,
            borderRadius: RADIUS,
            zIndex: 798,
            boxShadow: `0 0 0 ${spreadPx}px rgba(0,0,0,0.65)`,
            border: '1.5px solid rgba(92,143,106,0.6)',
            pointerEvents: 'none',
            transition: 'left 0.22s ease, top 0.22s ease, width 0.22s ease, height 0.22s ease',
          }}
        />
      ) : (
        <div style={{ position: 'fixed', inset: 0, zIndex: 798, background: 'rgba(0,0,0,0.65)' }}
             onClick={e => e.stopPropagation()} />
      )}
      {rect && <div style={{ position: 'fixed', inset: 0, zIndex: 797 }} onClick={e => e.stopPropagation()} />}

      {/* Tour card compacto */}
      <div
        key={`ob-${idx}`}
        className="ob-card-new"
        style={{
          ...cardStyle,
          zIndex: 800,
          opacity: vis ? 1 : 0,
          transition: 'opacity 0.08s',
          fontFamily: "'DM Sans', sans-serif",
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div style={{
          background: '#1A2E20',
          border: '1px solid rgba(92,143,106,0.25)',
          borderLeft: '3px solid #5C8F6A',
          borderRadius: 14,
          padding: '14px 16px 12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>

          {/* Header: ícone + título + contador */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{step.icon}</span>
            <span style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 15, fontWeight: 400, color: '#fff',
              flex: 1, lineHeight: 1.2,
            }}>
              {step.title}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, flexShrink: 0 }}>
              {idx + 1}/{STEPS.length}
            </span>
          </div>

          {/* Descrição curta */}
          <p style={{
            fontSize: 12, color: 'rgba(255,255,255,0.5)',
            lineHeight: 1.5, margin: '0 0 12px',
          }}>
            {step.desc}
          </p>

          {/* Progress bar fina */}
          <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 1, marginBottom: 12 }}>
            <div style={{
              height: '100%', borderRadius: 1,
              width: `${((idx + 1) / STEPS.length) * 100}%`,
              background: '#5C8F6A',
              transition: 'width 0.3s ease',
            }} />
          </div>

          {/* Botões */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={skip}
              style={{
                fontSize: 11, color: 'rgba(255,255,255,0.22)',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0 2px', fontFamily: "'DM Sans', sans-serif",
                flexShrink: 0,
              }}
            >
              Pular
            </button>

            <div style={{ flex: 1 }} />

            {idx > 0 && (
              <button
                onClick={() => go(idx - 1)}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.10)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'rgba(255,255,255,0.4)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
            )}

            <button
              onClick={isLast ? finish : () => go(idx + 1)}
              style={{
                height: 32, padding: '0 14px',
                background: 'linear-gradient(135deg, #5C8F6A, #4A7C59)',
                color: '#fff', border: 'none', borderRadius: 8,
                fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                display: 'flex', alignItems: 'center', gap: 4,
                flexShrink: 0,
              }}
              onTouchStart={e => { e.stopPropagation(); e.currentTarget.style.opacity = '0.85' }}
              onTouchEnd={e => { e.stopPropagation(); e.currentTarget.style.opacity = '1'; isLast ? finish() : go(idx + 1) }}
            >
              {isLast ? 'Começar' : 'Próximo'}
              {!isLast && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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
