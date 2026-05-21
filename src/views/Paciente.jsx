import { useState, useEffect } from 'react'
import { api } from '../services'
import CadastroModal from '../components/CadastroModal'
import ReportModal from '../components/ReportModal'

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

export default function Paciente({ patient: propPatient, setCurrentView, onSessao }) {
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

  const patientId = propPatient?.id

  const load = () => {
    if (!patientId) return
    setLoading(true)
    setError(null)
    Promise.all([
      api.getPatientSummary(patientId),
      api.getPatientSessions(patientId),
      api.getPatientForms(patientId),
      api.getPatientAnalyses(patientId),
    ]).then(([sum, sess, frms, als]) => {
      setSummary(sum)
      setSessions(sess.content || [])
      setForms(frms || [])
      setAnalyses(als.content || [])
      setNotes((sum?.patient?.notes) || (propPatient?.notes) || '')
    })
    .catch(e => setError(e.message || 'Erro ao carregar paciente'))
    .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [patientId])

  const p = summary?.patient || propPatient
  if (!p && !loading && !error) return null

  // Latest analysis — real data from API
  const latestAnalysis = analyses[0] || null
  const latestPatterns   = parseJson(latestAnalysis?.patterns)
  const latestHypotheses = parseJson(latestAnalysis?.hypotheses)

  // Build timeline from sessions
  const timelineDots = sessions.map(s => ({
    evolution: s.evolution,
    date: fmtMonthDay(s.finishedAt || s.createdAt),
    num: s.num,
    tip: `${s.num} — ${s.statusLabel}\n${s.summary?.slice(0, 60) || ''}`,
    isOpen: s.status === 'open',
  }))

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

  // Gather patterns/hypotheses from all analyses in sessions that have them
  const allPatterns = sessions
    .filter(s => s.hasAnalysis)
    .flatMap(() => []) // filled by analysis fetch — using hardcoded fallback from status

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
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button className="btn-outline" onClick={() => setEditOpen(true)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Editar
                </button>
                <button onClick={() => setDeleteConfirm(true)} style={{ ...btnSt, background: 'var(--danger-l)', color: 'var(--danger)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  Excluir
                </button>
                <button className="btn-primary" onClick={onSessao}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Nova Sessão
                </button>
              </div>
            </div>
            <div className="pat-stats">
              <div className="pat-stat">
                <div className="pat-stat-val">{summary?.sessionCount || p.sessions}</div>
                <div className="pat-stat-label">Sessões</div>
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

      {/* Timeline */}
      {timelineDots.length > 0 && !loading && (
        <div className="timeline-wrap">
          <div className="timeline-label">Linha do Tempo das Sessões</div>
          <div className="timeline-track">
            <div className="timeline-line" />
            <div className="timeline-dots">
              {timelineDots.map((d, i) => (
                <div key={i} className={`tl-dot${d.evolution && !d.isOpen ? ` ${d.evolution}` : ''}`} style={d.isOpen ? { color: 'var(--g500)' } : {}}>
                  <div className="tl-dot-circle" style={d.isOpen ? { background: 'var(--g500)' } : {}} />
                  <div className="tl-dot-date">{d.date}</div>
                  <div className="tl-dot-num">{d.num}</div>
                  <div className="tl-tooltip">{d.tip}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
            {[['#27AE60', 'Evolução'], ['#F39C12', 'Neutro'], ['#E74C3C', 'Regressão/Alerta'], ['var(--g500)', 'Sessão aberta']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--gr5)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, display: 'inline-block' }} />
                {l}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cards row */}
      <div className="three-col">
        {/* Clinical data */}
        <div className="card">
          <div className="card-header"><div className="card-title">Dados Clínicos</div></div>
          <div className="card-body">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="data-row">
                    <Skeleton style={{ height: 12, width: 60 }} />
                    <Skeleton style={{ height: 12, width: '65%' }} />
                  </div>
                ))
              : [
                  ['Queixa', p.complaint || '—'],
                  ['Histórico', p.history || '—'],
                  ['Medicação', p.medication || 'Nenhuma'],
                  ['Abordagem', p.approach || '—'],
                  ['Frequência', p.frequency || '—'],
                  ['Valor da sessão', p.sessionValue ? `R$ ${p.sessionValue},00` : 'Convênio/Gratuito'],
                  ['Início', fmtDate(p.createdAt)],
                ].map(([k, v]) => (
                  <div key={k} className="data-row">
                    <div className="data-key">{k}</div>
                    <div className="data-val">{v}</div>
                  </div>
                ))
            }
          </div>
        </div>

        {/* Patterns from analysis */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Padrões Detectados</div>
            <span className={`card-badge ${hasAnalysis ? 'badge-green' : 'badge-gray'}`}>IA</span>
          </div>
          <div className="card-body">
            {!hasAnalysis ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gr3)" strokeWidth="1.2" style={{ margin: '0 auto 10px', display: 'block' }}>
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
                <div style={{ fontSize: '12px', color: 'var(--gr4)', lineHeight: 1.5 }}>Nenhuma análise IA gerada ainda.<br/>Encerre uma sessão para analisar.</div>
              </div>
            ) : latestPatterns.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--gr4)', textAlign: 'center', padding: '12px 0' }}>Padrões não disponíveis nesta análise.</div>
            ) : (
              <>
                {latestPatterns.map((pat) => {
                  const SEV_COLOR = { high: 'var(--danger)', medium: 'var(--warn)', low: 'var(--g500)' }
                  const PAT_LABELS = {
                    avoidance: 'Evitação comportamental', rumination: 'Ruminação cognitiva',
                    hypervigilance: 'Hipervigilância', catastrophizing: 'Catastrofização',
                    dissociation: 'Dissociação', isolation: 'Isolamento social',
                  }
                  const label = PAT_LABELS[pat.type] || pat.type
                  const color = SEV_COLOR[pat.severity] || SEV_COLOR.low
                  return (
                    <div key={pat.type} className="prog-item">
                      <div className="prog-label">
                        <span className="prog-name">{label}</span>
                        <span style={{ fontSize: '10px', fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{pat.severity}</span>
                      </div>
                      <div className="prog-track"><div className="prog-fill" style={{ width: pat.severity === 'high' ? '85%' : pat.severity === 'medium' ? '55%' : '30%', background: `linear-gradient(90deg, ${color}, ${color}bb)` }} /></div>
                      {pat.description && <div style={{ fontSize: '11px', color: 'var(--gr5)', marginTop: 4, lineHeight: 1.4 }}>{pat.description}</div>}
                    </div>
                  )
                })}
                <div style={{ fontSize: '11px', color: 'var(--gr4)', marginTop: '12px' }}>
                  Última análise · {fmtDate(latestAnalysis?.createdAt)}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Hypotheses */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Hipóteses Diagnósticas</div>
            <span className={`card-badge ${hasAnalysis ? 'badge-green' : 'badge-gray'}`}>DSM-5 / CID-11</span>
          </div>
          <div className="card-body">
            {!hasAnalysis ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gr3)" strokeWidth="1.2" style={{ margin: '0 auto 10px', display: 'block' }}>
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <div style={{ fontSize: '12px', color: 'var(--gr4)', lineHeight: 1.5 }}>Hipóteses aparecem após a primeira análise IA.</div>
              </div>
            ) : latestHypotheses.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--gr4)', textAlign: 'center', padding: '12px 0' }}>Hipóteses não disponíveis nesta análise.</div>
            ) : (
              <>
                {latestHypotheses.map((h) => (
                  <div key={h.code} className="hyp-item">
                    <div className="hyp-prob">{h.probability}%</div>
                    <div className="hyp-info">
                      <div className="hyp-name">{h.label || h.name}</div>
                      <div className="hyp-code">{h.code}{h.system ? ` · ${h.system}` : ''}</div>
                      <div className="hyp-bar"><div className="hyp-fill" style={{ width: `${h.probability}%` }} /></div>
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: '11px', color: 'var(--warn)', background: 'var(--warn-l)', padding: '8px 10px', borderRadius: '6px', marginTop: '12px', lineHeight: 1.4 }}>
                  ⚠ Hipóteses de apoio ao raciocínio clínico. Diagnóstico é responsabilidade do psicólogo.
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Sessions table */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Histórico de Sessões</div>
            <div className="card-sub">{sessions.length} sessões registradas · clique para ver detalhes</div>
          </div>
          <button className="btn-primary" onClick={onSessao} style={{ fontSize: '12px', padding: '7px 14px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nova Sessão
          </button>
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
            <div style={{ fontSize: '13px', color: 'var(--gr4)' }}>Nenhuma sessão registrada ainda.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 88px 80px 110px 28px 28px', borderBottom: '2px solid var(--gr2)', padding: '8px 20px', background: 'var(--ow)' }}>
              {['Sessão', 'Resumo', 'Data', 'Duração', 'Status', '', ''].map((h, i) => (
                <div key={i} style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--gr4)' }}>{h}</div>
              ))}
            </div>
            {sessions.map((s, i) => {
              const evColor = { green: '#27AE60', yellow: '#F39C12', red: '#E74C3C' }[s.evolution] || null
              const bs = badgeStyle(s.statusLabel)
              const isConfirmingDelete = sessionDeleteId === s.id
              return (
                <div key={s.id}>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: '52px 1fr 88px 80px 110px 28px 28px', padding: '12px 20px', borderBottom: (!isConfirmingDelete && i < sessions.length - 1) ? '1px solid var(--gr1)' : 'none', alignItems: 'center', cursor: 'pointer', transition: 'background 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--ow)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      {evColor && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: evColor, flexShrink: 0, display: 'inline-block' }} />}
                      <span style={{ fontFamily: "'Fraunces', serif", fontSize: '14px', color: 'var(--d)' }}>{s.num}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--gr5)', lineHeight: 1.4, paddingRight: '16px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {s.hasAnalysis && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: 600, color: 'var(--g600)', background: 'var(--g50)', border: '1px solid var(--g100)', padding: '1px 6px', borderRadius: '20px', marginRight: '6px', verticalAlign: 'middle' }}>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          IA
                        </span>
                      )}
                      {s.summary}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--gr5)' }}>{fmtDate(s.finishedAt || s.createdAt)}</div>
                    <div style={{ fontSize: '12px', color: 'var(--gr5)', fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(s.durationSeconds)}</div>
                    <div>
                      <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '20px', background: bs.bg, color: bs.color }}>
                        {s.statusLabel}
                      </span>
                    </div>
                    <div style={{ color: 'var(--gr3)' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                    <div>
                      <button
                        onClick={e => { e.stopPropagation(); setSessionDeleteId(isConfirmingDelete ? null : s.id) }}
                        title="Excluir sessão"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--gr3)', display: 'flex', alignItems: 'center' }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </div>
                  </div>
                  {isConfirmingDelete && (
                    <div style={{ background: 'var(--danger-l)', border: '1px solid #E8B4B0', borderRadius: 'var(--r)', margin: '0 20px 8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--danger)', flex: 1 }}>Excluir sessão {s.num}? Esta ação não pode ser desfeita.</span>
                      <button onClick={() => setSessionDeleteId(null)} style={{ ...btnSt, background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '11px', padding: '5px 10px' }}>Cancelar</button>
                      <button onClick={async () => { await api.deleteSession(s.id); setSessions(prev => prev.filter(x => x.id !== s.id)); setSessionDeleteId(null) }} style={{ ...btnSt, background: 'var(--danger)', color: '#fff', fontSize: '11px', padding: '5px 10px' }}>Confirmar</button>
                    </div>
                  )}
                </div>
              )
            })}
          </>
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

    <CadastroModal
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
        })
        setEditOpen(false)
        api.getPatientSummary(patientId).then(setSummary)
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
