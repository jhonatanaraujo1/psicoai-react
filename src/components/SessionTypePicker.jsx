/**
 * SessionTypePicker — modal que aparece após escolher o paciente.
 * Permite escolher entre Texto (AnnotationSession text) e Canvas (desenho).
 */
export default function SessionTypePicker({ patient, onText, onCanvas, onCancel }) {
  if (!patient) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--surface, #1e1e1e)',
          borderRadius: '16px',
          padding: '28px 24px 24px',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          border: '1px solid var(--border, #2a2a2a)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted, #888)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Nova anotação
          </p>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text, #f0f0f0)', margin: 0 }}>
            {patient.name}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted, #888)', marginTop: '4px' }}>
            Como quer registrar esta anotação?
          </p>
        </div>

        {/* Options */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          {/* Texto */}
          <button
            onClick={onText}
            style={{
              background: 'var(--surface2, #252525)',
              border: '1.5px solid var(--border, #2a2a2a)',
              borderRadius: '12px',
              padding: '20px 16px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--g500, #4A7C59)'
              e.currentTarget.style.background = 'var(--g900, #1a2e22)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border, #2a2a2a)'
              e.currentTarget.style.background = 'var(--surface2, #252525)'
            }}
          >
            <span style={{ fontSize: '24px', lineHeight: 1 }}>📝</span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text, #f0f0f0)', marginBottom: '3px' }}>
                Texto
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted, #888)', lineHeight: '1.4' }}>
                Anotações clínicas estruturadas com guia
              </div>
            </div>
          </button>

          {/* Canvas */}
          <button
            onClick={onCanvas}
            style={{
              background: 'var(--surface2, #252525)',
              border: '1.5px solid var(--border, #2a2a2a)',
              borderRadius: '12px',
              padding: '20px 16px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--g500, #4A7C59)'
              e.currentTarget.style.background = 'var(--g900, #1a2e22)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border, #2a2a2a)'
              e.currentTarget.style.background = 'var(--surface2, #252525)'
            }}
          >
            <span style={{ fontSize: '24px', lineHeight: 1 }}>🎨</span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text, #f0f0f0)', marginBottom: '3px' }}>
                Desenho
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted, #888)', lineHeight: '1.4' }}>
                Canvas livre para esboços e mapas
              </div>
            </div>
          </button>
        </div>

        {/* Cancel */}
        <button
          onClick={onCancel}
          style={{
            width: '100%',
            padding: '10px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted, #888)',
            fontSize: '13px',
            cursor: 'pointer',
            borderRadius: '8px',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text, #f0f0f0)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted, #888)'}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
