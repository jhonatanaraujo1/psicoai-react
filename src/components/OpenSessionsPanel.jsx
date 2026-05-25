/**
 * OpenSessionsPanel — painel flutuante com sessões abertas em paralelo.
 * Aparece ao clicar no badge laranja da topbar ou ao tentar iniciar
 * nova sessão enquanto existem sessões em andamento.
 */

function fmtElapsed(startedAt) {
  if (!startedAt) return null
  const secs = Math.floor((Date.now() - startedAt) / 1000)
  const m = Math.floor(secs / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}min`
  return `${m}min`
}

const TYPE_LABEL = { canvas: 'Canvas', text: 'Texto' }
const TYPE_COLOR = { canvas: '#7D3C98', text: '#2D6A4F' }
const TYPE_BG    = { canvas: '#F0EBF8', text: '#D8F3DC' }

export default function OpenSessionsPanel({
  sessions,           // [{ id, type, patient, startedAt }]
  foregroundId,       // id da sessão no foreground agora (se houver)
  onResume,           // (session) → void
  onEnd,              // (session) → void
  onStartNew,         // () → void — abre fluxo de nova sessão
  onClose,            // () → void
  anchorRef,          // ref do botão que abriu (para posicionar)
}) {
  // Fecha ao clicar fora
  const panelRef = { current: null }

  if (!sessions || sessions.length === 0) return null

  return (
    <>
      {/* Overlay invisível para capturar clique fora */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 490,
          background: 'transparent',
        }}
      />

      {/* Painel */}
      <div
        style={{
          position: 'fixed',
          top: '58px',
          right: '16px',
          zIndex: 500,
          width: '320px',
          maxWidth: 'calc(100vw - 24px)',
          background: '#fff',
          border: '1px solid #E8E5E0',
          borderRadius: '14px',
          boxShadow: '0 8px 32px rgba(28,28,28,0.14), 0 2px 8px rgba(28,28,28,0.08)',
          overflow: 'hidden',
          animation: 'slideDown 0.18s ease',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid #F0EDE8',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#1C1C1C', letterSpacing: '-0.1px' }}>
            Anotações em aberto
            <span style={{
              marginLeft: '8px',
              fontSize: '11px', fontWeight: 700,
              background: '#FF6B2C', color: '#fff',
              borderRadius: '20px', padding: '1px 7px',
            }}>{sessions.length}</span>
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B8B8B', padding: '2px', display: 'flex', alignItems: 'center' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Lista de sessões */}
        <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
          {sessions.map((s, i) => {
            const isForeground = s.id === foregroundId
            const elapsed = fmtElapsed(s.startedAt)
            const initials = s.patient?.name
              ? s.patient.name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
              : '?'

            return (
              <div
                key={s.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: i < sessions.length - 1 ? '1px solid #F5F2EC' : 'none',
                  display: 'flex', alignItems: 'center', gap: '12px',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: isForeground ? '#4A7C59' : '#E8E5E0',
                  color: isForeground ? '#fff' : '#5C5C5C',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: 700, letterSpacing: '0.3px',
                  position: 'relative',
                }}>
                  {initials}
                  {/* Pulsing dot */}
                  <span style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 9, height: 9, borderRadius: '50%',
                    background: '#FF6B2C',
                    border: '2px solid #fff',
                    animation: 'pulse-dot 1.8s ease-in-out infinite',
                  }} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#1C1C1C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.patient?.name || 'Paciente'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '20px',
                      background: TYPE_BG[s.type] || '#F5F2EC',
                      color: TYPE_COLOR[s.type] || '#5C5C5C',
                    }}>{TYPE_LABEL[s.type] || s.type}</span>
                    {elapsed && (
                      <span style={{ fontSize: '11px', color: '#8B8B8B' }}>{elapsed}</span>
                    )}
                    {isForeground && (
                      <span style={{ fontSize: '10px', color: '#4A7C59', fontWeight: 600 }}>● Em tela</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {!isForeground && (
                    <button
                      onClick={() => { onResume(s); onClose() }}
                      style={{
                        fontSize: '11px', padding: '5px 10px', borderRadius: '7px',
                        background: '#4A7C59', border: 'none', color: '#fff',
                        cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
                        transition: 'background 0.15s',
                      }}
                      onMouseOver={e => e.currentTarget.style.background = '#3D6B4A'}
                      onMouseOut={e => e.currentTarget.style.background = '#4A7C59'}
                    >
                      Retomar
                    </button>
                  )}
                  <button
                    onClick={() => onEnd(s)}
                    style={{
                      fontSize: '11px', padding: '5px 10px', borderRadius: '7px',
                      background: 'transparent', border: '1px solid #E8E5E0', color: '#8B8B8B',
                      cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                      transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = '#EF4444'; e.currentTarget.style.color = '#EF4444' }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = '#E8E5E0'; e.currentTarget.style.color = '#8B8B8B' }}
                  >
                    Encerrar
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer — iniciar nova sessão */}
        {onStartNew && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #F0EDE8' }}>
            <button
              onClick={() => { onStartNew(); onClose() }}
              style={{
                width: '100%', padding: '9px', borderRadius: '9px',
                background: '#F5F2EC', border: '1px solid #E8E5E0',
                color: '#4A7C59', fontSize: '12.5px', fontWeight: 600,
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                transition: 'background 0.15s',
              }}
              onMouseOver={e => e.currentTarget.style.background = '#ECEAE4'}
              onMouseOut={e => e.currentTarget.style.background = '#F5F2EC'}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              + Nova anotação
            </button>
          </div>
        )}
      </div>
    </>
  )
}
