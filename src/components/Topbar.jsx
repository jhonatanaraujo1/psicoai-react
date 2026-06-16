const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const viewTitles = {
  dashboard: null,
  pacientes: 'Pacientes',
  paciente: 'Paciente',
  insights: 'Insights IA',
  sessao: 'Anotar Sessão',
  agenda: 'Agenda',
  financeiro: 'Financeiro',
  lembretes: 'Lembretes',
  formularios: 'Formulários',
  anotacoes: 'Anotações',
  teleatendimento: 'Teleatendimento',
  configuracoes: 'Configurações',
}

const viewSubs = {
  financeiro: 'Receita, pagamentos e recibos',
  lembretes: 'Lembretes automáticos para pacientes',
  formularios: 'Anamnese, TCLE e escalas validadas',
  anotacoes: 'Todas as anotações de sessão em um lugar',
  teleatendimento: 'Sessões remotas via videochamada',
  configuracoes: 'Perfil, plano e preferências do sistema',
}

export default function Topbar({
  currentView,
  patientName,
  onHamburger,
  onAiOpen,
  onNotifOpen,    // () → abre painel de notificações/lembretes
  notifCount,     // número de notificações pendentes (0 = sem badge)
  currentUser,
  // Multi-session badge
  openSessionsCount,   // número total de sessões abertas (fundo + foreground)
  onSessionsBadgeClick, // () → abre o painel de sessões
}) {

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const dateStr = `${days[now.getDay()]}, ${now.getDate()} de ${months[now.getMonth()]} de ${now.getFullYear()}`

  const title = currentView === 'paciente' && patientName ? patientName : viewTitles[currentView]
  const sub = viewSubs[currentView] || dateStr

  const firstName = currentUser?.name?.split(' ').find(w => w.length > 2) || currentUser?.name?.split(' ')[0] || 'Psicólogo'
  const initials = currentUser?.name
    ? currentUser.name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : 'DR'

  return (
    <>
      {/* ── Topbar principal ────────────────────────────────────────────── */}
      <div className="topbar">
        <button className="hamburger" onClick={onHamburger} aria-label="Menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <div className="tb-left">
          {currentView === 'dashboard' ? (
            <h2>{greeting}, <span>{firstName}</span> 👋</h2>
          ) : (
            <h2>{title}</h2>
          )}
          <p>{sub}</p>
        </div>
        <div className="tb-right">
          {/* Badge de sessões abertas — aparece quando há ≥1 sessão em andamento */}
          {openSessionsCount > 0 && (
            <button
              onClick={onSessionsBadgeClick}
              title={`${openSessionsCount} sessão(ões) em andamento`}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 10px 5px 8px',
                background: 'rgba(255,107,44,0.10)',
                border: '1.5px solid rgba(255,107,44,0.35)',
                borderRadius: '20px',
                color: '#D94F00',
                cursor: 'pointer',
                fontSize: '12px', fontWeight: 700,
                fontFamily: "'DM Sans', sans-serif",
                transition: 'background 0.15s',
                animation: 'pulse-border 2s ease-in-out infinite',
              }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,107,44,0.18)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255,107,44,0.10)'}
            >
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#FF6B2C',
                animation: 'pulse-dot 1.8s ease-in-out infinite',
                flexShrink: 0,
                display: 'inline-block',
              }} />
              {openSessionsCount}
            </button>
          )}
          {/* Notificações — agenda, lembretes, formulários respondidos */}
          <button className="tb-btn" onClick={onNotifOpen} title="Notificações" style={{ position: 'relative' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {notifCount > 0 && (
              <span style={{
                position: 'absolute', top: '2px', right: '2px',
                width: '8px', height: '8px', borderRadius: '50%',
                background: 'var(--danger, #E74C3C)',
                border: '1.5px solid var(--ow)',
              }} />
            )}
          </button>
          {/* Assistente IA — reflexão clínica */}
          <button className="tb-btn" onClick={onAiOpen} title="Assistente IA">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 2a4 4 0 0 1 4 4c0 1.5-.6 2.8-1.5 3.8L17 21H7l2.5-11.2A5.5 5.5 0 0 1 8 6a4 4 0 0 1 4-4z"/>
              <path d="M9 21h6"/>
              <circle cx="12" cy="6" r="1.5" fill="currentColor" stroke="none"/>
            </svg>
          </button>
          <div className="av-circle" style={{ width: '34px', height: '34px', fontSize: '12px' }}>{initials}</div>
        </div>
      </div>
    </>
  )
}
