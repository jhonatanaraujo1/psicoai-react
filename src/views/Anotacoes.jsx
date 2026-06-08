import { useState, useEffect, useCallback } from 'react'
import { api } from '../services'
import AiAnalysisPanel from '../components/AiAnalysisPanel'
import { CustomSelect } from '../components/DateTimePickers'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const today = new Date()
  const diff = Math.floor((today - d) / 86400000)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Ontem'
  if (diff < 7)   return `${diff}d atrás`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function fmtDur(secs) {
  if (!secs || secs < 60) return null
  const m = Math.floor(secs / 60)
  return m >= 60 ? `${Math.floor(m/60)}h${m%60 ? ` ${m%60}m` : ''}` : `${m} min`
}

const EV = {
  positive: { label: 'Evolução positiva', dot: '#27AE60', bg: '#E8F5E9', color: '#2E7D32' },
  negative: { label: 'Requer atenção',    dot: '#E74C3C', bg: '#FDECEA', color: '#B71C1C' },
  neutral:  { label: 'Descritiva',        dot: '#F39C12', bg: '#FDF3DC', color: '#7D4E00' },
}

function EvBadge({ evolution }) {
  const e = EV[evolution]
  if (!e) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: e.bg, color: e.color, flexShrink: 0 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: e.dot, display: 'inline-block', flexShrink: 0 }} />
      {e.label}
    </span>
  )
}

function highlight(text, query) {
  if (!query || !text) return { plain: text?.slice(0, 200) }
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return { plain: text.slice(0, 200) }
  const s = Math.max(0, idx - 50), e = Math.min(text.length, idx + query.length + 100)
  return { before: (s > 0 ? '…' : '') + text.slice(s, idx), match: text.slice(idx, idx + query.length), after: text.slice(idx + query.length, e) + (e < text.length ? '…' : '') }
}

// ── Card ──────────────────────────────────────────────────────────────────────

function AnotacaoCard({ s, query, onPatientClick, onOpenCanvas, expanded, onToggle }) {
  const hasAi      = s.hasAnalysis
  const isCanvas   = s.type === 'canvas'
  const ev         = EV[s.evolution]
  const preview    = s.summary || s.notePreview || s.textContent?.slice(0, 160) || s.canvasTextContent?.slice(0, 160)
  const hl         = highlight(preview, query)
  const dur        = fmtDur(s.durationSeconds)

  return (
    <div style={{
      borderRadius: 12, border: `1px solid ${expanded ? 'var(--g200)' : 'var(--gr2)'}`,
      background: 'var(--w)', overflow: 'hidden',
      boxShadow: expanded ? 'var(--sh1)' : 'none',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }}>

      {/* ── Header row — sempre visível ── */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', gap: 12, padding: '14px 16px',
          cursor: 'pointer', alignItems: 'flex-start',
          background: expanded ? '#F7FBF8' : 'var(--w)',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'var(--ow)' }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'var(--w)' }}
      >
        {/* Avatar */}
        <div
          onClick={e => { e.stopPropagation(); onPatientClick(s) }}
          style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: s.patientAvatarBg || 'var(--g50)',
            color: s.patientAvatarColor || 'var(--g600)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            transition: 'opacity 0.15s', marginTop: 2,
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.72'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          title={`Abrir paciente ${s.patientName}`}
        >
          {s.patientInitials || s.patientName?.slice(0, 2).toUpperCase()}
        </div>

        {/* Corpo central */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Linha 1: nome · sessão · tipo · duração · data */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: 5 }}>
            <span
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--d)', cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); onPatientClick(s) }}
            >
              {s.patientName}
            </span>
            {s.num && (
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gr4)', fontFamily: "'Fraunces', serif" }}>
                {s.num}
              </span>
            )}
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20, letterSpacing: '0.5px',
              background: 'rgba(74,124,89,0.08)', color: 'var(--g600)', border: '1px solid var(--g100)',
            }}>
              ANOTAÇÃO
            </span>
            {hasAi && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20, letterSpacing: '0.5px', background: '#EBF4EE', color: 'var(--g700)', border: '1px solid var(--g100)' }}>
                IA ✓
              </span>
            )}
            <span style={{ fontSize: 11, color: 'var(--gr4)', marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {fmtDate(s.sessionDate || s.finishedAt || s.updatedAt || s.createdAt)}
              {dur && <span style={{ color: 'var(--gr3)' }}> · {dur}</span>}
            </span>
          </div>

          {/* Linha 2: preview — resumo IA ou trecho do texto */}
          <div style={{ fontSize: 12.5, color: hasAi && s.summary ? 'var(--d2)' : 'var(--gr5)', lineHeight: 1.55, marginBottom: 6 }}>
            {hasAi && s.summary ? (
              <span style={{ fontStyle: 'italic' }}>"{s.summary.slice(0, 180)}{s.summary.length > 180 ? '…' : ''}"</span>
            ) : preview ? (
              hl.match
                ? <span>{hl.before}<mark style={{ background: 'var(--warn-l)', color: 'var(--warn)', borderRadius: 2, padding: '0 2px' }}>{hl.match}</mark>{hl.after}</span>
                : <span>{hl.plain}{hl.plain?.length === 200 ? '…' : ''}</span>
            ) : (
              <span style={{ color: 'var(--gr3)', fontStyle: 'italic' }}>
                {isCanvas ? 'Anotação registrada em canvas' : 'Sem conteúdo de texto'}
              </span>
            )}
          </div>

          {/* Linha 3: metadados + evolução */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            {s.evolution && <EvBadge evolution={s.evolution} />}
            {s.wordCount > 0 && (
              <span style={{ fontSize: 10, color: 'var(--gr4)' }}>
                {s.wordCount.toLocaleString('pt-BR')} palavras
              </span>
            )}
            {!hasAi && (
              <span style={{ fontSize: 10, color: 'var(--gr3)' }}>Sem análise IA</span>
            )}
          </div>
        </div>

        {/* Seta expand */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gr3)" strokeWidth="2"
          style={{ flexShrink: 0, marginTop: 14, transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'none' }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>

      {/* ── Expanded ── */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--g100)', background: 'var(--ow)' }}>

          {/* Conteúdo completo */}
          <div style={{ padding: '18px 20px 0' }}>
            {s.textContent ? (
              <div style={{
                fontSize: 13.5, lineHeight: 1.85, color: 'var(--d)',
                background: 'var(--w)', border: '1px solid var(--gr2)',
                borderRadius: 10, padding: '16px 20px',
                maxHeight: 340, overflowY: 'auto',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {s.textContent}
              </div>
            ) : isCanvas ? (
              <div style={{ background: 'var(--w)', borderRadius: 10, border: '1px solid var(--gr2)', overflow: 'hidden' }}>
                {s.canvasTextContent && (
                  <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--gr5)', lineHeight: 1.7, borderBottom: '1px solid var(--gr1)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#7D3C98', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Conteúdo do canvas</div>
                    {s.canvasTextContent}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', color: 'var(--gr4)', fontSize: 12 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
                  Anotação registrada em canvas
                  {onOpenCanvas && (
                    <button
                      onClick={e => { e.stopPropagation(); onOpenCanvas(s) }}
                      style={{ marginLeft: 'auto', fontSize: 12, padding: '5px 12px', borderRadius: 7, border: '1px solid #D7BDE2', background: '#F0EBF8', color: '#7D3C98', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}
                    >
                      Abrir canvas →
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--gr4)', fontSize: 13, textAlign: 'center', padding: '12px' }}>
                Nenhum conteúdo de texto nesta anotação.
              </div>
            )}
          </div>

          {/* Análise IA */}
          {hasAi && (
            <div style={{ padding: '16px 20px 0' }}>
              <AiAnalysisPanel sessionId={s.id} />
            </div>
          )}

          {/* Ações */}
          <div style={{ padding: '14px 20px 18px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => onPatientClick(s)}
              style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--gr2)', background: 'var(--w)', color: 'var(--g600)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              Ver paciente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Stats chip ────────────────────────────────────────────────────────────────

function StatChip({ label, value, color }) {
  return (
    <div style={{ background: 'var(--w)', border: '1px solid var(--gr2)', borderRadius: 10, padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 120px' }}>
      <span style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: color || 'var(--d)', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 11, color: 'var(--gr5)' }}>{label}</span>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function Anotacoes({ setCurrentView, onOpenCanvas }) {
  const [sessions,       setSessions]       = useState([])
  const [patients,       setPatients]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [filterPatient,  setFilterPatient]  = useState('')
  const [filterEv,       setFilterEv]       = useState('')   // '' | 'positive' | 'neutral' | 'negative'
  const [expandedId,     setExpandedId]     = useState(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    api.getPatients({ size: 100 }).then(res => setPatients(res.content || res.data || [])).catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    api.getRecentAnnotations({ search: debouncedSearch, patientId: filterPatient })
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [debouncedSearch, filterPatient])

  useEffect(() => { load() }, [load])

  const handlePatientClick = (s) => {
    if (setCurrentView) setCurrentView('paciente', s.patient || { id: s.patientId, name: s.patientName })
  }

  // Stats
  const afterSearch  = debouncedSearch
    ? sessions.filter(s =>
        s.patientName?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        s.notePreview?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        s.canvasTextContent?.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : sessions
  const displayed    = filterEv ? afterSearch.filter(s => s.evolution === filterEv) : afterSearch
  const withAi       = afterSearch.filter(s => s.hasAnalysis).length
  const positive     = afterSearch.filter(s => s.evolution === 'positive').length
  const needsAttn    = afterSearch.filter(s => s.evolution === 'negative').length
  const totalWords   = afterSearch.reduce((a, s) => a + (s.wordCount || 0), 0)

  const EV_FILTERS = [
    { key: '',         label: 'Todas' },
    { key: 'positive', label: '● Positivas',   color: '#27AE60' },
    { key: 'neutral',  label: '● Descritivas', color: '#F39C12' },
    { key: 'negative', label: '● Atenção',     color: '#E74C3C' },
  ]

  return (
    <div className="view">

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 400, color: 'var(--d)' }}>Anotações</div>
        <div style={{ fontSize: 13, color: 'var(--gr5)', marginTop: 4 }}>
          {loading ? '…' : `${sessions.length} sess${sessions.length !== 1 ? 'ões' : 'ão'} registrada${sessions.length !== 1 ? 's' : ''}`}
        </div>
      </div>

      {/* Stats strip */}
      {!loading && sessions.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <StatChip label="Total" value={sessions.length} />
          <StatChip label="Com análise IA" value={withAi} color="var(--g600)" />
          <StatChip label="Evolução positiva" value={positive} color="#27AE60" />
          <StatChip label="Requer atenção" value={needsAttn} color="#E74C3C" />
          <StatChip label="Palavras registradas" value={totalWords > 0 ? totalWords.toLocaleString('pt-BR') : '—'} color="var(--gr5)" />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            style={{ width: '100%', paddingLeft: 36, height: 38, border: '1px solid var(--gr2)', borderRadius: 'var(--r)', fontSize: 13, background: 'var(--w)', color: 'var(--d)', outline: 'none', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' }}
            placeholder="Buscar por paciente ou conteúdo…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={e => e.target.style.borderColor = 'var(--g300)'}
            onBlur={e => e.target.style.borderColor = 'var(--gr2)'}
          />
        </div>

        {/* Patient filter */}
        <div style={{ flexShrink: 0, minWidth: 180 }}>
          <CustomSelect
            value={filterPatient}
            onChange={v => setFilterPatient(v)}
            options={[{ label: 'Todos os pacientes', value: '' }, ...patients.map(p => ({ label: p.name, value: p.id }))]}
            placeholder="Todos os pacientes"
          />
        </div>

        {/* Evolução filter pills */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {EV_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilterEv(f.key)}
              style={{
                height: 34, padding: '0 12px', borderRadius: 20,
                border: `1.5px solid ${filterEv === f.key ? 'var(--g400)' : 'var(--gr2)'}`,
                background: filterEv === f.key ? 'var(--g50)' : 'var(--w)',
                color: f.color || (filterEv === f.key ? 'var(--g700)' : 'var(--gr5)'),
                cursor: 'pointer', fontSize: 12, fontWeight: filterEv === f.key ? 700 : 400,
                fontFamily: "'DM Sans', sans-serif", transition: 'all 0.12s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {(search || filterPatient || filterEv) && (
          <button
            onClick={() => { setSearch(''); setFilterPatient(''); setFilterEv('') }}
            style={{ height: 34, padding: '0 12px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', fontSize: 12, background: 'var(--w)', color: 'var(--gr5)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}
          >
            ✕ Limpar
          </button>
        )}
      </div>

      {/* List — agrupado por data */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ borderRadius: 12, border: '1px solid var(--gr2)', padding: '14px 16px', display: 'flex', gap: 12 }}>
              <div className="skel-pulse" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skel-pulse" style={{ height: 14, width: '40%', borderRadius: 4, marginBottom: 8 }} />
                <div className="skel-pulse" style={{ height: 12, width: '85%', borderRadius: 4, marginBottom: 6 }} />
                <div className="skel-pulse" style={{ height: 10, width: '30%', borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--gr2)" strokeWidth="1.2" style={{ margin: '0 auto 14px', display: 'block' }}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--d)', marginBottom: 6 }}>
            {search || filterPatient || filterEv ? 'Nenhuma anotação encontrada' : 'Nenhuma anotação ainda'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--gr4)', lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>
            {search || filterPatient || filterEv ? 'Tente outros filtros.' : 'Suas anotações aparecem aqui após salvar uma anotação.'}
          </div>
        </div>
      ) : (() => {
          // Agrupa por data (YYYY-MM-DD) usando finishedAt → updatedAt → createdAt
          const today     = new Date(); today.setHours(0,0,0,0)
          const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)

          const dayKey = (iso) => {
            if (!iso) return 'sem-data'
            return new Date(iso).toISOString().slice(0, 10)
          }
          const dayLabel = (key) => {
            if (key === 'sem-data') return 'Sem data'
            const d = new Date(key + 'T12:00:00')
            d.setHours(0,0,0,0)
            if (d.getTime() === today.getTime())     return 'Hoje'
            if (d.getTime() === yesterday.getTime()) return 'Ontem'
            const diff = Math.floor((today - d) / 86400000)
            if (diff < 7) return d.toLocaleDateString('pt-BR', { weekday: 'long' })
            return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
          }

          // Monta mapa ordenado de grupos
          // sessionDate é a data clínica definida pelo psicólogo (pode diferir de finishedAt)
          // Prioridade: sessionDate > finishedAt > updatedAt > createdAt
          const grouped = new Map()
          displayed.forEach(s => {
            const k = dayKey(s.sessionDate || s.finishedAt || s.updatedAt || s.createdAt)
            if (!grouped.has(k)) grouped.set(k, [])
            grouped.get(k).push(s)
          })
          // Ordena datas mais recentes primeiro
          const sortedKeys = [...grouped.keys()].sort((a, b) => b.localeCompare(a))

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {sortedKeys.map(key => {
                const group = grouped.get(key)
                const label = dayLabel(key)
                return (
                  <div key={key}>
                    {/* Separador de data */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: 'var(--g700)',
                        background: 'var(--g50)', border: '1px solid var(--g100)',
                        padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap',
                        letterSpacing: '0.2px',
                      }}>
                        {label}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--gr4)' }}>
                        {group.length} anotaç{group.length !== 1 ? 'ões' : 'ão'}
                      </span>
                      <div style={{ flex: 1, height: 1, background: 'var(--gr2)' }} />
                    </div>

                    {/* Cards do dia */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {group.map(s => (
                        <AnotacaoCard
                          key={s.id}
                          s={s}
                          query={debouncedSearch}
                          onPatientClick={handlePatientClick}
                          onOpenCanvas={onOpenCanvas}
                          expanded={expandedId === s.id}
                          onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()
      }
    </div>
  )
}
