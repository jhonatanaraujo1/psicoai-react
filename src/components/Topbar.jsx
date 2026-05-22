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
  teleatendimento: 'Teleatendimento',
  configuracoes: 'Configurações',
}

const viewSubs = {
  financeiro: 'Receita, pagamentos e recibos',
  lembretes: 'Lembretes automáticos para pacientes',
  formularios: 'Anamnese, TCLE e escalas validadas',
  teleatendimento: 'Sessões remotas via videochamada',
  configuracoes: 'Perfil, plano e preferências do sistema',
}

export default function Topbar({ currentView, patientName, onHamburger, onAiOpen, currentUser }) {
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
  )
}
