/**
 * OnboardingTour — sidebar-focused, card compacto ao lado do item
 * Desktop: card à direita da sidebar alinhado ao item destacado.
 * Mobile:  card centralizado acima do item no bottom nav.
 *
 * Fixes:
 * - Blocker acima do bottom-nav (z-index > 9999) para evitar cliques passantes
 * - Botões usam onClick (não onTouchEnd) — evita "tap-through" do toque anterior
 * - Swipe detection apenas no wrapper e só quando não é toque em botão
 * - Atraso de 350ms antes de tornar o card interativo (evita tap-through na abertura)
 */
import { useState, useEffect, useRef } from 'react'

const SIDEBAR_W = 252
const PAD       = 6
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
    desc: 'Cadastre e acompanhe o histórico completo de cada paciente.',
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
    desc: 'Hipóteses DSM-5/CID-11 geradas por sessão analisada.',
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
    desc: 'Perfil, plano e preferências do consultório.',
    isLast: true,
  },
]

export default function OnboardingTour({ isOpen, onClose }) {
  const [idx,       setIdx]       = useState(0)
  const [rect,      setRect]      = useState(null)
  const [vis,       setVis]       = useState(true)
  const [ready,     setReady]     = useState(false)   // atraso para evitar tap-through
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const isTouchingBtn = useRef(false)

  // Reset ao abrir — delay de 350ms antes de aceitar cliques
  useEffect(() => {
    if (isOpen) {
      setIdx(0)
      setVis(true)
      setReady(false)
      const t = setTimeout(() => setReady(true), 350)
      return () => clearTimeout(t)
    }
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
    const t = setTimeout(measure, 120)
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

  // Swipe no wrapper — só dispara se não tocou em botão
  const onWrapTouchStart = (e) => {
    isTouchingBtn.current = false
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  const onWrapTouchEnd = (e) => {
    if (isTouchingBtn.current) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0 && !isLast) go(idx + 1)
      else if (dx > 0 && idx > 0) go(idx - 1)
    }
  }

  // ── Posição do card ──────────────────────────────────────────────────────
  const CARD_W   = isMobile ? Math.min(300, vw - 24) : 268
  const CARD_GAP = 14

  let cardStyle = {}

  if (rect) {
    if (isMobile) {
      const cx = rect.x + rect.w / 2
      const left = Math.max(12, Math.min(cx - CARD_W / 2, vw - CARD_W - 12))
      cardStyle = {
        position: 'fixed',
        bottom: vh - rect.y + CARD_GAP + 8,
        left,
        width: CARD_W,
      }
    } else {
      const itemMidY = rect.y + rect.h / 2
      const cardH = 120
      let top = itemMidY - cardH / 2
      top = Math.max(16, Math.min(top, vh - cardH - 16))
      cardStyle = {
        position: 'fixed',
        left: SIDEBAR_W + CARD_GAP,
        top,
        width: CARD_W,
      }
    }
  } else {
    cardStyle = {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: CARD_W,
    }
  }

  const spreadPx = Math.round(Math.max(vw, vh) * 2.8)
  // Blocker acima do bottom-nav (9999) e da sidebar (100) para bloquear cliques passantes
  const BLOCKER_Z = 10000

  return (
    <>
      <style>{`
        @keyframes ob-in  { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ob-spt { from{opacity:0} to{opacity:1} }
        .ob-card { animation: ob-in 0.2s cubic-bezier(0.4,0,0.2,1) both }
        .ob-spt  { animation: ob-spt 0.15s ease both }
      `}</style>

      {/* ── Blocker cobre toda a tela ACIMA de bottom-nav e sidebar ── */}
      <div
        style={{
          position: 'fixed', inset: 0,
          zIndex: BLOCKER_Z,
          // Sem background — só bloqueia cliques; o escurecimento vem do spotlight shadow
        }}
        onClick={e => e.stopPropagation()}
      />

      {/* ── Spotlight ── */}
      {rect ? (
        <div
          className="ob-spt"
          style={{
            position: 'fixed',
            left:   rect.x - PAD,
            top:    rect.y - PAD,
            width:  rect.w + PAD * 2,
            height: rect.h + PAD * 2,
            borderRadius: RADIUS,
            zIndex: BLOCKER_Z + 1,
            boxShadow: `0 0 0 ${spreadPx}px rgba(0,0,0,0.68)`,
            border: '2px solid rgba(92,143,106,0.65)',
            pointerEvents: 'none',
            transition: 'left 0.24s ease, top 0.24s ease, width 0.24s ease, height 0.24s ease',
          }}
        />
      ) : (
        // Sem elemento → overlay sólido atrás do card
        <div style={{
          position: 'fixed', inset: 0,
          zIndex: BLOCKER_Z,
          background: 'rgba(0,0,0,0.68)',
          pointerEvents: 'none',
        }} />
      )}

      {/* ── Tour card ── */}
      <div
        key={`ob-${idx}`}
        className="ob-card"
        style={{
          ...cardStyle,
          zIndex: BLOCKER_Z + 2,
          opacity: vis ? 1 : 0,
          pointerEvents: ready ? 'all' : 'none',  // bloqueia cliques nos 350ms iniciais
          transition: 'opacity 0.08s',
          fontFamily: "'DM Sans', sans-serif",
        }}
        onTouchStart={onWrapTouchStart}
        onTouchEnd={onWrapTouchEnd}
      >
        <div style={{
          background: '#1A2E20',
          border: '1px solid rgba(92,143,106,0.22)',
          borderLeft: '3px solid #5C8F6A',
          borderRadius: 14,
          padding: '14px 16px 12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
        }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{step.icon}</span>
            <span style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 15, fontWeight: 400, color: '#fff',
              flex: 1, lineHeight: 1.2,
            }}>
              {step.title}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', fontWeight: 600, flexShrink: 0 }}>
              {idx + 1}&thinsp;/&thinsp;{STEPS.length}
            </span>
          </div>

          {/* Descrição */}
          <p style={{
            fontSize: 12, color: 'rgba(255,255,255,0.48)',
            lineHeight: 1.55, margin: '0 0 11px',
          }}>
            {step.desc}
          </p>

          {/* Barra de progresso */}
          <div style={{ height: 2, background: 'rgba(255,255,255,0.07)', borderRadius: 1, marginBottom: 11 }}>
            <div style={{
              height: '100%', borderRadius: 1,
              width: `${((idx + 1) / STEPS.length) * 100}%`,
              background: '#5C8F6A',
              transition: 'width 0.3s ease',
            }} />
          </div>

          {/* Botões — usam onClick para evitar tap-through */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={skip}
              onTouchStart={() => { isTouchingBtn.current = true }}
              style={{
                fontSize: 11, color: 'rgba(255,255,255,0.22)',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0 2px', fontFamily: "'DM Sans', sans-serif",
                flexShrink: 0, minHeight: 32,
              }}
            >
              Pular
            </button>

            <div style={{ flex: 1 }} />

            {idx > 0 && (
              <button
                onClick={() => go(idx - 1)}
                onTouchStart={() => { isTouchingBtn.current = true }}
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
              onTouchStart={() => { isTouchingBtn.current = true }}
              style={{
                height: 32, padding: '0 14px',
                background: 'linear-gradient(135deg, #5C8F6A, #4A7C59)',
                color: '#fff', border: 'none', borderRadius: 8,
                fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                display: 'flex', alignItems: 'center', gap: 4,
                flexShrink: 0, minHeight: 32,
              }}
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
