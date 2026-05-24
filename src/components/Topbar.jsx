import { confirm } from './ConfirmDialog'

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
  currentUser,
  // Session background alert
  sessionInBackground,
  activeSessionPatient,
  activeSessionType,
  activeSessionId,
  onReturnToSession,
  onEndBackgroundSession,
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

  const typeLabel = activeSessionType === 'canvas' ? 'Canvas' : 'Texto'

  return (
    <>
      {/* ── Alerta de sessão em background ──────────────────────────────── */}
      {sessionInBackground && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 200,
          background: 'linear-gradient(90deg, #92400e 0%, #b45309 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          padding: '0 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '12px', flexWrap: 'wrap',
          minHeight: '44px',
          animation: 'slideDown 0.2s ease',
        }}>
          {/* Indicador pulsando + texto */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#fbbf24',
              boxShadow: '0 0 0 0 rgba(251,191,36,0.7)',
              animation: 'pulse-dot 1.8s ease-in-out infinite',
              flexShrink: 0,
              display: 'inline-block',
            }} />
            <span style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.85)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, maxWidth: '240px' }}>
              Sessão ativa
              {activeSessionPatient && (
                <> — <strong style={{ color: '#fff' }}>{activeSessionPatient}</strong></>
              )}
              <span style={{
                marginLeft: '8px',
                fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px',
                padding: '1px 7px', borderRadius: '20px',
                background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)',
                textTransform: 'uppercase',
              }}>{typeLabel}</span>
              {activeSessionId && (
                <span style={{ marginLeft: '8px', fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                  #{activeSessionId.slice(-6)}
                </span>
              )}
            </span>
          </div>

          {/* Botões de ação */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={onReturnToSession}
              style={{
                padding: '5px 14px', borderRadius: '7px',
                background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)',
                color: '#fff', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                display: 'flex', alignItems: 'center', gap: '6px',
                transition: 'background 0.15s',
              }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Voltar à sessão
            </button>
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: 'Encerrar sessão?',
                  message: `A sessão de ${activeSessionPatient || 'paciente'} será encerrada sem análise IA. As anotações autosalvas serão mantidas no prontuário.`,
                  confirmLabel: 'Encerrar',
                  cancelLabel: 'Cancelar',
                  danger: true,
                })
                if (ok) onEndBackgroundSession?.()
              }}
              style={{
                padding: '5px 12px', borderRadius: '7px',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.45)', fontSize: '12px',
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                transition: 'all 0.15s',
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; e.currentTarget.style.color = '#fca5a5' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)' }}
            >
              Encerrar
            </button>
          </div>
        </div>
      )}

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
          <button className="tb-btn" onClick={onAiOpen} title="Análise IA">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span className="notif-dot"></span>
          </button>
          <div className="av-circle" style={{ width: '34px', height: '34px', fontSize: '12px' }}>{initials}</div>
        </div>
      </div>
    </>
  )
}
