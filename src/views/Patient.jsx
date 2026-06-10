import { useState, useEffect } from 'react'
import { api } from '../services'
import { showToast } from '../components/Toast'
import PatientFormModal from '../components/PatientFormModal'
import ReportModal from '../components/ReportModal'
import DocumentsPanel from '../components/DocumentsPanel'
import AiAnalysisPanel from '../components/AiAnalysisPanel'

function fmtDuration(secs) {
  if (!secs) return '—'
  const m = Math.floor(secs / 60)
  return `${m} min`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtMonthDay(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

const EV_COLORS = { green: '#27AE60', yellow: '#F39C12', red: '#E74C3C', current: 'var(--g500)' }

function parseJson(raw, fallback = []) {
  if (!raw) return fallback
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw) } catch { return fallback }
}

function Skeleton({ style }) {
  return <div className="skel-pulse" style={{ borderRadius: '6px', background: 'var(--gr2)', ...style }} />
}

const btnSt = { padding: '7px 14px', borderRadius: 'var(--r)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }

// ── Badge class mapping ────────────────────────────────────────────────────────
const STATUS_BADGE = {
  red:    'badge-danger',
  yellow: 'badge-warn',
  green:  'badge-green',
  gray:   'badge-gray',
}

export default function Patient({ patient: propPatient, setCurrentView, onSessao, onReopenSession, onViewProntuario, onSyncAgenda }) {
  const [summary, setSummary] = useState(null)
  const [sessions, setSessions] = useState([])
  const [forms, setForms] = useState([])
  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [sessionDeleteId, setSessionDeleteId] = useState(null)
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [sessionsExpanded, setSessionsExpanded] = useState(false)

  const SESSIONS_DEFAULT = 8

  const patientId = propPatient?.id

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  async function handleExportProntuario() {
    setExportingPdf(true)
    try {
      const blob = await api.exportProntuarioPdf(patientId)
      downloadBlob(blob, `prontuario-${(p?.name || 'paciente').replace(/\s+/g, '_')}.pdf`)
    } catch (e) { showToast('Erro ao gerar PDF: ' + (e.message || 'Tente novamente'), 'error') }
    finally { setExportingPdf(false) }
  }

  const load = () => {
    if (!patientId) return
    setLoading(true)
    setError(null)
    Promise.all([
      api.getPatientSummary(patientId),
      api.getPatientSessions(patientId, { size: 200 }),
      api.getPatientForms(patientId),
      api.getPatientAnalyses(patientId),
    ]).then(([sum, sess, frms, als]) => {
      setSummary(sum)
      const sorted = (sess.content || []).sort((a, b) => {
        const da = new Date(a.sessionDate || a.createdAt || 0)
        const db = new Date(b.sessionDate || b.createdAt || 0)
        return db - da
      })
      setSessions(sorted)
      setForms(frms?.content || frms || [])
      setAnalyses(als.content || [])
      setNotes((sum?.patient?.notes) || (propPatient?.notes) || '')
    })
    .catch(e => {
      // Se paciente não existe (ID de mock ou deletado), volta para lista
      if (e.message?.includes('não encontrado') || e.message?.includes('404') || e.message?.includes('inválido')) {
        try { sessionStorage.removeItem('psicoai_nav_patient'); sessionStorage.removeItem('psicoai_nav_view') } catch {}
        if (setCurrentView) setCurrentView('pacientes')
        return
      }
      setError(e.message || 'Erro ao carregar paciente')
    })
    .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [patientId])

  const p = summary?.patient || propPatient
  if (!p && !loading && !error) return null

  // Build timeline from sessions
  const timelineDots = sessions.map((s, i) => {
    const num = s.num ?? (i + 1)
    return {
      evolution: s.evolution,
      date: fmtMonthDay(s.finishedAt || s.createdAt),
      num,
      tip: `Anotação ${num} — ${s.statusLabel || 'Finalizada'}\n${s.summary?.slice(0, 60) || ''}`,
      isOpen: s.status === 'open',
    }
  })

  const formBadge = {
    answered: { bg: 'var(--g50)', color: 'var(--g600)', label: '✓ Preenchido' },
    pending:  { bg: 'var(--warn-l)', color: 'var(--warn)', label: '⏳ Pendente' },
    expired:  { bg: 'var(--gr1)', color: 'var(--gr4)', label: 'Expirado' },
  }

  const badgeStyle = (statusLabel) => ({
    'Alerta IA':  { bg: 'var(--danger-l)', color: 'var(--danger)' },
    'Alerta':     { bg: 'var(--danger-l)', color: 'var(--danger)' },
    'Crise':      { bg: 'var(--danger-l)', color: 'var(--danger)' },
    'Regressão':  { bg: 'var(--danger-l)', color: 'var(--danger)' },
    'Neutro':     { bg: 'var(--gr1)',       color: 'var(--gr5)'  },
    'Monitorar':  { bg: 'var(--gr1)',       color: 'var(--gr5)'  },
    'Evolução':   { bg: 'var(--g50)',       color: 'var(--g600)' },
    'Aberta':     { bg: '#EBF3FD',          color: '#2980B9'     },
  }[statusLabel] || { bg: 'var(--gr1)', color: 'var(--gr5)' })

  const hasAnalysis = analyses.length > 0

  if (error) return (
    <div className="view" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 16, textAlign: 'center' }}>
      <button className="btn-back" onClick={() => setCurrentView('pacientes')} style={{ alignSelf: 'flex-start' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        Voltar
      </button>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="1.4" style={{ opacity: 0.7 }}>
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <div style={{ fontSize: 14, color: 'var(--d)', fontWeight: 500 }}>Não foi possível carregar o paciente</div>
      <div style={{ fontSize: 12, color: 'var(--gr5)' }}>{error}</div>
      <button className="btn-primary" onClick={load}>Tentar novamente</button>
    </div>
  )

  return (
    <>
    <div className="view">
      <button className="btn-back" onClick={() => setCurrentView('pacientes')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        Voltar a Pacientes
      </button>

      {/* Header */}
      {loading ? (
        <div className="patient-header">
          <Skeleton style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <Skeleton style={{ height: 26, width: '40%', marginBottom: 10 }} />
            <Skeleton style={{ height: 14, width: '60%', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 16 }}>
              {[1,2,3,4].map(i => <Skeleton key={i} style={{ height: 48, width: 80 }} />)}
            </div>
          </div>
        </div>
      ) : (
        <div className="patient-header">
          <div className="pat-av-lg" style={{ background: p.avatarBg, color: p.avatarColor }}>{p.initials}</div>
          <div className="pat-info">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div className="pat-name">{p.name}</div>
                <div className="pat-meta">
                  {p.age && <><span className="pat-tag">{p.age} anos</span><span style={{ color: 'var(--gr2)' }}>·</span></>}
                  {p.gender && <><span className="pat-tag">{p.gender}</span><span style={{ color: 'var(--gr2)' }}>·</span></>}
                  <span className="pat-tag">Em acompanhamento há {p.months || 0} meses</span>
                  {p.cid && <span className="pat-cid">{p.cid} (hipótese)</span>}
                  <span className={`card-badge ${STATUS_BADGE[p.status] || 'badge-gray'}`}>{p.statusLabel}</span>
                </div>
              </div>
              <div className="pat-header-actions">
                <button className="btn-outline" onClick={() => setEditOpen(true)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Editar
                </button>
                <button
                  className="btn-outline"
                  onClick={handleExportProntuario}
                  disabled={exportingPdf}
                  title="Exportar prontuário completo em PDF"
                >
                  {exportingPdf
                    ? <span style={{ width: 11, height: 11, borderRadius: '50%', border: '1.5px solid var(--gr4)', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  }
                  {exportingPdf ? 'Gerando…' : 'Exportar PDF'}
                </button>
                {/* Arquivar / Reativar */}
                {p.active === false ? (
                  <button
                    onClick={async () => {
                      await api.updatePatient(patientId, { active: true })
                      api.getPatientSummary(patientId).then(setSummary)
                      showToast('Paciente reativado', 'success')
                    }}
                    style={{ ...btnSt, background: 'var(--g50)', color: 'var(--g700)', border: '1.5px solid var(--g300)' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                    Reativar
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      await api.updatePatient(patientId, { active: false })
                      api.getPatientSummary(patientId).then(setSummary)
                      showToast('Paciente arquivado', 'info')
                    }}
                    style={{ ...btnSt, background: 'var(--warn-l)', color: 'var(--warn)', border: '1px solid rgba(200,134,10,0.3)' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                    Arquivar
                  </button>
                )}
                <button onClick={() => setDeleteConfirm(true)} style={{ ...btnSt, background: 'var(--danger-l)', color: 'var(--danger)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  Excluir
                </button>
                {p.active !== false && (
                  <button className="btn-primary" onClick={onSessao}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    Anotar
                  </button>
                )}
                {p.active === false && (
                  <div style={{ fontSize: 11, color: 'var(--warn)', background: 'var(--warn-l)', border: '1px solid rgba(200,134,10,0.25)', borderRadius: 20, padding: '4px 10px', fontWeight: 600 }}>
                    Paciente inativo
                  </div>
                )}
              </div>
            </div>
            <div className="pat-stats">
              <div className="pat-stat">
                <div className="pat-stat-val">{summary?.sessionCount || p.sessions}</div>
                <div className="pat-stat-label">Anotações</div>
              </div>
              <div className="pat-stat">
                <div className="pat-stat-val">{p.months || 0}</div>
                <div className="pat-stat-label">Meses</div>
              </div>
              <div className="pat-stat">
                <div className="pat-stat-val" style={{ color: summary?.activeAlerts > 0 ? 'var(--danger)' : 'var(--gr4)' }}>
                  {summary?.activeAlerts ?? '—'}
                </div>
                <div className="pat-stat-label">Alertas ativos</div>
              </div>
              <div className="pat-stat">
                <div className="pat-stat-val" style={{ color: hasAnalysis ? 'var(--g600)' : 'var(--gr4)' }}>
                  {hasAnalysis ? '✓ IA' : '— IA'}
                </div>
                <div className="pat-stat-label">Análise IA</div>
              </div>
            </div>
            {deleteConfirm && (
              <div style={{ background: 'var(--danger-l)', border: '1px solid #E8B4B0', borderRadius: 'var(--r)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--danger)', flex: 1 }}>Excluir {summary?.patient?.name || propPatient?.name}? Esta ação não pode ser desfeita.</span>
                <button onClick={() => setDeleteConfirm(false)} style={{ ...btnSt, background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)' }}>Cancelar</button>
                <button onClick={async () => { await api.deletePatient(patientId); setCurrentView('pacientes') }} style={{ ...btnSt, background: 'var(--danger)', color: '#fff' }}>Confirmar exclusão</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline — cronologia simples, sem avaliação de evolução */}
      {timelineDots.length > 0 && !loading && (
        <div className="timeline-wrap">
          <div className="timeline-label">Linha do Tempo das Anotações</div>
          <div className="timeline-track">
            <div className="timeline-line" />
            <div className="timeline-dots">
              {timelineDots.map((d, i) => (
                <div key={i} className={`tl-dot${d.isOpen ? ' current' : ''}`}>
                  <div className="tl-dot-circle" />
                  <div className="tl-dot-date">{d.date}</div>
                  <div className="tl-dot-num">{d.num}</div>
                  <div className="tl-tooltip">{d.tip}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sessions table */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Histórico de Anotações</div>
            <div className="card-sub">{sessions.length === 1 ? '1 caderno · clique para abrir' : `${sessions.length} cadernos · clique para abrir`}</div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {onViewProntuario && (
              <button style={{ ...btnSt, fontSize: '12px', padding: '7px 14px', background: 'var(--w)', color: 'var(--gr5)', border: '1px solid var(--gr2)' }} onClick={onViewProntuario} title="Ver anotações em formato A4">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Prontuário
              </button>
            )}
            <button className="btn-primary" onClick={onSessao} style={{ fontSize: '12px', padding: '7px 14px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Anotar
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '20px' }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
                <Skeleton style={{ width: 40, height: 14 }} />
                <Skeleton style={{ flex: 1, height: 14 }} />
                <Skeleton style={{ width: 70, height: 14 }} />
                <Skeleton style={{ width: 60, height: 22, borderRadius: 20 }} />
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: 'var(--gr4)' }}>Nenhuma anotação registrada ainda.</div>
          </div>
        ) : (
          <div className="sess-tbl-outer">
            {/* Colunas: Nº · Tipo · Resumo · Criado · Última alteração · Status · ações */}
            <div className="sess-tbl-hdr" style={{ display: 'grid', gridTemplateColumns: '52px 86px 1fr 88px 110px 110px 28px', columnGap: '12px', borderBottom: '2px solid var(--gr2)', padding: '8px 20px', background: 'var(--ow)' }}>
              {['Nº', 'Tipo', 'Resumo / Anotações', 'Criado', 'Última alt.', 'Status', ''].map((h, i) => (
                <div key={i} style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--gr4)' }}>{h}</div>
              ))}
            </div>
            {/* Lista com scroll — sempre ativo */}
            <div style={{
              maxHeight: sessionsExpanded ? 640 : 420,
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              scrollbarWidth: 'thin', scrollbarColor: 'var(--gr2) transparent',
              scrollBehavior: 'smooth',
            }}>
            {(sessionsExpanded ? sessions : sessions.slice(0, SESSIONS_DEFAULT)).map((s, i) => {
              const sessionNum = s.num ?? (i + 1)
              const evColor = { green: '#27AE60', yellow: '#F39C12', red: '#E74C3C' }[s.evolution] || null
              const bs = badgeStyle(s.statusLabel)
              const isConfirmingDelete = sessionDeleteId === s.id
              const isCanvas = s.type === 'canvas'
              // Última alteração: prefere finishedAt, depois updatedAt, depois createdAt
              const lastModified = s.finishedAt || s.updatedAt || s.createdAt
              return (
                <div key={s.id} style={{ borderBottom: i < sessions.length - 1 ? '1px solid var(--gr1)' : 'none' }}>
                  {/* Row */}
                  <div
                    className="sess-tbl-row"
                    onClick={() => onReopenSession && onReopenSession(s)}
                    style={{ display: 'grid', gridTemplateColumns: '52px 86px 1fr 88px 110px 110px 28px', columnGap: '12px', padding: '12px 20px', alignItems: 'center', cursor: 'pointer', transition: 'background 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--ow)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      {evColor && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: evColor, flexShrink: 0, display: 'inline-block' }} />}
                      <span style={{ fontFamily: "'Fraunces', serif", fontSize: '14px', color: 'var(--d)' }}>{sessionNum}</span>
                    </div>
                    {/* Type badge — sem emoji para evitar quebra de layout */}
                    <div>
                      <span style={{
                        fontSize: '9.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '10px',
                        background: isCanvas ? 'rgba(74,124,89,0.08)' : 'rgba(41,128,185,0.08)',
                        color: isCanvas ? 'var(--g600)' : '#2980B9',
                        border: `1px solid ${isCanvas ? 'var(--g100)' : 'rgba(41,128,185,0.2)'}`,
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                        display: 'inline-block',
                      }}>
                        Anotação
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--gr5)', lineHeight: 1.4, paddingRight: '16px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {s.hasAnalysis && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: 600, color: 'var(--g600)', background: 'var(--g50)', border: '1px solid var(--g100)', padding: '1px 6px', borderRadius: '20px', marginRight: '6px', verticalAlign: 'middle' }}>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          IA
                        </span>
                      )}
                      {s.summary || s.notePreview || 'Caderno de anotações — clique para abrir'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--gr5)' }}>
                      {fmtDate(s.sessionDate || s.createdAt)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--gr5)' }}>
                      {fmtDate(lastModified)}
                    </div>
                    <div>
                      <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '20px', background: bs.bg, color: bs.color }}>
                        {s.statusLabel}
                      </span>
                    </div>
                    <div>
                      <button
                        onClick={e => { e.stopPropagation(); setSessionDeleteId(isConfirmingDelete ? null : s.id) }}
                        title="Excluir anotação"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--gr3)', display: 'flex', alignItems: 'center' }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </div>
                  </div>

                  {isConfirmingDelete && (
                    <div style={{ background: 'var(--danger-l)', border: '1px solid #E8B4B0', borderRadius: 'var(--r)', margin: '0 20px 8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--danger)', flex: 1 }}>Excluir anotação {sessionNum}? Esta ação não pode ser desfeita.</span>
                      <button onClick={() => setSessionDeleteId(null)} style={{ ...btnSt, background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '11px', padding: '5px 10px' }}>Cancelar</button>
                      <button onClick={async () => {
                        try {
                          await api.deleteSession(s.id)
                          // Limpa o caderno local também — senão ele "ressuscita" do localStorage
                          try {
                            localStorage.removeItem(`psicoai_canvas3_s${s.id}`)
                            // Apaga 1 página apaga a nota; limpa o cache-mestre p/ reconstruir do backend
                            if (patientId) {
                              localStorage.removeItem(`psicoai_canvas3_p${patientId}`)
                            }
                            const active = JSON.parse(localStorage.getItem('psicoai_active_session') || 'null')
                            if (active?.sessionId === s.id || (active?.patientId === patientId && sessions.length <= 1)) {
                              localStorage.removeItem('psicoai_active_session')
                            }
                          } catch { /* localStorage indisponível — ignora */ }
                          setSessions(prev => prev.filter(x => x.id !== s.id))
                          setSessionDeleteId(null)
                        } catch (e) {
                          showToast('Não foi possível excluir a anotação: ' + (e.message || 'Erro desconhecido'), 'error')
                          setSessionDeleteId(null)
                        }
                      }} style={{ ...btnSt, background: 'var(--danger)', color: '#fff', fontSize: '11px', padding: '5px 10px' }}>Confirmar</button>
                    </div>
                  )}
                </div>
              )
            })}
            </div>{/* fim scroll wrapper */}

            {/* Botão ver mais / recolher */}
            {sessions.length > SESSIONS_DEFAULT && (
              <button
                onClick={() => setSessionsExpanded(v => !v)}
                style={{
                  width: '100%', padding: '11px 20px',
                  background: 'var(--ow)', border: 'none', borderTop: '1px solid var(--gr1)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontSize: '12px', fontWeight: 600, color: 'var(--g600)',
                  fontFamily: "'DM Sans', sans-serif", transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--g50)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--ow)'}
              >
                {sessionsExpanded ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                    Recolher
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                    Ver todas as {sessions.length} anotações
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Forms */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Formulários e Relatórios</div>
            <div className="card-sub">
              {loading ? '…' : forms.length === 0
                ? 'Nenhum formulário enviado'
                : `${forms.filter(f => f.status === 'answered').length} de ${forms.length} respondidos`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-primary" style={{ fontSize: '12px', padding: '7px 14px' }} onClick={() => setReportOpen(true)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Gerar Relatório
            </button>
            <button className="btn-outline" style={{ fontSize: '12px', padding: '7px 14px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Enviar formulário
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '20px' }}>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                <Skeleton style={{ flex: 1, height: 14 }} />
                <Skeleton style={{ width: 80, height: 14 }} />
                <Skeleton style={{ width: 80, height: 22, borderRadius: 20 }} />
              </div>
            ))}
          </div>
        ) : forms.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--gr2)" strokeWidth="1.2" style={{ margin: '0 auto 12px', display: 'block' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <div style={{ fontSize: '13px', color: 'var(--gr4)', marginBottom: '4px' }}>Nenhum formulário enviado para {p.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--gr3)' }}>Envie anamnese, TCLE ou escalas clínicas pela seção Formulários</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 80px', borderBottom: '2px solid var(--gr2)', padding: '8px 20px', background: 'var(--ow)' }}>
              {['Formulário', 'Enviado', 'Respondido', 'Status'].map((h, i) => (
                <div key={i} style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--gr4)' }}>{h}</div>
              ))}
            </div>
            {forms.map((f, i) => {
              const badge = formBadge[f.status] || formBadge.pending
              return (
                <div
                  key={f.id}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 80px', padding: '13px 20px', borderBottom: i < forms.length - 1 ? '1px solid var(--gr1)' : 'none', alignItems: 'center', transition: 'background 0.12s', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--ow)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--d)' }}>{f.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--gr5)' }}>{fmtDate(f.createdAt)}</div>
                  <div style={{ fontSize: '12px', color: f.answeredAt ? 'var(--gr5)' : 'var(--gr3)' }}>{f.answeredAt ? fmtDate(f.answeredAt) : '—'}</div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '20px', background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
      {/* Documents */}
      <DocumentsPanel patientId={patientId} patientName={p?.name} />

      {/* Notes */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Notas do prontuário</div>
        </div>
        <div className="card-body">
          <textarea
            value={notes}
            onChange={e => { setNotes(e.target.value); setNotesSaved(false) }}
            onBlur={async (e) => {
              e.target.style.borderColor = 'var(--gr2)'
              e.target.style.boxShadow = 'none'
              if (patientId) {
                setNotesSaving(true)
                await api.updatePatient(patientId, { notes }).catch(() => {})
                setNotesSaving(false)
                setNotesSaved(true)
                setTimeout(() => setNotesSaved(false), 2500)
              }
            }}
            placeholder="Anotações livres sobre o paciente, evolução geral, observações clínicas..."
            rows={5}
            style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '10px 12px', fontSize: '13px', color: 'var(--d)', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, resize: 'vertical', outline: 'none', background: 'var(--ow)', transition: 'border-color 0.15s, box-shadow 0.15s' }}
            onFocus={e => { e.target.style.borderColor = 'var(--g300)'; e.target.style.boxShadow = '0 0 0 3px rgba(74,124,89,0.08)' }}
          />
          <div style={{ fontSize: '11px', color: notesSaved ? 'var(--g600)' : 'var(--gr4)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: 5, transition: 'color 0.2s' }}>
            {notesSaving && <><span style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid var(--gr4)', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />Salvando…</>}
            {notesSaved && <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Salvo</>}
            {!notesSaving && !notesSaved && 'Salvo automaticamente ao sair do campo.'}
          </div>
        </div>
      </div>
    </div>

    <PatientFormModal
      isOpen={editOpen}
      onClose={() => setEditOpen(false)}
      initialData={summary?.patient || propPatient}
      onSave={async (form) => {
        await api.updatePatient(patientId, {
          name: form.nome, birthDate: form.dataNasc, gender: form.genero,
          email: form.email, phone: form.telefone, complaint: form.queixa,
          history: form.historico, medication: form.medicacao,
          approach: form.abordagem, frequency: form.frequencia,
          cid: form.cid, payment: form.pagamento, sessionValue: form.valor,
          notes: form.notes,
          recurringDayOfWeek: form.recurringDayOfWeek,
          recurringTime: form.recurringTime,
          recurringDurationMin: form.recurringDurationMin,
          billingType: form.billingType,
          monthlyValue: form.monthlyValue,
        })
        setEditOpen(false)
        api.getPatientSummary(patientId).then(setSummary)
        // Re-sincroniza agenda se recorrência definida (isUpdate=true → apaga futuros e recria)
        if (form.recurringDayOfWeek && form.recurringTime && onSyncAgenda) {
          onSyncAgenda(patientId, form.nome, form, true).catch(() => {})
        }
      }}
    />
    <ReportModal
      isOpen={reportOpen}
      onClose={() => setReportOpen(false)}
      patient={summary?.patient || propPatient}
      sessions={sessions}
      analyses={analyses}
    />
    </>
  )
}
