import { useState, useEffect } from 'react'
import { api } from '../services'

// ── helpers ────────────────────────────────────────────────────────────────────

function fmtRelative(ms) {
  if (!ms) return null
  const diff = Date.now() - ms
  const min  = Math.floor(diff / 60000)
  const hr   = Math.floor(diff / 3600000)
  const d    = Math.floor(diff / 86400000)
  if (min < 1)  return 'Agora mesmo'
  if (min < 60) return `${min} min atrás`
  if (hr  < 24) return `${hr}h atrás`
  if (d   < 7)  return `${d} dia${d > 1 ? 's' : ''} atrás`
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function getInitials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

const AVATAR_COLORS = [
  { bg: '#E8F5E9', fg: '#2E7D32' }, { bg: '#E3F2FD', fg: '#1565C0' },
  { bg: '#F3E5F5', fg: '#6A1B9A' }, { bg: '#FFF3E0', fg: '#E65100' },
  { bg: '#FCE4EC', fg: '#880E4F' }, { bg: '#E0F2F1', fg: '#004D40' },
  { bg: '#FFF8E1', fg: '#F57F17' }, { bg: '#EDE7F6', fg: '#4527A0' },
]
function avatarColor(id = '') {
  const idx = Math.abs(id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

// Lê dados do canvas do localStorage para um patientId.
// Retorna null se não houver nenhuma página ainda.
function readCanvasData(patientId) {
  try {
    const raw = localStorage.getItem(`psicoai_canvas2_p${patientId}`)
    if (!raw) return null
    const pages = JSON.parse(raw)
    if (!Array.isArray(pages) || pages.length === 0) return null
    const lastModified = pages.reduce((max, p) => {
      const t = p.updatedAt || p.createdAt || 0
      return t > max ? t : max
    }, 0)
    const textPages = pages.filter(p => p.type === 'text').length
    const drawPages = pages.filter(p => p.type === 'draw' || p.type === 'drawing').length
    return { pageCount: pages.length, textPages, drawPages, lastModified }
  } catch { return null }
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
      {[1,2,3,4,5,6,7,8].map(i => (
        <div key={i} style={{ borderRadius: '12px', border: '1px solid var(--gr2)', padding: '16px', background: 'var(--w)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div className="skel-pulse" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skel-pulse" style={{ height: 13, width: '60%', borderRadius: 4, marginBottom: 5 }} />
              <div className="skel-pulse" style={{ height: 10, width: '35%', borderRadius: 4 }} />
            </div>
          </div>
          <div className="skel-pulse" style={{ height: 10, width: '55%', borderRadius: 4 }} />
        </div>
      ))}
    </div>
  )
}

// ── Card ───────────────────────────────────────────────────────────────────────

function CadernoCard({ patient, canvas, onOpen, onOpenPatient }) {
  const [hovered, setHovered] = useState(false)
  const _col = avatarColor(patient.id)
  const col = { bg: patient.avatarBg || _col.bg, fg: patient.avatarColor || _col.fg }
  const isEmpty = !canvas
  const sessionCount = patient.sessions ?? 0
  // Paciente que só tem anotações no prontuário (sem canvas local) → ir ao prontuário
  const prontuarioOnly = isEmpty && sessionCount > 0

  // Sub-label: última edição canvas, ou contagem de sessões backend, ou vazio
  const subLabel = !isEmpty
    ? fmtRelative(canvas.lastModified) || 'Editado recentemente'
    : sessionCount > 0
      ? `${sessionCount} sessão${sessionCount !== 1 ? 'ões' : ''} · toque para anotar`
      : 'Toque para iniciar a primeira anotação'

  // Sempre abre a anotação/canvas — nunca vai para o perfil a partir daqui
  const handleClick = () => onOpen(patient)

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', gap: '12px',
        padding: '16px', borderRadius: '12px', textAlign: 'left',
        border: `1px solid ${hovered ? 'var(--g300)' : (isEmpty && !sessionCount ? 'var(--gr1)' : 'var(--gr2)')}`,
        background: hovered ? 'var(--g50)' : 'var(--w)',
        boxShadow: hovered ? 'var(--sh1)' : 'none',
        cursor: 'pointer', transition: 'all 0.15s',
        fontFamily: "'DM Sans', sans-serif",
        opacity: isEmpty && !sessionCount ? 0.65 : 1,
      }}
    >
      {/* Patient row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: col.bg, color: col.fg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 700,
        }}>
          {getInitials(patient.name)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--d)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {patient.name}
          </div>
          <div style={{ fontSize: '11px', color: isEmpty && sessionCount > 0 ? 'var(--gr5)' : 'var(--gr4)', marginTop: '2px' }}>
            {subLabel}
          </div>
        </div>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gr3)" strokeWidth="2"
          style={{ flexShrink: 0, opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>

      {/* Stats — só aparece quando há páginas */}
      {!isEmpty && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
            background: 'var(--g50)', color: 'var(--g600)',
            border: '1px solid var(--g100)', fontWeight: 600,
          }}>
            {canvas.pageCount} {canvas.pageCount === 1 ? 'página' : 'páginas'}
          </span>
          {canvas.textPages > 0 && (
            <span style={{
              fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
              background: '#F0F4FF', color: '#3B5BDB', border: '1px solid #D0D9FF',
            }}>
              {canvas.textPages}T
            </span>
          )}
          {canvas.drawPages > 0 && (
            <span style={{
              fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
              background: '#F5F0FF', color: '#7950F2', border: '1px solid #DDD0FF',
            }}>
              {canvas.drawPages}D
            </span>
          )}
        </div>
      )}
    </button>
  )
}

// ── Main view ──────────────────────────────────────────────────────────────────

export default function Cadernos({ onOpenCanvas, onOpenPatient }) {
  const [patients, setPatients] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState('all') // 'all' | 'com-notas' | 'sem-notas'

  useEffect(() => {
    api.getPatients({ size: 200 })
      .then(res => setPatients(res.content || res.data || []))
      .catch(() => setPatients([]))
      .finally(() => setLoading(false))
  }, [])

  // Enriquece cada paciente com dados do localStorage
  const enriched = patients.map(p => ({ patient: p, canvas: readCanvasData(p.id) }))

  // "com anotações" = tem canvas local OU tem sessões no backend
  const hasNotes = ({ canvas, patient }) => !!canvas || (patient.sessions ?? 0) > 0

  // Ordena: primeiro quem tem páginas (por lastModified desc), depois os sem notas (alfabético)
  const sorted = [
    ...enriched.filter(c => c.canvas).sort((a, b) => (b.canvas.lastModified || 0) - (a.canvas.lastModified || 0)),
    ...enriched.filter(c => !c.canvas).sort((a, b) => a.patient.name.localeCompare(b.patient.name, 'pt-BR')),
  ]

  // Aplica filtros — usa mesma lógica do contador acima
  const afterFilter = filter === 'com-notas'
    ? sorted.filter(hasNotes)
    : filter === 'sem-notas'
      ? sorted.filter(c => !hasNotes(c))
      : sorted

  const afterSearch = search.trim()
    ? afterFilter.filter(c => c.patient.name.toLowerCase().includes(search.toLowerCase()))
    : afterFilter

  const comNotas   = enriched.filter(hasNotes).length
  const semNotas   = enriched.filter(c => !hasNotes(c)).length
  const totalPages = enriched.reduce((a, c) => a + (c.canvas?.pageCount || 0), 0)

  return (
    <div className="view">
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: '22px', fontWeight: 400, color: 'var(--d)' }}>
          Anotações
        </div>
        <div style={{ fontSize: '13px', color: 'var(--gr5)', marginTop: '4px' }}>
          {loading
            ? '…'
            : `${patients.length} ${patients.length !== 1 ? 'pacientes' : 'paciente'} · ${comNotas} com anotações · ${totalPages} ${totalPages !== 1 ? 'páginas' : 'página'}`}
        </div>
      </div>

      {/* Toolbar */}
      {!loading && patients.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '320px' }}>
            <svg style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar paciente…"
              style={{
                width: '100%', paddingLeft: '34px', height: '36px',
                border: '1px solid var(--gr2)', borderRadius: '10px',
                fontSize: '13px', background: 'var(--w)', color: 'var(--d)',
                outline: 'none', fontFamily: "'DM Sans', sans-serif",
                boxSizing: 'border-box', transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--g300)'}
              onBlur={e => e.target.style.borderColor = 'var(--gr2)'}
            />
          </div>

          {/* Filter pills */}
          {(['all', 'com-notas', 'sem-notas']).map(f => {
            const labels = { all: 'Todos', 'com-notas': `Com anotações (${comNotas})`, 'sem-notas': `Sem anotações (${semNotas})` }
            const active = filter === f
            return (
              <button key={f} onClick={() => setFilter(f)} style={{
                height: '36px', padding: '0 14px', borderRadius: '20px', cursor: 'pointer',
                fontSize: '12px', fontWeight: active ? 600 : 400, fontFamily: "'DM Sans', sans-serif",
                border: `1px solid ${active ? 'var(--g300)' : 'var(--gr2)'}`,
                background: active ? 'var(--g50)' : 'var(--w)',
                color: active ? 'var(--g600)' : 'var(--gr5)',
                transition: 'all 0.12s',
              }}>
                {labels[f]}
              </button>
            )
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <Skeleton />
      ) : patients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gr2)" strokeWidth="1.2" style={{ margin: '0 auto 16px', display: 'block' }}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
          </svg>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--d)', marginBottom: '8px' }}>
            Nenhum paciente cadastrado
          </div>
          <div style={{ fontSize: '13px', color: 'var(--gr4)', lineHeight: 1.6 }}>
            Cadastre um paciente em "Meus pacientes" para começar a anotar.
          </div>
        </div>
      ) : afterSearch.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', fontSize: '13px', color: 'var(--gr4)' }}>
          Nenhum resultado para "{search}".
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
          {afterSearch.map(({ patient, canvas }) => (
            <CadernoCard
              key={patient.id}
              patient={patient}
              canvas={canvas}
              onOpen={onOpenCanvas}
              onOpenPatient={onOpenPatient}
            />
          ))}
        </div>
      )}
    </div>
  )
}
