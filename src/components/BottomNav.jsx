/**
 * BottomNav.jsx — Navegação inferior para mobile (≤768px).
 * Substitui o hamburger no mobile: fica na zona de alcance do polegar,
 * nunca compete com a barra de URL do browser.
 *
 * 4 atalhos fixos + "Mais" que abre a sidebar para as demais rotas.
 */

const NAV_ITEMS = [
  {
    key: 'dashboard',
    label: 'Início',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    key: 'agenda',
    label: 'Agenda',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    key: 'pacientes',
    label: 'Pacientes',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    key: 'anotacoes',
    label: 'Notas',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
]

const MORE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)

export default function BottomNav({ currentView, setCurrentView, onMorePress, openSessionsCount, onSessionsBadgeClick }) {
  return (
    <nav className="bottom-nav" role="navigation" aria-label="Navegação principal">
      {NAV_ITEMS.map(item => {
        const isActive = currentView === item.key ||
          (item.key === 'pacientes' && currentView === 'paciente')
        return (
          <button
            key={item.key}
            className={`bn-item${isActive ? ' active' : ''}`}
            onClick={() => setCurrentView(item.key)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="bn-icon">{item.icon}</span>
            <span className="bn-label">{item.label}</span>
          </button>
        )
      })}

      {/* Badge de sessões — aparece à esquerda do "Mais" quando há sessões abertas */}
      {openSessionsCount > 0 && (
        <button
          className="bn-item"
          onClick={onSessionsBadgeClick}
          aria-label={`${openSessionsCount} sessão(ões) em andamento`}
          style={{ position: 'relative' }}
        >
          <span className="bn-icon" style={{ position: 'relative' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#FF6B2C" strokeWidth="1.8" width="22" height="22">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span style={{
              position: 'absolute', top: -4, right: -6,
              width: 16, height: 16, borderRadius: '50%',
              background: '#FF6B2C', color: '#fff',
              fontSize: '10px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--bg, #fff)',
              animation: 'pulse-dot 1.8s ease-in-out infinite',
            }}>{openSessionsCount}</span>
          </span>
          <span className="bn-label" style={{ color: '#D94F00', fontSize: '10px' }}>Sessões</span>
        </button>
      )}

      {/* Botão "Mais" — abre a sidebar com todas as rotas */}
      <button
        className="bn-item bn-more"
        onClick={onMorePress}
        aria-label="Mais opções"
      >
        <span className="bn-icon">{MORE_ICON}</span>
        <span className="bn-label">Mais</span>
      </button>
    </nav>
  )
}
