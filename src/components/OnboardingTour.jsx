import { useState } from 'react'

// ── Slide definitions ────────────────────────────────────────────────────────
const SLIDES = [
  {
    id: 'welcome',
    bg: 'linear-gradient(135deg, #1E3328 0%, #3D6B4A 100%)',
    iconBg: 'rgba(255,255,255,0.15)',
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="1.4">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v4l3 3"/>
        <path d="M2 12h2M20 12h2M12 2v2M12 20v2"/>
      </svg>
    ),
    badge: 'Bem-vindo',
    title: 'Seu assistente de raciocínio clínico',
    desc: 'O PsicoAI combina prontuário eletrônico, IA clínica e ferramentas de sessão em um ambiente seguro, projetado exclusivamente para psicólogos.',
    bullets: [
      { icon: '◉', text: 'Hipóteses diagnósticas DSM-5 e CID-11 com probabilidade ponderada' },
      { icon: '◈', text: 'Alertas automáticos de padrões: evitação, ruminação, risco de crise' },
      { icon: '◇', text: 'Conformidade total CFP Resolução 09/2024 · dados criptografados' },
    ],
  },
  {
    id: 'dashboard',
    bg: 'linear-gradient(135deg, #2D4A38 0%, #4A7C59 100%)',
    iconBg: 'rgba(255,255,255,0.15)',
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="1.4">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    badge: 'Dashboard',
    title: 'Visão completa da sua prática',
    desc: 'Cada vez que você abre o PsicoAI, o Dashboard resume o estado atual da sua clínica: agenda do dia, sessões recentes, alertas e métricas que importam.',
    bullets: [
      { icon: '→', text: 'Agenda do dia com horários, pacientes e tipo de sessão' },
      { icon: '→', text: 'Alertas clínicos ativos — quem precisa de atenção agora' },
      { icon: '→', text: 'Atalho direto para iniciar qualquer sessão com um clique' },
    ],
  },
  {
    id: 'patients',
    bg: 'linear-gradient(135deg, #3D6B4A 0%, #5C8F6A 100%)',
    iconBg: 'rgba(255,255,255,0.15)',
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="1.4">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    badge: 'Pacientes',
    title: 'Prontuário clínico que evolui com você',
    desc: 'Cada paciente tem um prontuário completo com dados clínicos, histórico de sessões, linha do tempo de evolução, notas e relatórios de IA acumulados ao longo do tempo.',
    bullets: [
      { icon: '→', text: 'Cadastro completo: queixa, CID-11, abordagem, frequência, valor' },
      { icon: '→', text: 'Timeline de sessões com marcos, hipóteses e evolução visual' },
      { icon: '→', text: 'Notas livres com salvamento automático — nunca perde rascunhos' },
    ],
  },
  {
    id: 'session',
    bg: 'linear-gradient(135deg, #1E3328 0%, #2D4A38 100%)',
    iconBg: 'rgba(255,255,255,0.15)',
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="1.4">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
    badge: 'Sessões',
    title: 'Registre a sessão do jeito que pensa',
    desc: 'Dois modos de registro adaptados ao seu estilo: Canvas livre para desenhar e escrever à mão, ou Texto estruturado para anotações organizadas por categorias clínicas.',
    bullets: [
      { icon: '→', text: 'Canvas: canetinhas, formas, texto livre — ideal para mapas mentais' },
      { icon: '→', text: 'Texto: campos estruturados por queixa, intervenção e resposta' },
      { icon: '→', text: 'Ao encerrar, a IA gera análise automática com hipóteses e alertas' },
    ],
  },
  {
    id: 'ai',
    bg: 'linear-gradient(135deg, #2D4A38 0%, #5C8F6A 100%)',
    iconBg: 'rgba(255,255,255,0.15)',
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="1.4">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
      </svg>
    ),
    badge: 'Análise IA',
    title: 'Raciocínio clínico aumentado por IA',
    desc: 'Ao encerrar cada sessão, a IA analisa as anotações e gera um relatório clínico completo — hipóteses com probabilidade, padrões detectados, alertas de risco e sugestões para a próxima sessão.',
    bullets: [
      { icon: '→', text: 'Hipóteses diagnósticas com probabilidade ponderada (DSM-5 e CID-11)' },
      { icon: '→', text: 'Padrões comportamentais: evitação, ruminação, hipervigilância' },
      { icon: '→', text: 'Alertas graduados (baixo → crítico) com contexto clínico explicado' },
    ],
  },
  {
    id: 'insights',
    bg: 'linear-gradient(135deg, #3D6B4A 0%, #1E3328 100%)',
    iconBg: 'rgba(255,255,255,0.15)',
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="1.4">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
        <line x1="2" y1="20" x2="22" y2="20"/>
      </svg>
    ),
    badge: 'Insights Clínicos',
    title: 'Inteligência da sua carteira inteira',
    desc: 'A seção Inteligência Clínica agrega as análises de todos os pacientes e revela padrões da sua prática: hipóteses mais frequentes, alertas ativos, cobertura de análise e evolução geral.',
    bullets: [
      { icon: '→', text: 'Mapa de padrões da carteira: evitação, ruminação, isolamento e mais' },
      { icon: '→', text: 'Hipóteses diagnósticas mais frequentes com taxa de ocorrência' },
      { icon: '→', text: 'Clique em qualquer paciente para abrir o relatório de IA completo' },
    ],
  },
  {
    id: 'agenda',
    bg: 'linear-gradient(135deg, #1E3328 0%, #4A7C59 100%)',
    iconBg: 'rgba(255,255,255,0.15)',
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="1.4">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    badge: 'Agenda & Financeiro',
    title: 'Gestão completa em um único lugar',
    desc: 'A Agenda integra seus compromissos com os pacientes e links de teleatendimento. O módulo Financeiro rastreia sessões, pagamentos e gera relatórios de receita mensais.',
    bullets: [
      { icon: '→', text: 'Calendário semanal com visualização de slots e horários livres' },
      { icon: '→', text: 'Controle de sessões pagas, pendentes e recibos automáticos' },
      { icon: '→', text: 'Lembretes automáticos por e-mail ou WhatsApp para seus pacientes' },
    ],
  },
  {
    id: 'ready',
    bg: 'linear-gradient(135deg, #2D4A38 0%, #3D6B4A 100%)',
    iconBg: 'rgba(255,255,255,0.18)',
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="1.4">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
    badge: 'Pronto!',
    title: 'Você está pronto para começar',
    desc: 'Agora você conhece todas as ferramentas. Recomendamos começar pelo Dashboard e, depois, cadastrar seu primeiro paciente e registrar uma sessão.',
    bullets: [
      { icon: '1.', text: 'Acesse o Dashboard e veja seu panorama clínico de hoje' },
      { icon: '2.', text: 'Cadastre o primeiro paciente em Pacientes → Novo Paciente' },
      { icon: '3.', text: 'Inicie uma sessão e deixe a IA gerar sua primeira análise' },
    ],
  },
]

// ── Dot nav ──────────────────────────────────────────────────────────────────
function Dots({ total, current, onGo }) {
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <button key={i} onClick={() => onGo(i)}
          style={{ width: i === current ? '20px' : '7px', height: '7px', borderRadius: '4px', background: i === current ? '#fff' : 'rgba(255,255,255,0.35)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.25s' }} />
      ))}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function OnboardingTour({ isOpen, onClose }) {
  const [idx, setIdx] = useState(0)
  const [sliding, setSliding] = useState(false)
  const [dir, setDir] = useState(1) // 1 = forward, -1 = back

  if (!isOpen) return null

  const slide = SLIDES[idx]
  const isLast = idx === SLIDES.length - 1

  const goTo = (nextIdx) => {
    if (sliding || nextIdx === idx) return
    setDir(nextIdx > idx ? 1 : -1)
    setSliding(true)
    setTimeout(() => { setIdx(nextIdx); setSliding(false) }, 200)
  }
  const next = () => !isLast && goTo(idx + 1)
  const prev = () => idx > 0 && goTo(idx - 1)

  const dismiss = (permanent) => {
    if (permanent) localStorage.setItem('psicoai_onboarding_seen', 'true')
    setIdx(0)
    onClose()
  }

  const finish = () => {
    localStorage.setItem('psicoai_onboarding_seen', 'true')
    setIdx(0)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 800,
      background: 'rgba(10,15,10,0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* Card */}
      <div style={{
        width: '100%', maxWidth: '520px',
        background: 'var(--w)',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Hero band */}
        <div style={{
          background: slide.bg,
          padding: '32px 28px 28px',
          flexShrink: 0,
          transition: 'background 0.4s',
          position: 'relative',
        }}>
          {/* Close X */}
          <button onClick={() => dismiss(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'rgba(255,255,255,0.85)', width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', transition: 'background 0.15s' }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
            ✕
          </button>

          {/* Progress: slide X de Y */}
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '20px', fontWeight: 600, letterSpacing: '0.5px' }}>
            {idx + 1} DE {SLIDES.length}
          </div>

          {/* Icon */}
          <div style={{
            width: '80px', height: '80px', borderRadius: '20px',
            background: slide.iconBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '20px',
            opacity: sliding ? 0 : 1,
            transform: sliding ? `translateX(${dir * 24}px)` : 'translateX(0)',
            transition: 'opacity 0.18s, transform 0.18s',
          }}>
            {slide.icon}
          </div>

          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(255,255,255,0.15)', borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '10px', opacity: sliding ? 0 : 1, transition: 'opacity 0.18s' }}>
            {slide.badge}
          </div>

          {/* Title */}
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: '22px', fontWeight: 400, color: '#fff', lineHeight: 1.3, opacity: sliding ? 0 : 1, transform: sliding ? `translateX(${dir * 16}px)` : 'translateX(0)', transition: 'opacity 0.18s, transform 0.18s' }}>
            {slide.title}
          </div>

          {/* Dots */}
          <div style={{ marginTop: '20px' }}>
            <Dots total={SLIDES.length} current={idx} onGo={goTo} />
          </div>
        </div>

        {/* Content */}
        <div style={{
          padding: '24px 28px 20px',
          flex: 1,
          overflowY: 'auto',
          opacity: sliding ? 0 : 1,
          transform: sliding ? `translateX(${dir * 16}px)` : 'translateX(0)',
          transition: 'opacity 0.18s, transform 0.18s',
        }}>
          {/* Description */}
          <p style={{ fontSize: '14px', color: 'var(--gr5)', lineHeight: 1.65, margin: '0 0 20px' }}>
            {slide.desc}
          </p>

          {/* Bullets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {slide.bullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'var(--g50)', border: '1px solid var(--g100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--g600)', flexShrink: 0, marginTop: '1px' }}>
                  {b.icon}
                </div>
                <span style={{ fontSize: '13px', color: 'var(--d)', lineHeight: 1.55 }}>{b.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px 20px', borderTop: '1px solid var(--gr2)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {/* "Não mostrar" link */}
          <button onClick={() => dismiss(true)}
            style={{ fontSize: '12px', color: 'var(--gr4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", padding: 0, flex: 1, textAlign: 'left', textDecoration: 'underline', textDecorationColor: 'var(--gr3)' }}>
            Não mostrar novamente
          </button>

          {/* Nav buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {idx > 0 && (
              <button onClick={prev}
                style={{ padding: '10px 16px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'var(--w)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", color: 'var(--gr5)', transition: 'all 0.15s' }}
                onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--g300)'; e.currentTarget.style.color = 'var(--g600)' }}
                onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--gr2)'; e.currentTarget.style.color = 'var(--gr5)' }}>
                ← Anterior
              </button>
            )}
            {isLast ? (
              <button onClick={finish}
                style={{ padding: '10px 22px', border: 'none', borderRadius: 'var(--r)', background: 'var(--g600)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'background 0.15s', display: 'flex', alignItems: 'center', gap: '6px' }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--g700)'}
                onMouseOut={e => e.currentTarget.style.background = 'var(--g600)'}>
                Começar a usar
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            ) : (
              <button onClick={next}
                style={{ padding: '10px 22px', border: 'none', borderRadius: 'var(--r)', background: 'var(--g600)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'background 0.15s' }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--g700)'}
                onMouseOut={e => e.currentTarget.style.background = 'var(--g600)'}>
                Próximo →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
