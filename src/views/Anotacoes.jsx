import { useState, useEffect, useCallback } from 'react'
import { api } from '../services'
import AiAnalysisPanel from '../components/AiAnalysisPanel'

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const today = new Date()
  const diff = Math.floor((today - d) / 86400000)
  if (diff === 0) return 'Hoje, ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (diff === 1) return 'Ontem'
  if (diff < 7)  return `${diff} dias atrás`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDuration(secs) {
  if (!secs) return null
  return `${Math.floor(secs / 60)} min`
}

function highlight(text, query) {
  if (!query || !text) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text.slice(0, 160)
  const start = Math.max(0, idx - 60)
  const end = Math.min(text.length, idx + query.length + 100)
  const before = (start > 0 ? '…' : '') + text.slice(start, idx)
  const match = text.slice(idx, idx + query.length)
  const after = text.slice(idx + query.length, end) + (end < text.length ? '…' : '')
  return { before, match, after }
}

function Excerpt({ text, query }) {
  if (!text) return <span style={{ color: 'var(--gr3)', fontStyle: 'italic' }}>Sem anotações de texto</span>
  const h = highlight(text, query)
  if (typeof h === 'string') {
    return <span>{h.slice(0, 400)}{h.length > 400 ? '…' : ''}</span>
  }
  return (
    <span>
      {h.before}
      <mark style={{ background: 'var(--warn-l)', color: 'var(--warn)', borderRadius: '2px', padding: '0 2px' }}>{h.match}</mark>
      {h.after}
    </span>
  )
}

function AnnotationCard({ session, query, onPatientClick, onOpenCanvas, expanded, onToggle }) {
  const hasText = !!session.textContent
  const hasAi = session.hasAnalysis
  // Canvas badge only when actual canvas data exists — type alone is not enough
  const hasCanvas = session.type === 'canvas' && !!session.canvasDataJson

  return (
    <div
      style={{
        borderRadius: 'var(--r)',
        border: `1px solid ${expanded ? 'var(--g200)' : 'var(--gr2)'}`,
        background: expanded ? 'var(--w)' : 'var(--w)',
        overflow: 'hidden',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: expanded ? 'var(--sh1)' : 'none',
      }}
    >
      {/* Header row */}
      <div
        onClick={onToggle}
        style={{
          display: 'grid',
          gridTemplateColumns: '44px 1fr auto',
          gap: '12px',
          padding: '14px 16px',
          cursor: 'pointer',
          alignItems: 'flex-start',
          background: expanded ? 'var(--g50)' : '',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'var(--ow)' }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = '' }}
      >
        {/* Avatar */}
        <div
          onClick={e => { e.stopPropagation(); onPatientClick(session) }}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: session.patientAvatarBg, color: session.patientAvatarColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 700, flexShrink: 0,
            cursor: 'pointer', transition: 'opacity 0.15s',
          }}
          title={`Ver paciente ${session.patientName}`}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          {session.patientInitials}
        </div>

        {/* Content */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span
              style={{ fontSize: '14px', fontWeight: 600, color: 'var(--d)', cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); onPatientClick(session) }}
            >
              {session.patientName}
            </span>
            {session.num && (
              <span style={{ fontSize: '11px', color: 'var(--gr4)', fontFamily: "'Fraunces', serif" }}>
                Anotação {session.num}
              </span>
            )}
            {hasAi && (
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--g600)', background: 'var(--g50)', border: '1px solid var(--g100)', padding: '1px 7px', borderRadius: '20px' }}>
                IA
              </span>
            )}
            {hasCanvas && (
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#7D3C98', background: '#F0EBF8', border: '1px solid #D7BDE2', padding: '1px 7px', borderRadius: '20px' }}>
                Canvas
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--gr5)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: expanded ? 'unset' : 5, WebkitBoxOrient: 'vertical' }}>
            <Excerpt text={session.textContent} query={query} />
          </div>
        </div>

        {/* Right meta */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', color: 'var(--gr4)', whiteSpace: 'nowrap' }}>
            {fmtDate(session.finishedAt || session.createdAt)}
          </span>
          {fmtDuration(session.durationSeconds) && (
            <span style={{ fontSize: '11px', color: 'var(--gr3)' }}>{fmtDuration(session.durationSeconds)}</span>
          )}
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="var(--gr3)" strokeWidth="2"
            style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'none' }}
          >
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>

      {/* Expanded note */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--g100)', background: 'var(--ow)' }}>

          {/* Anotações da sessão */}
          <div style={{ padding: '20px 20px 0' }}>
            {hasText ? (
              <div style={{
                fontSize: '13.5px', lineHeight: '1.8', color: 'var(--d)',
                fontFamily: "'DM Sans', sans-serif",
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                background: 'var(--w)', border: '1px solid var(--gr2)',
                borderRadius: 'var(--r)', padding: '16px 20px',
                maxHeight: '320px', overflowY: 'auto',
              }}>
                {session.textContent}
              </div>
            ) : hasCanvas ? (
              <div style={{ background: 'var(--w)', borderRadius: 'var(--r)', border: '1px solid var(--gr2)', overflow: 'hidden' }}>
                {/* Preview textual do canvas */}
                {session.canvasTextContent && (
                  <div style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--gr5)', lineHeight: 1.7, borderBottom: '1px solid var(--gr1)' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#7D3C98', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '6px' }}>
                      Resumo do canvas
                    </span>
                    {session.canvasTextContent}
                  </div>
                )}
                {/* Aviso + botão abrir */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', color: 'var(--gr4)', fontSize: '12.5px' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="1.8"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
                  Sessão registrada no Canvas
                  {onOpenCanvas && (
                    <button
                      onClick={e => { e.stopPropagation(); onOpenCanvas(session) }}
                      style={{ marginLeft: 'auto', fontSize: '12px', padding: '5px 12px', borderRadius: '7px', border: '1px solid #D7BDE2', background: '#F0EBF8', color: '#7D3C98', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', transition: 'background 0.12s', flexShrink: 0 }}
                      onMouseEnter={e => e.currentTarget.style.background = '#E8D5F5'}
                      onMouseLeave={e => e.currentTarget.style.background = '#F0EBF8'}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
                      Abrir canvas
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--gr4)', fontSize: '13px', textAlign: 'center', padding: '12px' }}>
                Nenhuma anotação de texto registrada nesta sessão.
              </div>
            )}
          </div>

          {/* Painel IA — só aparece se a sessão foi analisada */}
          {hasAi && (
            <div style={{ padding: '16px 20px 0' }}>
              <AiAnalysisPanel sessionId={session.id} />
            </div>
          )}

          {/* Footer actions */}
          <div style={{ padding: '16px 20px 20px', display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onPatientClick(session)}
              style={{ fontSize: '12px', padding: '7px 14px', borderRadius: 'var(--r)', border: '1px solid var(--gr2)', background: 'var(--w)', color: 'var(--g600)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', transition: 'background 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--g50)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--w)'}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              Ir para o paciente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Anotacoes({ setCurrentView, onOpenCanvas }) {
  const [sessions, setSessions] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPatient, setFilterPatient] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  // Load patients for filter
  useEffect(() => {
    api.getPatients({ size: 100 }).then(res => setPatients(res.content || res.data || [])).catch(() => {})
  }, [])

  // Load annotations
  const load = useCallback(() => {
    setLoading(true)
    api.getRecentAnnotations({ search: debouncedSearch, patientId: filterPatient })
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [debouncedSearch, filterPatient])

  useEffect(() => { load() }, [load])

  const handlePatientClick = (session) => {
    if (setCurrentView) setCurrentView('paciente', session.patient || { id: session.patientId, name: session.patientName })
  }

  const withText = sessions.filter(s => s.textContent)
  const withoutText = sessions.filter(s => !s.textContent)
  const totalWords = sessions.reduce((acc, s) => acc + (s.textContent?.split(/\s+/).filter(Boolean).length || 0), 0)

  return (
    <div className="view">
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: '22px', fontWeight: 400, color: 'var(--d)' }}>
          Anotações
        </div>
        <div style={{ fontSize: '13px', color: 'var(--gr5)', marginTop: '4px' }}>
          {loading ? '…' : `${sessions.length} anotação${sessions.length !== 1 ? 'ões' : ''} · ${withText.length} com texto · ${totalWords.toLocaleString('pt-BR')} palavras`}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            style={{ width: '100%', paddingLeft: '36px', height: '38px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', fontSize: '13px', background: 'var(--w)', color: 'var(--d)', outline: 'none', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' }}
            placeholder="Buscar por paciente ou conteúdo…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={e => e.target.style.borderColor = 'var(--g300)'}
            onBlur={e => e.target.style.borderColor = 'var(--gr2)'}
          />
        </div>
        <select
          value={filterPatient}
          onChange={e => setFilterPatient(e.target.value)}
          style={{ height: '38px', padding: '0 12px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', fontSize: '13px', background: 'var(--w)', color: 'var(--d)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
        >
          <option value="">Todos os pacientes</option>
          {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {(search || filterPatient) && (
          <button
            onClick={() => { setSearch(''); setFilterPatient('') }}
            style={{ height: '38px', padding: '0 14px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', fontSize: '12px', background: 'var(--w)', color: 'var(--gr5)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            ✕ Limpar
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ borderRadius: 'var(--r)', border: '1px solid var(--gr2)', padding: '14px 16px', display: 'grid', gridTemplateColumns: '44px 1fr 80px', gap: '12px', alignItems: 'flex-start' }}>
              <div className="skel-pulse" style={{ width: 40, height: 40, borderRadius: '50%' }} />
              <div>
                <div className="skel-pulse" style={{ height: 14, width: '40%', borderRadius: 4, marginBottom: 8 }} />
                <div className="skel-pulse" style={{ height: 12, width: '80%', borderRadius: 4, marginBottom: 4 }} />
                <div className="skel-pulse" style={{ height: 12, width: '60%', borderRadius: 4 }} />
              </div>
              <div className="skel-pulse" style={{ height: 12, width: '100%', borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--gr2)" strokeWidth="1.2" style={{ margin: '0 auto 16px', display: 'block' }}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--d)', marginBottom: '8px' }}>
            {search || filterPatient ? 'Nenhuma anotação encontrada' : 'Nenhuma anotação registrada ainda'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--gr4)', lineHeight: 1.6, maxWidth: '320px', margin: '0 auto' }}>
            {search || filterPatient
              ? 'Tente outros termos ou remova os filtros.'
              : 'Suas anotações aparecem aqui. Comece anotando a partir de um paciente.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sessions.map(s => (
            <AnnotationCard
              key={s.id}
              session={s}
              query={debouncedSearch}
              onPatientClick={handlePatientClick}
              onOpenCanvas={onOpenCanvas}
              expanded={expandedId === s.id}
              onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
            />
          ))}

          {/* Summary footer */}
          {sessions.length >= 5 && (
            <div style={{ textAlign: 'center', padding: '16px 0 0', fontSize: '12px', color: 'var(--gr4)' }}>
              {sessions.length} anotações · {withText.length} com texto · {withoutText.length} sem texto (canvas ou sem conteúdo)
            </div>
          )}
        </div>
      )}
    </div>
  )
}
