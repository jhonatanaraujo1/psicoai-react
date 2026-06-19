// ── Icon map — JSX SVGs, no dangerouslySetInnerHTML ──────────────────────────
const ICONS = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  pacientes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  insights: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  sessao: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  cadernos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  ),
  agenda: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  financeiro: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  lembretes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  formularios: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  teleatendimento: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2"/>
    </svg>
  ),
  configuracoes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
}

export default function Sidebar({ currentView, setCurrentView, isOpen, onClose, currentUser, onLogout }) {
  const nav = (id) => {
    setCurrentView(id)
    onClose()
  }

  const navItem = (id, label) => (
    <button
      key={id}
      data-tour={`nav-${id}`}
      className={`nav-item${currentView === id ? ' active' : ''}`}
      onClick={() => nav(id)}
      title={label}
      aria-label={label}
    >
      {ICONS[id]}
      <span className="nav-label">{label}</span>
    </button>
  )

  const navItemSoon = (id, label) => (
    <button
      key={id}
      className="nav-item"
      disabled
      title={`${label} — em breve`}
      aria-label={`${label} (em breve)`}
      style={{ opacity: 0.4, cursor: 'not-allowed' }}
    >
      {ICONS[id]}
      <span className="nav-label">{label}</span>
      <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)', padding: '1px 5px', borderRadius: '4px', marginLeft: 'auto', flexShrink: 0, letterSpacing: '0.3px' }}>breve</span>
    </button>
  )

  const initials = currentUser?.name
    ? currentUser.name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : 'DR'

  return (
    <aside className={`sidebar${isOpen ? ' open' : ''}`}>
      <div className="sb-logo">
        <div className="sb-psi">Ψ</div>
        <div className="sb-brand">Psic <span>Notes</span></div>
      </div>

      <nav className="sb-nav">
        <div className="nav-section">Hoje</div>
        {navItem('agenda',      'Agenda')}

        <div className="nav-section">Clínico</div>
        {navItem('pacientes',   'Meus pacientes')}
        {navItem('cadernos',    'Anotações')}
        {navItem('insights',    'Análises com IA')}

        <div className="nav-section">Consultório</div>
        {navItem('financeiro',  'Financeiro')}
        {navItem('lembretes',   'Lembretes')}
        {navItem('formularios', 'Formulários')}
        {navItem('teleatendimento', 'Videoatendimento')}

        <div className="nav-section">Sistema</div>
        {navItem('configuracoes', 'Configurações')}
      </nav>

      <div className="sb-footer">
        <div className="sb-avatar" style={{ cursor: 'default' }}>
          <div className="av-circle">{initials}</div>
          <div className="av-info">
            <div className="av-name">{currentUser?.name || 'Psicólogo'}</div>
            <div className="av-role">{currentUser?.crp ? `CRP ${currentUser.crp}` : 'Conta demo'}</div>
          </div>
          <button
            title="Sair"
            onClick={onLogout}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: '10px', minWidth: '40px', minHeight: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>

        {currentUser?.plan && (
          <div className="sb-plan-info" style={{ marginTop: '8px', padding: '6px 8px', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>
              {{ especialista: 'Especialista', clinico: 'Especialista', consultorio: 'Consultório', base: 'Consultório' }[currentUser.plan] || 'Plano'}
            </span>
            {currentUser.plan !== 'especialista' && currentUser.plan !== 'clinico' && currentUser.analysesRemaining > 0 && currentUser.analysesRemaining < 2147483647 && (
              <span style={{ fontSize: '11px', color: 'var(--g300)', fontWeight: '600' }}>
                {currentUser.analysesRemaining} análises
              </span>
            )}
            {(currentUser.plan === 'especialista' || currentUser.plan === 'clinico') && (
              <span style={{ fontSize: '11px', color: 'var(--g300)', fontWeight: '600' }}>∞</span>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
